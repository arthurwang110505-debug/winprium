// Agnes AI 規劃引擎 — OpenAI 相容格式
// Base URL: https://apihub.agnes-ai.com  →  POST {base}/v1/chat/completions
// 金鑰來源優先序: 介面設定(localStorage) > 環境變數 VITE_AGNES_API_KEY
// 回傳格式遵守契約: { assets, clips, filters, notes, summary }

import { makeAsset, uid, CLIP_COLORS, PALETTES, MOTIONS } from "./assets";
import type { AgnesSettings, Clip, ClipFilters, MotionKind, Plan } from "./types";

export const DEFAULT_BASE_URL = "https://apihub.agnes-ai.com";
export const DEFAULT_MODEL = "agnes-2.5-flash";
export const MODEL_PRESETS = ["agnes-2.5-flash", "agnes-2.0-flash", "agnes-2.5-pro"];

const LS_KEY = "agnes.apiKey";
const LS_BASE = "agnes.baseUrl";
const LS_MODEL = "agnes.model";

type LocalPlan = Omit<Plan, "engine" | "apiError">;

function envVal(k: "VITE_AGNES_API_KEY" | "VITE_AGNES_BASE_URL" | "VITE_AGNES_MODEL"): string {
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

// ---- 測試連線(給設定視窗用) ----
export async function testConnection(over?: Partial<AgnesSettings>): Promise<string> {
  const s = getSettings();
  const key = (over?.apiKey ?? s.apiKey).trim();
  const base = (over?.baseUrl ?? s.baseUrl).trim().replace(/\/+$/, "");
  const model = (over?.model ?? s.model).trim();
  if (!key) throw new Error("請先填入 API 金鑰");
  const res = await fetch(`${base}/v1/chat/completions`, {
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
  "globalFilters": {            // 只在使用者要求風格時才給值,否則給 {}
    "brightness"?: number,      // -100~100
    "warmth"?: number,          // -100 冷 ~ 100 暖
    "vignette"?: number,        // 0~100 電影暗角
    "grayscale"?: boolean
  },
  "scenes": [                   // 2~8 幕;若使用者指定段數,務必遵守
    {
      "name": string,           // 繁體中文片段名(簡短,例如「開場海浪」)
      "duration": number,       // 秒,1.5~6
      "palette": "sunset"|"ocean"|"forest"|"city"|"candy"|"mono"|"neon",
      "motion": "drift"|"zoom"|"sweep"|"pulse",
      "kind": "title"|"scene",  // title 只可用於第一幕(標題卡)
      "title": string,          // 僅 kind=title 需要,標題文字(<=20字)
      "caption": string         // 選填,該幕字幕(<=16字),不需要就省略
    }
  ]
}
規則:整體 palette 依主題選擇,各幕可有層次變化;若使用者用「」指定標題,第一幕用 kind=title 並帶上 title;
motion 的語意:drift=緩慢漂浮、zoom=推近、sweep=掃光、pulse=脈動;全部使用繁體中文;只回傳 JSON。`;

interface RawScene {
  name?: unknown;
  duration?: unknown;
  palette?: unknown;
  motion?: unknown;
  kind?: unknown;
  title?: unknown;
  caption?: unknown;
}

interface RawSpec {
  summary?: unknown;
  notes?: unknown;
  globalFilters?: unknown;
  scenes?: unknown;
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

function sanitizeScenes(raw: unknown): Required<{
  name: string;
  duration: number;
  palette: string;
  motion: MotionKind;
  kind: "title" | "scene";
  title: string | null;
  caption: string | null;
}>[] {
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
    };
  });
  if (scenes.length < 2) throw new Error("AI 回傳的段落不足");
  return scenes;
}

// 從 AI 回傳的文字中 robust 地抽出 JSON
function extractJson(text: string): RawSpec {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 回傳內容找不到 JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as RawSpec;
}

async function callAgnes(
  base: string,
  key: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify(payload),
  });
}

export async function planWithAgnes(prompt: string): Promise<LocalPlan> {
  const s = getSettings();
  if (!s.apiKey) throw new Error("未設定 Agnes API 金鑰");
  const base = s.baseUrl.replace(/\/+$/, "");

  const payload: Record<string, unknown> = {
    model: s.model,
    temperature: 0.7,
    max_tokens: 1600,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  };

  // 先嘗試帶 response_format(OpenAI JSON mode);若伺服器不支援就降級重試
  let res = await callAgnes(base, s.apiKey, {
    ...payload,
    response_format: { type: "json_object" },
  });
  if (!res.ok && res.status >= 400 && res.status < 500) {
    res = await callAgnes(base, s.apiKey, payload);
  }
  if (!res.ok) {
    throw new Error(`Agnes API ${res.status} — ${(await res.text()).slice(0, 140)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Agnes 回傳了空白內容");

  const spec = extractJson(content);
  const scenes = sanitizeScenes(spec.scenes);
  const filters = sanitizeFilters(spec.globalFilters);

  // ---- 把 AI 的規劃轉成契約格式 { assets, clips, ... } ----
  const assets: LocalPlan["assets"] = [];
  const clips: Clip[] = [];
  let cursor = 0;

  scenes.forEach((sc, i) => {
    const isTitle = sc.kind === "title";
    const a = makeAsset({
      id: uid("asset"),
      name: isTitle ? `標題卡:${sc.title ?? sc.name}` : sc.name,
      kind: isTitle ? "title" : "generated",
      palette: sc.palette,
      motion: isTitle ? "zoom" : sc.motion,
      label: sc.title ?? sc.name,
    });
    if (isTitle) a.titleText = sc.title ?? sc.name;
    assets.push(a);

    clips.push({
      id: uid("clip"),
      assetId: a.id,
      start: cursor,
      length: sc.duration,
      in: 0,
      filters: { ...filters, ...(sc.caption ? { caption: sc.caption } : {}) },
      name: a.name,
      color: CLIP_COLORS[i % CLIP_COLORS.length],
    });
    cursor += sc.duration;
  });

  const notes =
    Array.isArray(spec.notes) && spec.notes.length
      ? (spec.notes.filter((n) => typeof n === "string" && n.trim()) as string[]).slice(0, 8)
      : [`Agnes 分析了你的需求,規劃了 ${scenes.length} 幕。`, `排上時間軸,總長約 ${cursor.toFixed(1)} 秒。`];

  const summary =
    asStr(spec.summary, 120) ??
    `Agnes 幫你規劃了約 ${cursor.toFixed(1)} 秒、${scenes.length} 段的草稿,可以開始審片了。`;

  return { assets, clips, filters, notes, summary };
}
