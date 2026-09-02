// Agnes 圖 / 影片生成客户端
// 支援兩種模式:
//   proxy 模式(公開部署):POST 到 VITE_AGNES_API_PROXY(通常 /api/agnes),body 帶 _kind
//   直連模式:直接打 Agnes 的 /v1/images/generations 與 /v1/videos
// 影片走非同步:先建立任務,再取得 video_id,由 UI 輪詢進度。

import { getSettings, isUsingProxy } from "./agnes";

const DEFAULT_BASE = "https://apihub.agnes-ai.com";

export const IMAGE_MODELS = ["agnes-image-2.1-flash", "agnes-image-2.0-flash"];
export const VIDEO_MODELS = ["agnes-video-v2.0", "agnes-video-2.5-flash"];

interface MediaCallOptions {
  _kind: string;
  [key: string]: unknown;
}

function headers(): Record<string, string> {
  const s = getSettings();
  return { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` };
}

async function callMedia(body: MediaCallOptions): Promise<Record<string, unknown>> {
  const s = getSettings();
  let url: string;
  if (isUsingProxy()) {
    // 後端代理:統一打到 proxy,用 _kind 區分
    url = (import.meta.env.VITE_AGNES_API_PROXY as string | undefined || "/api/agnes").replace(/\/+$/, "");
  } else {
    const base = (s.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
    if (body._kind === "image") url = `${base}/v1/images/generations`;
    else if (body._kind === "video") url = `${base}/v1/videos`;
    else throw new Error(`不支援的媒體端點:${body._kind}`);
  }
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Agnes 媒體 API ${res.status} — ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as Record<string, unknown>;
}

function pickUrl(data: Record<string, unknown>): string | null {
  // 常見回傳欄位:data[0].url / data[0].b64_json / url / images
  const d = data.data as { url?: string; b64_json?: string }[] | undefined;
  if (Array.isArray(d) && d[0]) {
    if (typeof d[0].url === "string" && d[0].url) return d[0].url;
    if (typeof d[0].b64_json === "string" && d[0].b64_json) return `data:image/png;base64,${d[0].b64_json}`;
  }
  if (typeof data.url === "string" && data.url) return data.url;
  const images = data.images as { url?: string; b64_json?: string }[] | undefined;
  if (Array.isArray(images) && images[0]?.url) return images[0].url;
  return null;
}

export interface GeneratedImage {
  url: string;
  base64?: string;
}

export async function generateImage(prompt: string, size = "1024x1024"): Promise<GeneratedImage> {
  const data = await callMedia({ _kind: "image", model: IMAGE_MODELS[0], prompt, size });
  const url = pickUrl(data);
  if (!url) throw new Error("Agnes 圖片生成沒有回傳圖片網址");
  return { url };
}

export interface CreatedVideo {
  taskId: string;
  status: string;
}

export async function generateVideo(prompt: string, duration = 5): Promise<CreatedVideo> {
  const data = await callMedia({
    _kind: "video",
    model: VIDEO_MODELS[0],
    prompt,
    duration,
    num_frames: Math.max(24, Math.round(duration * 24)),
    frame_rate: 24,
  });
  const id =
    (data.video_id as string) ||
    (data.task_id as string) ||
    (data.id as string) ||
    (data.data && typeof (data.data as Record<string, unknown>).id === "string"
      ? ((data.data as Record<string, unknown>).id as string)
      : "");
  if (!id) throw new Error("Agnes 影片生成沒有回傳影片 ID");
  return { taskId: id, status: String(data.status ?? data.state ?? "processing") };
}

export interface VideoStatus {
  status: string;
  url: string | null;
  error: string | null;
}

export async function getVideoStatus(taskId: string): Promise<VideoStatus> {
  const s = getSettings();
  if (isUsingProxy()) {
    // POST 到 proxy,body 帶 _kind=video_status 與 task_id
    const res = await fetch((import.meta.env.VITE_AGNES_API_PROXY as string | undefined || "/api/agnes").replace(/\/+$/, ""), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ _kind: "video_status", task_id: taskId }),
    });
    if (!res.ok) throw new Error(`Agnes 影片狀態 ${res.status} — ${(await res.text()).slice(0, 160)}`);
    const d = (await res.json()) as Record<string, unknown>;
    return normalizeVideoStatus(d);
  } else {
    const base = (s.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
    const res = await fetch(`${base}/agnesapi?video_id=${encodeURIComponent(taskId)}`, {
      headers: headers(),
    });
    // 有些 gateway 用 /agnesapi,有些用 /v1/videos/{id};先試 agnesapi
    let body: Record<string, unknown>;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!res.ok && Object.keys(body).length === 0) {
      const r2 = await fetch(`${base}/v1/videos/${encodeURIComponent(taskId)}`, { headers: headers() });
      body = (await r2.json()) as Record<string, unknown>;
    }
    return normalizeVideoStatus(body);
  }
}

function normalizeVideoStatus(d: Record<string, unknown>): VideoStatus {
  const status = String(d.status ?? d.state ?? d.task_status ?? "processing").toLowerCase();
  const url =
    (d.url as string) ||
    (d.video_url as string) ||
    (d.result_url as string) ||
    ((d.data as Record<string, unknown> | undefined)?.url as string) ||
    null;
  const error = (d.error as string) || (d.message as string) || null;
  return { status, url, error };
}
