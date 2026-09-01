// 匯出架構預留 —— 未來把 Timeline 算成真正 MP4。
//
// 目前 MVP 做到「剪輯 + 預覽 + 微調」；匯出的下一步是接 ffmpeg.wasm。
// 建議的邊界：
//   - 前端傳「專案快照」(assets + clips + filters) 給匯出器
//   - 匯出器逐格 reads assets → filters → 寫出 MP4
//   - 若瀏覽器端效能不足，可移到後端 worker / 或由 Tauri 側原生處理
//
// 讓 UI / 匯出器之間維持固定契約，之後接任何實現都不用改主畫面。

import type { Plan } from "./types";

export interface ExportJob {
  plan: Plan;
  width: number;
  height: number;
  fps: number;
  format: "mp4";
}

export interface ExportProgress {
  phase: "preparing" | "rendering" | "muxing" | "done" | "error";
  percent: number; // 0..100
  message?: string;
}

export interface Exporter {
  export(job: ExportJob, onProgress?: (p: ExportProgress) => void): Promise<Blob>;
}

// 目前尚未實作。保留型別與入口，方便下一階段直接接 @ffmpeg/ffmpeg。
export class NotYetImplementedExporter implements Exporter {
  async export(job: ExportJob): Promise<Blob> {
    void job; // 避免 strict 未使用參數警告，同時標示此 stub 尚未使用
    throw new Error("MP4 匯出尚未實作 — 下一階段將接上 ffmpeg.wasm。");
  }
}
