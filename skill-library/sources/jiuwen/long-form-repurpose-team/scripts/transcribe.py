#!/usr/bin/env python3
"""云端转写：链接或本地音视频 → 带时间戳的转写稿。

用法:
    python3 transcribe.py <视频链接或本地文件> [-o 输出目录] [--cookies cookies.txt]

产出（输出目录下）:
    transcript.json  逐句转写 [{id, start, end, text}]，时间单位为秒
    transcript.srt   同内容的字幕格式，便于人工核对
    prosody.json     停顿间隔、语速偏差、笑声标记（供 emotion-peak-scout 使用）
    meta.json        时长、服务商、模型、花费

转写服务按以下顺序确定:
    1. 环境变量 ASR_API_BASE / ASR_API_KEY / ASR_MODEL
    2. jiuwen 配置 ~/.jiuwenswarm/config/config.yaml 中已有的 OpenRouter 或 OpenAI key，
       模型自动取 openai/whisper-1（OpenRouter）或 whisper-1（OpenAI）
    都没有时以退出码 3 结束，由调用方决定是否改用本地 whisper。

只下载音频流，不下载视频（bind.md 约束 8）。本脚本不安装任何东西（约束 7）。
依赖：yt-dlp（仅链接输入需要）、ffmpeg、ffprobe。只用 Python 标准库。
"""
import argparse, concurrent.futures as cf, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request, uuid

CHUNK_SECONDS = int(os.getenv("TRANSCRIBE_CHUNK_SECONDS", "300"))   # 每段约 5 分钟，并行上传
MAX_WORKERS = 10
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def die(msg, code=1):
    print(f"[transcribe] 错误：{msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


# ---------------------------------------------------------------- 转写服务配置
def _config_candidates():
    """从 jiuwen config.yaml 里找已配置的 (api_base, api_key)。不依赖 PyYAML。"""
    path = os.path.expanduser("~/.jiuwenswarm/config/config.yaml")
    if not os.path.exists(path):
        return []
    try:
        import yaml  # noqa: 有就用
        data = yaml.safe_load(open(path, encoding="utf-8"))
        return [(m["model_client_config"].get("api_base", ""), m["model_client_config"].get("api_key", ""))
                for m in data.get("models", {}).get("defaults", []) if isinstance(m, dict)]
    except Exception:
        pass
    # 无 PyYAML 时逐行扫描：每个 api_base 只与其后 5 行内同一配置块的 api_key 配对，
    # 避免被其他只有 api_key 的配置块（如记忆模块）打乱顺序。
    lines = open(path, encoding="utf-8").read().splitlines()
    val = lambda l: l.split(":", 1)[1].strip().strip("'\"")
    pairs = []
    for i, line in enumerate(lines):
        if line.strip().startswith("api_base:"):
            for nxt in lines[i + 1:i + 6]:
                if nxt.strip().startswith("api_key:"):
                    pairs.append((val(line), val(nxt)))
                    break
    return pairs


def resolve_provider():
    if os.getenv("ASR_API_KEY"):
        return (os.getenv("ASR_API_BASE", "https://api.openai.com/v1").rstrip("/"),
                os.environ["ASR_API_KEY"], os.getenv("ASR_MODEL", "whisper-1"), "env")
    for base, key in _config_candidates():
        if not key or key.startswith("${") or len(key) < 20:
            continue
        if "openrouter.ai" in base:
            return base.rstrip("/"), key, "openai/whisper-1", "jiuwen-config(OpenRouter)"
        if "api.openai.com" in base:
            return base.rstrip("/"), key, "whisper-1", "jiuwen-config(OpenAI)"
    return None


# ---------------------------------------------------------------- 取音频
def fetch_audio(src, workdir, cookies=None, browser=None):
    if os.path.exists(src):
        return os.path.abspath(src)
    if not shutil.which("yt-dlp"):
        die("输入是链接但本机没有 yt-dlp。请提供本地音视频文件，或由用户决定是否安装 yt-dlp。")
    out = os.path.join(workdir, "source.%(ext)s")
    base = ["yt-dlp", "-f", "worstaudio/bestaudio/best", "--no-playlist", "--no-warnings",
            "--user-agent", UA, "-o", out]
    if "bilibili.com" in src or "b23.tv" in src:
        base += ["--referer", "https://www.bilibili.com/"]
    if cookies:
        base += ["--cookies", cookies]
    if browser:
        base += ["--cookies-from-browser", browser]   # 用户本人浏览器的登录状态，须经用户同意
    r = run(base + [src])
    files = [f for f in os.listdir(workdir) if f.startswith("source.")]
    if r.returncode == 0 and files:
        return os.path.join(workdir, files[0])
    err = (r.stderr or r.stdout)[-500:]
    hint = ""
    if "412" in err or "403" in err:
        if browser:
            hint = (f"\n已使用浏览器（{browser}）的登录状态，仍被拒绝。可能是该浏览器未登录此平台，"
                    "或读取登录状态失败（macOS 需在钥匙串弹窗中允许）。请让用户确认登录状态，或提供本地文件。")
        else:
            hint = ("\n平台拒绝了访问（反爬或需要登录）。不要换接口、伪装身份或反复重试。\n"
                    "征得用户同意后，加 --cookies-from-browser chrome（或用户使用的浏览器）用其登录状态重新下载；\n"
                    "用户不同意时，请其提供本地音视频文件。")
    die("下载音频失败。" + hint + "\n" + err, code=4)


def duration_of(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        die(f"无法读取时长：{path}\n{r.stderr[-300:]}")


def prepare_chunks(src, workdir):
    """压成单声道 16kHz 32kbps mp3，再按 CHUNK_SECONDS 切段。返回 [(路径, 起始秒)]。"""
    mono = os.path.join(workdir, "audio.mp3")
    r = run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", mono])
    if r.returncode != 0:
        die("ffmpeg 转码失败（源文件可能没有音轨）：\n" + r.stderr[-400:])
    total = duration_of(mono)
    if total <= CHUNK_SECONDS * 1.2:
        return mono, total, [(mono, 0.0, total)]
    # 在每个目标切点附近 ±30 秒内找最近的静音处下刀，避免把一句话切成两半
    sd = run(["ffmpeg", "-i", mono, "-af", "silencedetect=noise=-35dB:d=0.4", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", sd.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", sd.stderr)]
    mids = [(a + b) / 2 for a, b in zip(starts, ends)]
    cuts, t = [], CHUNK_SECONDS
    while t < total - CHUNK_SECONDS * 0.2:
        near = [m for m in mids if abs(m - t) <= 30]
        cuts.append(round(min(near, key=lambda m: abs(m - t)) if near else t, 3))
        t = cuts[-1] + CHUNK_SECONDS
    pattern = os.path.join(workdir, "chunk_%03d.mp3")
    r = run(["ffmpeg", "-y", "-loglevel", "error", "-i", mono, "-f", "segment",
             "-segment_times", ",".join(str(c) for c in cuts),
             "-c", "copy", "-reset_timestamps", "1", pattern])
    if r.returncode != 0:
        die("切分音频失败：\n" + r.stderr[-400:])
    chunks, offset = [], 0.0
    for name in sorted(f for f in os.listdir(workdir) if f.startswith("chunk_")):
        p = os.path.join(workdir, name)
        dur = duration_of(p)
        chunks.append((p, offset, dur))
        offset += dur                     # 用每段真实时长累加，保证拼回后的时间轴准确
    return mono, total, chunks


# ---------------------------------------------------------------- 转写
def transcribe_chunk(path, base, key, model, language):
    b = uuid.uuid4().hex
    fields = [("model", model), ("response_format", "verbose_json"), ("timestamp_granularities[]", "segment")]
    if language:
        fields.append(("language", language))
    if language == "zh":
        # whisper 对中文有时输出繁体，给一句简体提示即可稳定为简体
        fields.append(("prompt", "嗯，那我们这期节目就来聊聊这个话题。说实话，这些内容我们之前也讨论过，这次说得更具体一点。"))
    body = b"".join(f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode() for k, v in fields)
    body += (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{os.path.basename(path)}\"\r\n"
             f"Content-Type: audio/mpeg\r\n\r\n").encode() + open(path, "rb").read() + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request(f"{base}/audio/transcriptions", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": f"multipart/form-data; boundary={b}"})
    for attempt in range(3):
        try:
            return json.loads(urllib.request.urlopen(req, timeout=600).read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="ignore")[:300]
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(3 * (attempt + 1)); continue
            raise RuntimeError(f"HTTP {e.code}: {msg}")
        except urllib.error.URLError as e:
            if attempt < 2:
                time.sleep(3); continue
            raise RuntimeError(str(e))


TRAD_HINT = set("這個們說對來時會國過還後麼為無開關長問間學現發點實經機義體與當從應讓話進邊種認樣見視覺讀寫聽買賣電網頁語題東車書")


def to_simplified(texts):
    """whisper 偶尔输出繁体。检测到繁体时统一转为简体：macOS 用系统自带转换，其他系统用 opencc（若已安装）。"""
    if not any(c in TRAD_HINT for t in texts for c in t):
        return texts, False
    joined = "\n".join(t.replace("\n", " ") for t in texts)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(joined); path = f.name
    try:
        if shutil.which("osascript"):
            js = ('ObjC.import("Foundation");function run(a){var s=$.NSString.stringWithContentsOfFileEncodingError('
                  'a[0],$.NSUTF8StringEncoding,null);return ObjC.unwrap(s.stringByApplyingTransformReverse('
                  '"Traditional-Simplified",false));}')
            r = run(["osascript", "-l", "JavaScript", "-e", js, path])
        elif shutil.which("opencc"):
            r = run(["opencc", "-c", "t2s", "-i", path])
        else:
            return texts, False
        out = r.stdout.rstrip("\n").split("\n")
        return (out, True) if r.returncode == 0 and len(out) == len(texts) else (texts, False)
    finally:
        os.unlink(path)


def fmt_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def prosody(segs):
    rates = [len(s["text"]) / max(s["end"] - s["start"], 0.3) for s in segs]
    base = sum(rates) / len(rates) if rates else 1
    out = []
    for i, (s, r) in enumerate(zip(segs, rates)):
        out.append({"id": s["id"], "start": s["start"],
                    "pause_before": round(s["start"] - segs[i - 1]["end"], 2) if i else 0.0,
                    "speech_rate_dev_pct": round((r - base) / base * 100),
                    "laughter_token": bool(re.search(r"\[laughter\]|[（(]笑[)）]|哈哈", s["text"]))})
    return {"baseline_chars_per_sec": round(base, 2), "source": "segment timestamps", "segments": out}


def main():
    ap = argparse.ArgumentParser(description="云端转写：链接或本地音视频 → 带时间戳的转写稿")
    ap.add_argument("source")
    ap.add_argument("-o", "--out", default="repurpose_work")
    ap.add_argument("--cookies", help="Netscape 格式 cookie 文件（登录后才能访问的视频）")
    ap.add_argument("--cookies-from-browser", default=os.getenv("REPURPOSE_COOKIES_BROWSER") or None,
                    help="使用用户本人浏览器的登录状态下载，如 chrome / safari / edge / firefox。"
                         "须经用户同意；设置环境变量 REPURPOSE_COOKIES_BROWSER 表示长期同意")
    ap.add_argument("--language", default="zh", help="音频语言，默认 zh；传空字符串则自动识别")
    a = ap.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        die("本机没有 ffmpeg/ffprobe，无法处理音频。请由用户决定是否安装。")
    prov = resolve_provider()
    if not prov:
        die("未找到可用的云端转写服务（环境变量 ASR_API_KEY 或 jiuwen 配置中的 OpenRouter/OpenAI key）。", code=3)
    base, key, model, origin = prov

    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()
    with tempfile.TemporaryDirectory() as work:
        src = fetch_audio(a.source, work, a.cookies, a.cookies_from_browser)
        t_dl = time.time()
        mono, total, chunks = prepare_chunks(src, work)
        est = total / 60 * 0.006
        print(f"[transcribe] 音频 {total/60:.1f} 分钟，切为 {len(chunks)} 段并行转写；"
              f"服务 {origin} / {model}，预计花费约 ${est:.2f}", flush=True)
        results = {}
        with cf.ThreadPoolExecutor(MAX_WORKERS) as ex:
            futs = {ex.submit(transcribe_chunk, p, base, key, model, a.language or None): (p, off, dur) for p, off, dur in chunks}
            for f in cf.as_completed(futs):
                p, off, dur = futs[f]
                try:
                    results[off] = (f.result(), dur)
                except Exception as e:
                    die(f"转写失败（{os.path.basename(p)}）：{e}")
        shutil.copy(mono, os.path.join(a.out, "audio.mp3"))

    segs, cost = [], 0.0
    for off in sorted(results):
        r, dur = results[off]
        cost += float((r.get("usage") or {}).get("cost") or 0)
        for s in r.get("segments", []):
            text = s["text"].strip()
            start = s["start"] + off
            end = min(s["end"], dur) + off          # whisper 偶尔给出超出本段长度的结束时间，截到段尾
            if not text or end - start <= 0:
                continue
            # 兜底：与上一句重叠且很短的碎片（切口残留）直接丢弃
            if segs and start < segs[-1]["end"] - 0.2 and end - start < 1.5:
                continue
            segs.append({"id": len(segs), "start": round(start, 2), "end": round(end, 2), "text": text})
    if not segs:
        die("转写结果为空（音频里可能没有人声）。")
    texts, converted = to_simplified([x["text"] for x in segs])
    for x, t in zip(segs, texts):
        x["text"] = t

    json.dump(segs, open(os.path.join(a.out, "transcript.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "transcript.srt"), "w", encoding="utf-8") as f:
        for s in segs:
            f.write(f"{s['id']+1}\n{fmt_srt(s['start'])} --> {fmt_srt(s['end'])}\n{s['text']}\n\n")
    json.dump(prosody(segs), open(os.path.join(a.out, "prosody.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    meta = {"source": a.source, "duration_sec": round(total, 1), "segments": len(segs), "provider": origin,
            "model": model, "cost_usd": round(cost, 4) if cost else round(est, 4),
            "download_sec": round(t_dl - t0, 1), "total_sec": round(time.time() - t0, 1),
            "converted_to_simplified": converted}
    json.dump(meta, open(os.path.join(a.out, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[transcribe] 完成：{len(segs)} 句，用时 {meta['total_sec']} 秒（下载 {meta['download_sec']} 秒），"
          f"花费 ${meta['cost_usd']}。输出目录 {os.path.abspath(a.out)}")


if __name__ == "__main__":
    main()
