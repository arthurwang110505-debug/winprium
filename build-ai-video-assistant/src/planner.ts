// 規劃協調器:優先使用 Agnes AI;未設定金鑰或連線失敗時,自動降級本地規則引擎。
// 對外只暴露 planEdit(prompt) — UI 永遠拿到同一份契約格式 { assets, clips, filters, notes, summary }。

import { hasApiKey, planWithAgnes } from "./agnes";
import { planEditLocal } from "./localPlanner";
import type { Plan } from "./types";

export async function planEdit(prompt: string): Promise<Plan> {
  if (hasApiKey()) {
    try {
      const plan = await planWithAgnes(prompt);
      return { ...plan, engine: "agnes" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[planner] Agnes API 失敗,降級本地規則引擎:", msg);
      const local = await planEditLocal(prompt);
      return {
        ...local,
        engine: "local",
        apiError: msg,
        notes: [
          `無法連上 Agnes API(${msg})`,
          "已自動切換成內建本地規則引擎完成草稿;到右上角「設定」可以檢查金鑰與 Base URL。",
          ...local.notes,
        ],
      };
    }
  }

  const local = await planEditLocal(prompt);
  return {
    ...local,
    engine: "local",
    notes: [
      "目前未設定 Agnes API 金鑰 → 使用內建本地規則引擎(流程完全相同,可到右上角「設定」貼上金鑰啟用真 AI)。",
      ...local.notes,
    ],
  };
}
