// 程序化素材產生器 — 每個素材都是「可在 canvas 上逐格畫出來」的動畫,不需要下載真實影片檔。
// 之後要接真正的 AI 生成 / 素材庫,只要把這裡的 render 換成貼上真實影格即可。

import type { Asset, AssetKind, ClipFilters, MotionKind } from "./types";

export const PALETTES: Record<string, string[]> = {
  sunset: ["#ff7e5f", "#feb47b", "#ff5f6d", "#ffc371"],
  ocean: ["#2193b0", "#6dd5ed", "#1a2980", "#26d0ce"],
  forest: ["#134e5e", "#71b280", "#0f3d3e", "#57cc99"],
  city: ["#232526", "#414345", "#5a3f37", "#2c3e50"],
  candy: ["#f857a6", "#ff5858", "#a18cd1", "#fbc2eb"],
  mono: ["#111111", "#333333", "#555555", "#888888"],
  neon: ["#0f0c29", "#302b63", "#24243e", "#ff00cc"],
};

export const MOTIONS: MotionKind[] = ["drift", "zoom", "sweep", "pulse"];

export const CLIP_COLORS = ["#46e0b8", "#6c8cff", "#ffb347", "#ff6b7a", "#a18cd1"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function makeAsset(opts: {
  id: string;
  name: string;
  kind?: AssetKind;
  palette?: string;
  motion?: MotionKind;
  label?: string;
  seed?: number;
}): Asset {
  const { id, name } = opts;
  return {
    id,
    name,
    kind: opts.kind ?? "generated",
    palette: opts.palette ?? "ocean",
    motion: opts.motion ?? "drift",
    label: opts.label ?? name,
    seed: opts.seed ?? hashStr(name || id),
    duration: 6,
  };
}

// 在 ctx 上畫出某素材在 localT(0..1 相對於該素材內部時間)時的一格畫面
export function drawAssetFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  asset: Asset,
  localT: number,
  filters: ClipFilters = {}
): void {
  const colors = PALETTES[asset.palette] || PALETTES.ocean;
  const seed = asset.seed;
  const t = localT;

  // 背景漸層(隨時間微幅移動)
  const g = ctx.createLinearGradient(0, 0, w, h);
  const shift = (Math.sin(t * Math.PI * 2) + 1) / 2;
  g.addColorStop(0, pick(colors, seed));
  g.addColorStop(Math.min(0.99, 0.4 + shift * 0.3), pick(colors, seed + 1));
  g.addColorStop(1, pick(colors, seed + 2));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 動態元素
  ctx.save();
  if (asset.motion === "drift") {
    for (let i = 0; i < 6; i++) {
      const px = ((i * 137 + seed * 13) % w) + Math.sin(t * 6.28 + i) * 40;
      const py = ((i * 91 + seed * 7) % h) + Math.cos(t * 6.28 + i) * 30;
      const r = 40 + ((i * 17 + seed) % 60);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = pick(colors, seed + i + 3);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (asset.motion === "zoom") {
    const scale = 1 + t * 0.4;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = pick(colors, seed + 2);
    ctx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
  } else if (asset.motion === "sweep") {
    const x = t * (w + 300) - 150;
    const grad = ctx.createLinearGradient(x - 150, 0, x + 150, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (asset.motion === "pulse") {
    const r = (Math.sin(t * Math.PI * 4) + 1) / 2;
    ctx.globalAlpha = 0.2 + r * 0.3;
    ctx.fillStyle = pick(colors, seed + 1);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 80 + r * 120, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 濾鏡(調色 / 暗角 / 黑白)
  applyFilters(ctx, w, h, filters);

  // 標題卡文字
  if (asset.kind === "title" || asset.titleText) {
    drawTitle(ctx, w, h, asset.titleText || asset.label, t);
  }

  // 字幕
  if (filters.caption) {
    drawCaption(ctx, w, h, filters.caption);
  }
}

function applyFilters(ctx: CanvasRenderingContext2D, w: number, h: number, f: ClipFilters): void {
  if (f.grayscale) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (f.warmth) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, Math.abs(f.warmth) / 100);
    ctx.fillStyle = f.warmth > 0 ? "#ff9a3c" : "#3ca8ff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (f.vignette) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, f.vignette / 100)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (f.brightness && f.brightness !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = f.brightness > 0 ? "lighter" : "multiply";
    const v = Math.min(1, Math.abs(f.brightness) / 100);
    ctx.fillStyle =
      f.brightness > 0 ? `rgba(255,255,255,${v * 0.5})` : `rgba(0,0,0,${v * 0.6})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, t: number): void {
  const alpha = Math.min(1, t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, h * 0.38, w, h * 0.24);
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.floor(h * 0.09)}px "Sora", "Noto Sans TC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, w: number, h: number, text: string): void {
  ctx.save();
  ctx.font = `600 ${Math.floor(h * 0.05)}px "Sora", "Noto Sans TC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const y = h * 0.92;
  const metrics = ctx.measureText(text);
  const pad = 14;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(w / 2 - metrics.width / 2 - pad, y - h * 0.06, metrics.width + pad * 2, h * 0.07);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, w / 2, y);
  ctx.restore();
}
