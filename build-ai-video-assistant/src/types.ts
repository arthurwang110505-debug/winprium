// 共用型別:「規劃計畫」與「UI 渲染」之間的格式契約
// { assets, clips:[{id, assetId, start, length, in, filters, name, color}], filters, notes, summary }

export type MotionKind = "drift" | "zoom" | "sweep" | "pulse";
export type AssetKind = "generated" | "found" | "title" | "video" | "image";
export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  palette: string;
  motion: MotionKind;
  label: string;
  seed: number;
  duration: number; // 素材可用長度(秒)
  titleText?: string;
  videoUrl?: string; // 使用者上傳的影片素材(Blob URL)
  imageUrl?: string; // AI 生成的圖片素材(data URL 或遠端 URL)
}

export interface ClipFilters {
  brightness?: number; // -100 ~ 100
  warmth?: number; // -100(冷) ~ 100(暖)
  vignette?: number; // 0 ~ 100
  grayscale?: boolean;
  caption?: string;
}

export interface Clip {
  id: string;
  assetId: string;
  start: number; // 時間軸上的起點(秒)
  length: number; // 片段長度(秒)
  in: number; // 從素材內部第幾秒開始取
  filters: ClipFilters;
  name: string;
  color: string;
}

export interface SubtitleClip {
  id: string;
  start: number; // 時間軸起點(秒)
  length: number; // 顯示秒數
  text: string;
  style?: SubtitleStyle;
}

export interface SubtitleStyle {
  size?: number; // 字體大小(比例,預設 0.05)
  color?: string;
  background?: string;
  position?: "bottom" | "center" | "top";
}

export type AudioSource = "preset" | "upload";

export interface AudioClip {
  id: string;
  name: string;
  start: number;
  length: number;
  in: number; // 從音訊內部第幾秒開始取
  volume: number; // 0~1
  loop: boolean;
  source: AudioSource;
  preset?: string; // source=preset 時用
  url?: string; // source=upload 時用(Blob URL)
  color?: string;
}

export interface AudioPresetInfo {
  key: string;
  name: string;
  duration: number;
}

export interface Plan {
  assets: Asset[];
  clips: Clip[];
  filters: ClipFilters;
  notes: string[];
  summary: string;
  engine: "agnes" | "local";
  apiError?: string; // Agnes 失敗時的附註(降級本地時使用)
  aspect?: AspectRatio; // 選填:AI 判斷的畫布比例(16:9 / 9:16 / 1:1)
  targetDuration?: number; // 選填:使用者要求的目標長度(秒)
}

export interface ChatMsg {
  role: "user" | "ai";
  text: string;
  steps?: string[];
  streaming?: boolean;
  engine?: "agnes" | "local";
}

export interface AgnesSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  keySource: "env" | "local" | null;
}
