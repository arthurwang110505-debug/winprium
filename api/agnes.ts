// Vercel Serverless — Agnes AI 代理(OpenAI 相容)
// 用途:把 Agnes 金鑰留在伺服器端,前端經由 /api/agnes 呼叫。
// Deploy:Vercel 環境變數 AGNES_API_KEY 需設定(可另加 AGNES_BASE_URL)。
//
// 支援請求(以 body._kind 區分,前端會剝掉這個欄位再轉給 Agnes):
//   _kind=chat         → POST {base}/v1/chat/completions
//   _kind=image        → POST {base}/v1/images/generations
//   _kind=video        → POST {base}/v1/videos            (非同步建立任務)
//   _kind=video_status → GET  {base}/agnesapi?video_id=...  (輪詢影片)
// 預設(沒有 _kind)視為 chat,讓現有前端 VITE_AGNES_API_PROXY=/api/agnes 直接可用。

const DEFAULT_BASE = "https://apihub.agnes-ai.com";

interface ReqBody {
  _kind?: string;
  [key: string]: unknown;
}

function cors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

async function parseBody(req: any): Promise<ReqBody> {
  if (req.body && typeof req.body === "object") return req.body as ReqBody;
  if (req.method === "GET") return {};
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ReqBody;
  } catch {
    return {};
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const key = process.env.AGNES_API_KEY;
  if (!key) {
    res.status(500).json({ error: "伺服器未設定 AGNES_API_KEY" });
    return;
  }
  const base = (process.env.AGNES_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const body = await parseBody(req);
  const kind = typeof body._kind === "string" ? body._kind : "chat";

  // 不把 _kind 傳給 Agnes
  const payload: Record<string, unknown> = { ...body };
  delete payload._kind;

  const auth = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };

  try {
    if (kind === "image") {
      const r = await fetch(`${base}/v1/images/generations`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify(payload),
      });
      const data = await r.text();
      res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json");
      res.send(data);
      return;
    }

    if (kind === "video") {
      const r = await fetch(`${base}/v1/videos`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify(payload),
      });
      const data = await r.text();
      res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json");
      res.send(data);
      return;
    }

    if (kind === "video_status") {
      const taskId = typeof payload.task_id === "string" ? payload.task_id : typeof payload.video_id === "string" ? payload.video_id : "";
      if (!taskId) {
        res.status(400).json({ error: "缺少 task_id / video_id" });
        return;
      }
      const r = await fetch(`${base}/agnesapi?video_id=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await r.text();
      res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json");
      res.send(data);
      return;
    }

    // chat(預設)
    const r = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(payload),
    });
    const data = await r.text();
    res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
