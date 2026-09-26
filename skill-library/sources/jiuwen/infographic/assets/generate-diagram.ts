import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { parseArgs } from "util";

// Load GEMINI_API_KEY. A real environment variable always wins; otherwise we
// fall back to a local .env in the repo root (one level up from assets/).
// dotenv does not override variables that are already set in the environment.
dotenvConfig({
  path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
});

const { values } = parseArgs({
  options: {
    prompt: { type: "string" },
    output: { type: "string", default: "~/infographics/diagram.png" },
    ref: { type: "string", multiple: true },
  },
});

if (!values.prompt) {
  console.error("Error: --prompt is required");
  process.exit(1);
}

if (!values.ref || values.ref.length === 0) {
  console.error("Error: at least one --ref <image-path> is required");
  process.exit(1);
}

// ---- OpenRouter fallback (added for jiuwen) ---------------------------------
// If GEMINI_API_KEY is absent, call the same Gemini image model through
// OpenRouter, reusing OPENROUTER_API_KEY or the OpenRouter key already
// configured in jiuwen (~/.jiuwenswarm/config/config.yaml).
const OPENROUTER_MODEL =
  process.env.INFOGRAPHIC_MODEL || "google/gemini-3.1-flash-image-preview";

function findOpenRouterKey(): { base: string; key: string } | null {
  if (process.env.OPENROUTER_API_KEY) {
    return { base: "https://openrouter.ai/api/v1", key: process.env.OPENROUTER_API_KEY };
  }
  const cfg = join(process.env.HOME || "", ".jiuwenswarm", "config", "config.yaml");
  if (!existsSync(cfg)) return null;
  const lines = readFileSync(cfg, "utf-8").split("\n");
  const val = (l: string) => l.split(":").slice(1).join(":").trim().replace(/^['"]|['"]$/g, "");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("api_base:")) continue;
    const base = val(lines[i]);
    if (!base.includes("openrouter.ai")) continue;
    for (const nxt of lines.slice(i + 1, i + 6)) {
      if (nxt.trim().startsWith("api_key:")) {
        const key = val(nxt);
        if (key.length > 20 && !key.startsWith("${")) return { base: base.replace(/\/$/, ""), key };
        break;
      }
    }
  }
  return null;
}

const openrouter = process.env.GEMINI_API_KEY ? null : findOpenRouterKey();

if (!process.env.GEMINI_API_KEY && !openrouter) {
  console.error(
    "Error: GEMINI_API_KEY is not set, and no OpenRouter key was found. Export " +
      "GEMINI_API_KEY (https://aistudio.google.com/apikey) or OPENROUTER_API_KEY."
  );
  process.exit(1);
}

async function generateViaOpenRouter(
  refs: string[], prompt: string, outputPath: string
): Promise<boolean> {
  const content: any[] = [];
  for (const refPath of refs) {
    const expandedPath = refPath.replace(/^~/, process.env.HOME || "");
    const buf = await readFile(expandedPath);
    const type = mime.getType(expandedPath) || "image/jpeg";
    content.push({ type: "image_url", image_url: { url: `data:${type};base64,${buf.toString("base64")}` } });
    console.log(`Loaded reference: ${refPath}`);
  }
  content.push({ type: "text", text: prompt });
  console.log(`Generating diagram with ${OPENROUTER_MODEL} via OpenRouter...`);
  const res = await fetch(`${openrouter!.base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${openrouter!.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const msg = data.choices?.[0]?.message || {};
  if (typeof msg.content === "string" && msg.content.trim()) console.log(msg.content);
  let saved = false;
  for (const img of msg.images || []) {
    const url: string = img.image_url?.url || "";
    const m = url.match(/^data:([^;]+);base64,(.*)$/s);
    if (!m) continue;
    const ext = mime.getExtension(m[1]) || "png";
    const finalPath = outputPath.replace(/\.[^.]+$/, "") + "." + ext;
    await writeFile(finalPath, Buffer.from(m[2], "base64"));
    console.log(`Image saved: ${finalPath}`);
    saved = true;
  }
  if (data.usage?.cost !== undefined) console.log(`Cost: $${data.usage.cost}`);
  return saved;
}
// -----------------------------------------------------------------------------

async function main() {
  if (openrouter) {
    const outputPath = (values.output || "~/infographics/diagram.png").replace(/^~/, process.env.HOME || "");
    await mkdir(dirname(outputPath), { recursive: true });
    if (!(await generateViaOpenRouter(values.ref!, values.prompt!, outputPath))) {
      console.error("No image was generated. Try refining your prompt.");
      process.exit(1);
    }
    return;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Build parts array: all reference images first, then the prompt text
  const parts: Array<
    { inlineData: { mimeType: string; data: string } } | { text: string }
  > = [];

  for (const refPath of values.ref!) {
    const expandedPath = refPath.replace(/^~/, process.env.HOME || "");
    const imageBuffer = await readFile(expandedPath);
    const imageMimeType = mime.getType(expandedPath) || "image/jpeg";
    parts.push({
      inlineData: {
        mimeType: imageMimeType,
        data: imageBuffer.toString("base64"),
      },
    });
    console.log(`Loaded reference: ${refPath}`);
  }

  parts.push({ text: values.prompt! });

  const config = {
    responseModalities: ["IMAGE", "TEXT"] as const,
    thinkingConfig: { thinkingLevel: "MINIMAL" as const },
    imageConfig: { imageSize: "1K" },
  };

  console.log("Generating diagram with Gemini...");

  const response = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-image-preview",
    config,
    contents: [{ role: "user", parts }],
  });

  const outputPath = (values.output || "~/infographics/diagram.png").replace(
    /^~/,
    process.env.HOME || ""
  );
  await mkdir(dirname(outputPath), { recursive: true });

  let saved = false;
  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0]?.content?.parts) {
      continue;
    }

    for (const part of chunk.candidates[0].content.parts) {
      if (part.inlineData) {
        const ext =
          mime.getExtension(part.inlineData.mimeType || "") || "png";
        const finalPath = outputPath.replace(/\.[^.]+$/, "") + "." + ext;
        const buffer = Buffer.from(part.inlineData.data || "", "base64");
        await writeFile(finalPath, buffer);
        console.log(`Image saved: ${finalPath}`);
        saved = true;
      } else if (part.text) {
        console.log(part.text);
      }
    }
  }

  if (!saved) {
    console.error("No image was generated. Try refining your prompt.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Generation failed:", err.message || err);
  process.exit(1);
});
