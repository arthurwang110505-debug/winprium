// 共用型別:「規劃計畫」與「UI 渲染」之間的格式契約
// { assets, clips:[{id, assetId, start, length, in, filters, name, color}], filters, notes, summary }

export type MotionKind = "drift" | "zoom" | "sweep" | "pulse";
export type AssetKind = "generated" | "found" | "title";

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

export interface Plan {
  assets: Asset[];
  clips: Clip[];
  filters: ClipFilters;
  notes: string[];
  summary: string;
  engine: "agnes" | "local";
  apiError?: string; // Agnes 失敗時的附註(降級本地時使用)
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
