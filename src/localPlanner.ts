// 本地規則版規劃器 — 不需網路、不用金鑰,直接把整個流程跑通。
// 當 Agnes API 未設定金鑰或連線失敗時,自動降級使用這個引擎,體驗完全不中斷。
// 也支援「引用使用者已上傳的影片素材」:AI 剪輯自己的影片。

import { makeAsset, uid, CLIP_COLORS } from "./assets";
import type { Asset, AspectRatio, Clip, Plan, MotionKind } from "./types";

type LocalPlan = Omit<Plan, "engine" | "apiError">;

export interface PlannerContext {
  assets?: Asset[];
  clips?: Clip[];
}

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

function detectDuration(text: string): number | null {
  // 支援「30 秒」「30s」「一分鐘」「1 分鐘」等
  const s = text.match(/(\d+(?:\.\d+)?)\s*(秒|s\b|sec|seconds?)/i);
  if (s) {
    const n = parseFloat(s[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(Math.min(600, Math.max(3, n)) * 10) / 10;
  }
  const min = text.match(/(\d+(?:\.\d+)?)\s*(分鐘|分|min|minute)/i);
  if (min) {
    const n = parseFloat(min[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(Math.min(60, Math.max(1, n)) * 60 * 10) / 10;
  }
  return null;
}

function detectAspect(text: string): AspectRatio | null {
  const l = text.toLowerCase();
  if (/(tiktok|shorts|reels|9:16|豎直|直式|直向|手機)/.test(l)) return "9:16";
  if (/(1:1|方形|正方形|square)/.test(l)) return "1:1";
  if (/(16:9|橫式|橫向|橫的|desktop|youtube|landscape)/.test(l)) return "16:9";
  return null;
}

function detectPace(text: string): "fast" | "slow" | "normal" {
  const l = text.toLowerCase();
  if (/(快節奏|節奏快|快一點|加速|fast|quick|punchy)/.test(l)) return "fast";
  if (/(慢節奏|節奏慢|慢下來|slow|calm)/.test(l)) return "slow";
  return "normal";
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

// 根據目標長度與節奏,給每段一個建議長度
function sceneLength(pace: "fast" | "slow" | "normal", i: number): number {
  if (pace === "fast") return [1.6, 1.8, 1.5, 2.0][i % 4];
  if (pace === "slow") return [4.5, 5.5, 4.0, 5.0][i % 4];
  return [2.8, 3.5, 2.5, 3.2][i % 4];
}

interface SceneSeed {
  label: string;
  asset?: Asset; // 已上傳素材;有值時直接使用
  sourceIndex: number;
}

export async function planEditLocal(
  prompt: string,
  ctx: PlannerContext = {}
): Promise<LocalPlan> {
  const theme = detectTheme(prompt);
  let count = detectCount(prompt);
  const filters = detectFilters(prompt);
  const title = detectTitle(prompt);
  const targetDuration = detectDuration(prompt);
  const pace = detectPace(prompt);
  const aspect = detectAspect(prompt);

  const videoAssets = (ctx.assets ?? []).filter((a) => a.kind === "video" && a.videoUrl);
  const wantsOwnFootage =
    videoAssets.length > 0 && !/(生成|產生|create|generate|做出一個)/i.test(prompt);
  const useOwn = wantsOwnFootage;

  const steps: string[] = [];
  const assets: LocalPlan["assets"] = [];
  const clips: Clip[] = [];

  if (useOwn) {
    steps.push(`偵測到你上傳了 ${videoAssets.length} 支影片,優先拿來剪「你自己的影片」。`);
  } else {
    steps.push(`分析需求:主題偏「${theme.palette}」、預計 ${count} 段畫面。`);
  }

  const scenes: SceneSeed[] = [];
  if (useOwn) {
    for (let i = 0; i < count; i++) {
      const a = videoAssets[i % videoAssets.length];
      scenes.push({ label: a.name, asset: a, sourceIndex: i });
    }
  } else {
    const sceneWords = ["開場", "主體", "細節", "轉場", "情緒", "高潮", "收尾", "彩蛋"];
    for (let i = 0; i < count; i++) {
      scenes.push({ label: sceneWords[i % sceneWords.length], sourceIndex: i });
    }
  }

  // 若使用者指定總長,把段落數與長度校正到接近目標
  if (targetDuration) {
    if (count > 8) count = 8;
    let per = targetDuration / count;
    if (pace === "fast") per = Math.max(1.2, Math.min(2.5, per));
    if (pace === "slow") per = Math.max(3.5, Math.min(8, per));
    steps.push(`依目標 ${targetDuration.toFixed(1)} 秒與「${pace}」節奏,調整為 ${count} 段。`);
  }

  let cursor = 0;
  scenes.forEach((sc, i) => {
    let asset: Asset;
    if (sc.asset) {
      asset = sc.asset;
    } else {
      asset = makeAsset({
        id: uid("asset"),
        name: `${sc.label} ${i + 1}`,
        kind: "generated",
        palette: theme.palette,
        motion: [theme.motion, "zoom", "drift", "pulse"][i % 4] as MotionKind,
        label: sc.label,
      });
    }
    if (!assets.some((a) => a.id === asset.id)) assets.push(asset);

    let dur = targetDuration
      ? targetDuration / count
      : sceneLength(pace, i);
    if (sc.asset) {
      dur = Math.min(dur, sc.asset.duration);
    }
    dur = Math.max(0.3, Math.min(8, dur));
    if (targetDuration) {
      // 最後一段吸收小數誤差
      if (i === scenes.length - 1) {
        const sum = cursor;
        dur = Math.max(0.3, targetDuration - sum);
      }
    }

    clips.push({
      id: uid("clip"),
      assetId: asset.id,
      start: cursor,
      length: dur,
      in: Math.min(sc.asset ? Math.max(0, cursor % Math.max(sc.asset.duration, 1)) : 0, sc.asset?.duration ?? 0),
      filters: { ...filters },
      name: asset.name,
      color: CLIP_COLORS[i % CLIP_COLORS.length],
    });
    cursor += dur;
  });

  const totalLen = cursor;
  if (title && !useOwn) {
    const a = makeAsset({
      id: uid("asset"),
      name: `標題卡:${title}`,
      kind: "title",
      palette: theme.palette,
      motion: "zoom",
      label: title,
    });
    a.titleText = title;
    assets.unshift(a);
    const dur = Math.min(2.5, Math.max(1.2, totalLen * 0.12));
    clips.unshift({
      id: uid("clip"),
      assetId: a.id,
      start: 0,
      length: dur,
      in: 0,
      filters: { ...filters },
      name: a.name,
      color: "#6c8cff",
    });
    clips.forEach((c) => {
      if (c.id !== clips[0].id) c.start += dur;
    });
    cursor += dur;
  }

  if (Object.keys(filters).length) {
    steps.push(`套用風格:${describeFilters(filters)}。`);
  }
  const ownNote = useOwn ? `使用你的 ${videoAssets.length} 支上傳影片` : `「${theme.palette}」風格`;
  steps.push(`排上時間軸,總長約 ${cursor.toFixed(1)} 秒。完成!你可以在下方審片並微調。`);

  return {
    assets,
    clips,
    filters,
    notes: steps,
    summary: `我做成一支約 ${cursor.toFixed(1)} 秒、${count} 段的「${ownNote}」草稿${title ? `,開場有標題「${title}」` : ""}。`,
    aspect: aspect ?? undefined,
    targetDuration: targetDuration ?? undefined,
  };
}
