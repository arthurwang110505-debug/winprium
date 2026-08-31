// 本地規則版規劃器 — 不需網路、不用金鑰,直接把整個流程跑通。
// 當 Agnes API 未設定金鑰或連線失敗時,自動降級使用這個引擎,體驗完全不中斷。

import { makeAsset, uid, CLIP_COLORS } from "./assets";
import type { Clip, Plan, MotionKind } from "./types";

type LocalPlan = Omit<Plan, "engine" | "apiError">;

const THEME_MAP: { kw: string[]; palette: string; motion: MotionKind }[] = [
  { kw: ["海", "海洋", "海邊", "ocean", "sea", "beach", "浪"], palette: "ocean", motion: "drift" },
  { kw: ["日落", "夕陽", "黃昏", "sunset", "golden"], palette: "sunset", motion: "zoom" },
  { kw: ["森林", "山", "自然", "forest", "nature", "綠"], palette: "forest", motion: "drift" },
  { kw: ["城市", "都市", "街", "city", "urban", "夜景"], palette: "city", motion: "sweep" },
  { kw: ["可愛", "甜", "粉", "candy", "cute", "美食"], palette: "candy", motion: "pulse" },
  { kw: ["科技", "未來", "霓虹", "neon", "tech", "cyber"], palette: "neon", motion: "sweep" },
  { kw: ["黑白", "復古", "電影感", "mono", "cinematic"], palette: "mono", motion: "zoom" },
];

function detectTheme(text: string): { palette: string; motion: MotionKind } {
  const lower = text.toLowerCase();
  for (const t of THEME_MAP) {
    if (t.kw.some((k) => lower.includes(k.toLowerCase()))) return { palette: t.palette, motion: t.motion };
  }
  return { palette: "ocean", motion: "drift" };
}

function detectCount(text: string): number {
  const m = text.match(/(\d+)\s*(個|段|clip|clips|scene|scenes|鏡|幕)/i);
  if (m) return Math.max(2, Math.min(8, parseInt(m[1], 10)));
  return 4;
}

function detectFilters(text: string): Record<string, number | boolean> {
  const f: Record<string, number | boolean> = {};
  const l = text.toLowerCase();
  if (/(黑白|復古|mono|grayscale|b&w)/.test(l)) f.grayscale = true;
  if (/(溫暖|暖色|warm|夕陽|日落)/.test(l)) f.warmth = 40;
  if (/(冷色|冷調|cool|藍調)/.test(l)) f.warmth = -35;
  if (/(電影感|暗角|vignette|cinematic)/.test(l)) f.vignette = 55;
  if (/(明亮|亮一點|bright)/.test(l)) f.brightness = 30;
  if (/(暗|暗一點|dark|dim)/.test(l)) f.brightness = -30;
  return f;
}

function detectTitle(text: string): string | null {
  const m = text.match(/[「"“']([^」"”']{1,20})[」"”']/);
  return m ? m[1] : null;
}

export function describeFilters(f: Record<string, unknown>): string {
  const parts: string[] = [];
  if (f.grayscale) parts.push("黑白");
  if (typeof f.warmth === "number" && f.warmth > 0) parts.push("暖色調");
  if (typeof f.warmth === "number" && f.warmth < 0) parts.push("冷色調");
  if (f.vignette) parts.push("電影暗角");
  if (typeof f.brightness === "number" && f.brightness > 0) parts.push("提亮");
  if (typeof f.brightness === "number" && f.brightness < 0) parts.push("壓暗");
  return parts.join("、") || "無";
}

export async function planEditLocal(prompt: string): Promise<LocalPlan> {
  const theme = detectTheme(prompt);
  const count = detectCount(prompt);
  const filters = detectFilters(prompt);
  const title = detectTitle(prompt);

  const steps: string[] = [];
  const assets: LocalPlan["assets"] = [];
  const clips: Clip[] = [];

  steps.push(`分析需求:主題偏「${theme.palette}」、預計 ${count} 段畫面。`);

  const wantGenerate = /(生成|產生|做一個|generate|create)/.test(prompt.toLowerCase());
  const sourceLabel = wantGenerate ? "AI 生成" : "素材庫尋找";
  steps.push(`${sourceLabel} ${count} 段素材中…`);

  const sceneWords = ["開場", "主體", "細節", "轉場", "情緒", "高潮", "收尾", "彩蛋"];
  let cursor = 0;

  if (title) {
    const a = makeAsset({
      id: uid("asset"),
      name: `標題卡:${title}`,
      kind: "title",
      palette: theme.palette,
      motion: "zoom",
      label: title,
    });
    a.titleText = title;
    assets.push(a);
    const dur = 2.5;
    clips.push({
      id: uid("clip"),
      assetId: a.id,
      start: cursor,
      length: dur,
      in: 0,
      filters: { ...filters },
      name: a.name,
      color: "#6c8cff",
    });
    cursor += dur;
    steps.push(`加入開場標題卡「${title}」。`);
  }

  for (let i = 0; i < count; i++) {
    const a = makeAsset({
      id: uid("asset"),
      name: `${sceneWords[i % sceneWords.length]} ${i + 1}`,
      kind: wantGenerate ? "generated" : "found",
      palette: theme.palette,
      motion: [theme.motion, "zoom", "drift", "pulse"][i % 4] as MotionKind,
      label: `${sceneWords[i % sceneWords.length]}`,
    });
    assets.push(a);

    const dur = 2.5 + (i % 3) * 0.7;
    clips.push({
      id: uid("clip"),
      assetId: a.id,
      start: cursor,
      length: dur,
      in: 0,
      filters: { ...filters },
      name: a.name,
      color: CLIP_COLORS[i % CLIP_COLORS.length],
    });
    cursor += dur;
  }

  if (Object.keys(filters).length) {
    steps.push(`套用風格:${describeFilters(filters)}。`);
  }
  steps.push(`排上時間軸,總長約 ${cursor.toFixed(1)} 秒。完成!你可以在下方審片並微調。`);

  return {
    assets,
    clips,
    filters,
    notes: steps,
    summary: `我幫你做了一個約 ${cursor.toFixed(1)} 秒、${count} 段的「${theme.palette}」風格草稿${title ? `,開場有標題「${title}」` : ""}。`,
  };
}
