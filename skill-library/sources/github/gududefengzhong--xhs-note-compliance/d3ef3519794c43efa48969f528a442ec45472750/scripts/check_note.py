#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小红书笔记合规检查器：词库 + 正则扫描，输出候选风险命中。

用法:
    python3 check_note.py note.md              # 可读报告
    python3 check_note.py note.md --json       # JSON 输出（供 Agent 二次加工）
    cat note.md | python3 check_note.py -      # 从 stdin 读取

说明:
    输出的是「候选命中」，可能含少量误报（如「最好」作副词），
    需结合上下文复核后再定稿报告。语义级风险（隐性承诺、创意变体
    导流、未报备商单）不在本脚本覆盖范围内，见 references/rules.md。
"""

import argparse
import json
import re
import sys
from pathlib import Path

WORDS_FILE = Path(__file__).resolve().parent / "banned_words.json"

RISK_RANK = {"high": 3, "medium": 2, "low": 1}
RISK_LABEL = {"high": "高", "medium": "中", "low": "低"}
VERDICT = {
    "high": "🔴 高风险：存在违禁表述，发布被拦截或限流的风险较高",
    "medium": "🟡 中风险：存在易限流表述，建议修改后发布",
    "low": "🟢 低风险：仅有轻微提示项，注意控制营销用词密度",
    "pass": "✅ 词库未命中：仍建议复核隐性承诺、创意变体导流等语义级风险",
}

ZERO_WIDTH = (0x200B, 0x200C, 0x200D, 0xFEFF, 0x2060)


def normalize(text):
    """逐字符归一化且保持与原文等长：全角→半角、零宽字符→空格、拉丁转小写。"""
    out = []
    for ch in text:
        code = ord(ch)
        if code in ZERO_WIDTH or code == 0x3000:
            out.append(" ")
            continue
        if 0xFF01 <= code <= 0xFF5E:
            ch = chr(code - 0xFEE0)
        low = ch.lower()
        out.append(low if len(low) == 1 else ch)
    return "".join(out)


def line_of(text, idx):
    return text.count("\n", 0, idx) + 1


def snippet(text, start, end, width=14):
    s, e = max(0, start - width), min(len(text), end + width)
    body = text[s:e].replace("\n", " ")
    return ("…" if s else "") + body + ("…" if e < len(text) else "")


def is_latin(s):
    return all(ord(c) < 128 for c in s)


def scan(text, db):
    norm = normalize(text)
    hits = []

    def is_false_positive_superlative(start, end):
        matched = text[start:end]
        if matched == "最好" and end < len(text) and text[end] == "的":
            next_two = text[end + 1:end + 3]
            safe_followers = {
                "朋友", "家人", "孩子", "宝宝", "生活", "时候", "心情", "音乐",
                "电影", "书", "老师", "同学", "兄弟", "姐妹",
            }
            if next_two in safe_followers:
                return True
        return False

    def add(start, end, term, cat_name, risk, why, suggestion, priority):
        if is_false_positive_superlative(start, end):
            return
        hits.append({
            "term": term,
            "matched": text[start:end],
            "category": cat_name,
            "risk": risk,
            "priority": priority,
            "why": why,
            "suggestion": suggestion,
            "line": line_of(text, start),
            "start": start,
            "end": end,
            "snippet": snippet(text, start, end),
        })

    for cat in db["categories"]:
        sugg_map = cat.get("suggestions", {})
        for word in cat["words"]:
            needle = normalize(word)
            pos = 0
            while (idx := norm.find(needle, pos)) != -1:
                pos = idx + 1
                end = idx + len(needle)
                if is_latin(needle):  # 拉丁词按词边界匹配，避免命中英文单词内部
                    before = norm[idx - 1] if idx else " "
                    after = norm[end] if end < len(norm) else " "
                    if before.isalnum() or after.isalnum():
                        continue
                add(idx, end, word, cat["name"], cat["risk"], cat["why"],
                    sugg_map.get(word, ""), cat.get("priority", 0))

    for pat in db.get("patterns", []):
        for m in re.finditer(pat["regex"], norm):
            add(m.start(), m.end(), pat["name"], pat["name"], pat["risk"],
                pat["why"], pat.get("suggestion", ""), pat.get("priority", 0))

    return dedupe(hits)


def dedupe(hits):
    """同一位置被词库和正则同时命中时，保留更长/更高风险的一条。"""
    hits.sort(key=lambda h: (h["start"], h["start"] - h["end"], -RISK_RANK[h["risk"]]))
    kept = []
    for h in hits:
        contained = any(
            k["start"] <= h["start"] and h["end"] <= k["end"]
            and RISK_RANK[k["risk"]] >= RISK_RANK[h["risk"]]
            and k is not h
            for k in kept
        )
        if not contained:
            kept.append(h)
    return kept


def detect_signals(text, db):
    """商业信号：不计入风险分，用于判断是否需要商单报备。"""
    norm = normalize(text)
    out = []
    for sig in db.get("signals", []):
        matches = list(re.finditer(sig["regex"], norm))
        if matches:
            first = matches[0]
            out.append({
                "id": sig["id"],
                "name": sig["name"],
                "why": sig["why"],
                "count": len(matches),
                "example": snippet(text, first.start(), first.end()),
            })
    return out


def text_metrics(text):
    """文风指标：供营销语气浓度判断参考。"""
    return {
        "chars": len(text),
        "exclamations": text.count("!") + text.count("！"),
        "emoji": sum(1 for ch in text
                     if 0x1F000 <= ord(ch) <= 0x1FAFF or 0x2600 <= ord(ch) <= 0x27BF),
    }


def top_fixes(hits, n=3):
    """挑最该先改的几处：风险等级 → 类别优先级（导流/医疗/红线 > 绝对化）→ 出现位置。

    priority 相同视为同类问题（如「加我微信」和「vx」都属导流），
    Top N 里同类只占一个名额，尽量覆盖不同类型的问题；类别不足时再回填。
    """
    ranked = sorted(hits, key=lambda h: (-RISK_RANK[h["risk"]], -h.get("priority", 0), h["start"]))
    picked, seen = [], set()
    for h in ranked:
        if h.get("priority", 0) in seen:
            continue
        seen.add(h.get("priority", 0))
        picked.append(h)
        if len(picked) == n:
            break
    for h in ranked:
        if len(picked) == n:
            break
        if h not in picked:
            picked.append(h)
    return [
        f"L{h['line']}「{h['matched']}」→ {h['suggestion'] or '删除或改写该表述'}"
        for h in picked
    ]


def summarize(hits):
    counts = {r: sum(1 for h in hits if h["risk"] == r) for r in ("high", "medium", "low")}
    if not hits:
        verdict = "pass"
    else:
        verdict = max((h["risk"] for h in hits), key=lambda r: RISK_RANK[r])
    return verdict, counts


def render(hits, verdict, counts, signals, metrics, fixes):
    lines = []
    lines.append("=" * 60)
    lines.append("小红书笔记合规体检报告（词库扫描层）")
    lines.append("=" * 60)
    lines.append(f"总评级: {VERDICT[verdict]}")
    lines.append(f"命中统计: 高 {counts['high']} / 中 {counts['medium']} / 低 {counts['low']}")
    lines.append(f"文风参考: 全文 {metrics['chars']} 字 / 感叹号 {metrics['exclamations']} 个"
                 f" / emoji {metrics['emoji']} 个")
    if fixes:
        lines.append("")
        lines.append(f"── 先改这几处（必改 Top {len(fixes)}）──")
        for i, f in enumerate(fixes, 1):
            lines.append(f"{i}. {f}")
    for risk in ("high", "medium", "low"):
        group = [h for h in hits if h["risk"] == risk]
        if not group:
            continue
        lines.append("")
        lines.append(f"── {RISK_LABEL[risk]}风险命中（{len(group)}处）──")
        for h in group:
            lines.append(f"[L{h['line']}] 「{h['matched']}」 ← {h['category']}")
            lines.append(f"    语境: {h['snippet']}")
            lines.append(f"    原因: {h['why']}")
            if h["suggestion"]:
                lines.append(f"    改法: {h['suggestion']}")
    if signals:
        lines.append("")
        lines.append("── 商业信号（不计风险分，供报备判断）──")
        for s in signals:
            lines.append(f"· {s['name']} ×{s['count']}  例: {s['example']}")
        lines.append("  → 若本篇为合作/带货内容，需走蒲公英平台报备并声明合作，")
        lines.append("    否则易被判定未报备商单")
    lines.append("")
    lines.append("注: 以上为词库候选命中，请结合上下文剔除误报；隐性承诺、变体导流、")
    lines.append("    未报备商单等语义级风险需另行复核。本报告不构成法律意见。")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="小红书笔记合规检查器")
    ap.add_argument("file", help="笔记文件路径，传 - 表示从 stdin 读取")
    ap.add_argument("--json", action="store_true", dest="as_json",
                    help="输出 JSON（供 Agent 二次加工）")
    args = ap.parse_args()

    if args.file == "-":
        text = sys.stdin.read()
    else:
        text = Path(args.file).read_text(encoding="utf-8")

    db = json.loads(WORDS_FILE.read_text(encoding="utf-8"))
    hits = scan(text, db)
    verdict, counts = summarize(hits)
    signals = detect_signals(text, db)
    metrics = text_metrics(text)
    fixes = top_fixes(hits)

    if args.as_json:
        print(json.dumps({
            "verdict": verdict,
            "verdict_text": VERDICT[verdict],
            "counts": counts,
            "top_fixes": fixes,
            "hits": hits,
            "signals": signals,
            "metrics": metrics,
        }, ensure_ascii=False, indent=2))
    else:
        print(render(hits, verdict, counts, signals, metrics, fixes))

    sys.exit(0)


if __name__ == "__main__":
    main()
