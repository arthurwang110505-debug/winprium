// Agnes AI 規劃引擎 — OpenAI 相容格式
// Base URL: https://apihub.agnes-ai.com  →  POST {base}/v1/chat/completions
// 金鑰來源優先序: 介面設定(localStorage) > 環境變數 VITE_AGNES_API_KEY
// 回傳格式遵守契約: { assets, clips, filters, notes, summary }

import { makeAsset, uid, CLIP_COLORS, PALETTES, MOTIONS } from "./assets";
import type { AgnesSettings, Asset, AspectRatio, Clip, ClipFilters, MotionKind, Plan } from "./types";
import type { PlannerContext } from "./localPlanner";

export const DEFAULT_BASE_URL = "https://apihub.agnes-ai.com";
export const DEFAULT_MODEL = "agnes-2.5-flash";
export const MODEL_PRESETS = ["agnes-2.5-flash", "agnes-2.0-flash", "agnes-2.5-pro"];

const LS_KEY = "agnes.apiKey";
const LS_BASE = "agnes.baseUrl";
const LS_MODEL = "agnes.model";

type LocalPlan = Omit<Plan, "engine" | "apiError">;

function envVal(
  k: "VITE_AGNES_API_KEY" | "VITE_AGNES_BASE_URL" | "VITE_AGNES_MODEL" | "VITE_AGNES_API_PROXY"
): string {
  return (import.meta.env[k] ?? "").trim();
}

function lsGet(k: string): string {
  try {
    return (localStorage.getItem(k) ?? "").trim();
  } catch {
    return "";
  }
}

export function getSettings(): AgnesSettings {
  const lsKey = lsGet(LS_KEY);
  const envKey = envVal("VITE_AGNES_API_KEY");
  return {
    apiKey: lsKey || envKey,
    baseUrl: lsGet(LS_BASE) || envVal("VITE_AGNES_BASE_URL") || DEFAULT_BASE_URL,
    model: lsGet(LS_MODEL) || envVal("VITE_AGNES_MODEL") || DEFAULT_MODEL,
    keySource: lsKey ? "local" : envKey ? "env" : null,
  };
}

export function hasApiKey(): boolean {
  return getSettings().apiKey.length > 0;
}

export function saveSettings(input: { apiKey: string; baseUrl: string; model: string }): void {
  const set = (k: string, v: string) => {
    try {
      const t = v.trim();
      if (t) localStorage.setItem(k, t);
      else localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  };
  set(LS_KEY, input.apiKey);
  set(LS_BASE, input.baseUrl);
  set(LS_MODEL, input.model);
}

function authHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

// 計算最終 endpoint:
// 1. 若設定 VITE_AGNES_API_PROXY,把請求轉給後端代理(OpenAI 相容),避免 API Key 暴露在瀏覽器
// 2. 否則直接打 Agnes 的 /v1/chat/completions
export function getEndpoint(base: string): string {
  const proxy = envVal("VITE_AGNES_API_PROXY").replace(/\/+$/, "");
  return proxy || `${base.replace(/\/+$/, "")}/v1/chat/completions`;
}

// 是否有走後端代理(公開部署時金鑰在伺服器)
export function isUsingProxy(): boolean {
  return envVal("VITE_AGNES_API_PROXY").length > 0;
}

// ---- 測試連線(給設定視窗用) ----
export async function testConnection(over?: Partial<AgnesSettings>): Promise<string> {
  const s = getSettings();
  const key = (over?.apiKey ?? s.apiKey).trim();
  const base = (over?.baseUrl ?? s.baseUrl).trim();
  const model = (over?.model ?? s.model).trim();
  if (!key) throw new Error("請先填入 API 金鑰");
  const res = await fetch(getEndpoint(base), {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`);
  return `連線成功(${model})`;
}

// ---- 給 Agnes 的系統提示詞:嚴格規定 JSON 輸出格式 ----
const SYSTEM_PROMPT = `你是 Winprium「AI 剪輯助理」的剪輯規劃引擎。使用者會用一句話描述想要的影片。
你只輸出「一個 JSON 物件」,不要任何解說文字、不要 markdown 圍欄,格式如下:
{
  "summary": string,            // 繁體中文,一句話總結你規劃的草稿
  "notes": string[],            // 3~6 條繁體中文步驟,描述你的規劃過程(像 agent 的行動紀錄)
  "aspect"?: "16:9"|"9:16"|"1:1",  // 選填:使用者要求直式(TikTok/Shorts)、方形或橫式時給
  "targetDuration"?: number,      // 選填:使用者要求總秒數時給
  "globalFilters": {            // 只在使用者要求風格時才給值,否則給 {}
    "brightness"?: number,      // -100~100
    "warmth"?: number,          // -100 冷 ~ 100 暖
    "vignette"?: number,        // 0~100 電影暗角
    "grayscale"?: boolean
  },
  "scenes": [                   // 2~8 幕;若使用者指定段數,務必遵守
    {
      "name": string,           // 繁體中文片段名(簡短,例如「開場海浪」)
      "duration": number,       // 秒,1.5~6;若使用者指定總長,調到總長相符
      "palette": "sunset"|"ocean"|"forest"|"city"|"candy"|"mono"|"neon",
      "motion": "drift"|"zoom"|"sweep"|"pulse",
      "kind": "title"|"scene",  // title 只可用於第一幕(標題卡)
      "title": string,          // 僅 kind=title 需要,標題文字(<=20字)
      "caption": string,        // 選填,該幕字幕(<=16字),不需要就省略
      "sourceAssetId": string,  // 選填:若素材清單有「上傳影片」且要用它,直接填該 id
      "sourceIn": number        // 選填:從該素材的第幾秒開始取(預設 0),必須小於素材長度
    }
  ]
}
規則:整體 palette 依主題選擇,各幕可有層次變化;若使用者用「」指定標題,第一幕用 kind=title 並帶上 title;
motion 的語意:drift=緩慢漂浮、zoom=推近、sweep=掃光、pulse=脈動;全部使用繁體中文;只回傳 JSON。`;

function buildUserPrompt(prompt: string, ctx: PlannerContext): string {
  const vids = (ctx.assets ?? []).filter((a) => a.kind === "video" && a.videoUrl);
  if (!vids.length) return prompt;
  const list = vids
    .map((a) => `- id="${a.id}" name="${a.name}" duration=${a.duration.toFixed(1)}s`)
    .join("\n");
  return (
    `${prompt}\n\n以下是使用者已上傳的影片素材(若要剪「自己的影片」,優先使用這些素材):\n${list}\n` +
    `若要用某支素材,請在對應 scene 填 sourceAssetId="${vids[0].id}" 一類的 id,並讓 duration ≤ 該素材長度。` +
    `若使用者要求「生成 / 做」新素材,則不要使用 sourceAssetId。`
  );
}

interface RawScene {
  name?: unknown;
  duration?: unknown;
  palette?: unknown;
  motion?: unknown;
  kind?: unknown;
  title?: unknown;
  caption?: unknown;
  sourceAssetId?: unknown;
  sourceIn?: unknown;
}

interface RawSpec {
  summary?: unknown;
  notes?: unknown;
  globalFilters?: unknown;
  scenes?: unknown;
  aspect?: unknown;
  targetDuration?: unknown;
}

function clampNum(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
}

function asStr(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

function sanitizeFilters(raw: unknown): ClipFilters {
  const f: ClipFilters = {};
  if (!raw || typeof raw !== "object") return f;
  const r = raw as Record<string, unknown>;
  if (r.brightness !== undefined) {
    const v = clampNum(r.brightness, 0, -100, 100);
    if (v !== 0) f.brightness = Math.round(v);
  }
  if (r.warmth !== undefined) {
    const v = clampNum(r.warmth, 0, -100, 100);
    if (v !== 0) f.warmth = Math.round(v);
  }
  if (r.vignette !== undefined) {
    const v = clampNum(r.vignette, 0, 0, 100);
    if (v > 0) f.vignette = Math.round(v);
  }
  if (r.grayscale === true) f.grayscale = true;
  return f;
}

function sanitizeAspect(raw: unknown): AspectRatio | null {
  return raw === "9:16" || raw === "1:1" || raw === "16:9" ? raw : null;
}

function sanitizeScenes(raw: unknown): {
  name: string;
  duration: number;
  palette: string;
  motion: MotionKind;
  kind: "title" | "scene";
  title: string | null;
  caption: string | null;
  sourceAssetId: string | null;
  sourceIn: number;
}[] {
  if (!Array.isArray(raw)) throw new Error("AI 回傳缺少 scenes 陣列");
  const paletteKeys = Object.keys(PALETTES);
  const scenes = (raw as RawScene[]).slice(0, 8).map((s, i) => {
    const paletteRaw = typeof s.palette === "string" ? s.palette.toLowerCase() : "";
    const motionRaw = typeof s.motion === "string" ? s.motion.toLowerCase() : "";
    return {
      name: asStr(s.name, 24) ?? `鏡頭 ${i + 1}`,
      duration: clampNum(s.duration, 2.8, 1.5, 6),
      palette: paletteKeys.includes(paletteRaw) ? paletteRaw : paletteKeys[i % paletteKeys.length],
      motion: (MOTIONS as string[]).includes(motionRaw) ? (motionRaw as MotionKind) : "drift",
      kind: i === 0 && s.kind === "title" ? ("title" as const) : ("scene" as const),
      title: asStr(s.title, 20),
      caption: asStr(s.caption, 16),
      sourceAssetId: asStr(s.sourceAssetId, 80),
      sourceIn: clampNum(s.sourceIn, 0, 0, 600),
    };
  });
  if (scenes.length < 2) throw new Error("AI 回傳的段落不足");
  return scenes;
}

// ---- 強韌 JSON:直接解析 → 去除尾逗號 → 配對大括號 ----
function stripCodeFence(text: string): string {
  return text.replace(/```(?:json)?/gi, "").replace(/`/g, "").trim();
}

function removeTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, "$1");
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("AI 回傳內容找不到 JSON");
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("AI 回傳的 JSON 沒有完整結束");
}

function parseLooseJson<T>(text: string): T {
  const fenced = stripCodeFence(text);
  const raw = extractJsonObject(fenced);
  const attempts: string[] = [raw];
  const tidied = removeTrailingCommas(raw);
  if (tidied !== raw) attempts.push(tidied);
  let lastErr: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI 回傳的 JSON 無法解析");
}

async function callAgnes(
  base: string,
  key: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(getEndpoint(base), {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify(payload),
  });
}

export async function planWithAgnes(
  prompt: string,
  ctx: PlannerContext = {}
): Promise<LocalPlan> {
  const s = getSettings();
  if (!s.apiKey) throw new Error("未設定 Agnes API 金鑰");
  const base = s.baseUrl.replace(/\/+$/, "");

  const user = buildUserPrompt(prompt, ctx);
  const payload: Record<string, unknown> = {
    model: s.model,
    temperature: 0.6,
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
  };

  const run = async (buf: Record<string, unknown>) => {
    let res = await callAgnes(base, s.apiKey, {
      ...buf,
      response_format: { type: "json_object" },
    });
    if (!res.ok && res.status >= 400 && res.status < 500) {
      res = await callAgnes(base, s.apiKey, buf);
    }
    if (!res.ok) throw new Error(`Agnes API ${res.status} — ${(await res.text()).slice(0, 140)}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Agnes 回傳了空白內容");
    return parseLooseJson<RawSpec>(content);
  };

  let spec: RawSpec;
  try {
    spec = await run(payload);
    // 驗證 scenes 結構;失敗就重試一次
    sanitizeScenes(spec.scenes);
  } catch (err) {
    const retryPayload: Record<string, unknown> = {
      ...payload,
      max_tokens: 2400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n(上一個回應不是合法 JSON。這次請只回傳一個可被 JSON.parse 的物件,絕對不要加任何文字或 markdown。)" },
        { role: "user", content: user },
      ],
    };
    spec = await run(retryPayload);
  }

  const scenes = sanitizeScenes(spec.scenes);
  const filters = sanitizeFilters(spec.globalFilters);
  const aspect = sanitizeAspect(spec.aspect);
  const targetDuration = clampNum(spec.targetDuration, 0, 0, 600);

  // ---- 把 AI 的規劃轉成契約格式 { assets, clips, ... } ----
  const assets: LocalPlan["assets"] = [];
  const clips: Clip[] = [];
  const ctxAssets = ctx.assets ?? [];
  const assetMap: Record<string, Asset> = {};
  for (const a of ctxAssets) assetMap[a.id] = a;

  let cursor = 0;
  scenes.forEach((sc, i) => {
    const source = sc.sourceAssetId ? assetMap[sc.sourceAssetId] : null;
    const isTitle = !source && sc.kind === "title";

    const asset: Asset =
      source ??
      makeAsset({
        id: uid("asset"),
        name: isTitle ? `標題卡:${sc.title ?? sc.name}` : sc.name,
        kind: "generated",
        palette: sc.palette,
        motion: isTitle ? "zoom" : sc.motion,
        label: sc.title ?? sc.name,
      });

    if (!assets.some((a) => a.id === asset.id)) assets.push(asset);

    const duration = Math.min(Math.max(0.3, sc.duration), Math.max(0.3, asset.duration));
    clips.push({
      id: uid("clip"),
      assetId: asset.id,
      start: cursor,
      length: duration,
      in: Math.min(sc.sourceIn, asset.duration),
      filters: { ...filters, ...(sc.caption ? { caption: sc.caption } : {}) },
      name: asset.name,
      color: CLIP_COLORS[i % CLIP_COLORS.length],
    });
    cursor += duration;
  });

  const notes =
    Array.isArray(spec.notes) && spec.notes.length
      ? (spec.notes.filter((n) => typeof n === "string" && n.trim()) as string[]).slice(0, 8)
      : [`Agnes 分析了你的需求,規劃了 ${scenes.length} 幕。`, `排上時間軸,總長約 ${cursor.toFixed(1)} 秒。`];

  const summary =
    asStr(spec.summary, 120) ??
    `Agnes 幫你規劃了約 ${cursor.toFixed(1)} 秒、${scenes.length} 段的草稿,可以開始審片了。`;

  return {
    assets,
    clips,
    filters,
    notes,
    summary,
    aspect: aspect ?? undefined,
    targetDuration: targetDuration > 0 ? targetDuration : undefined,
  };
}
