# Winprium AI 剪輯助理 — 改進建議 / 開發計畫

> 範圍：專案根目錄（React 18 + Vite + Agnes AI）
> 原則:不要過度複雜化,先讓「聊天 → AI 剪輯 → Timeline → Preview → 微調 → 匯出」這條主線真正跑穩,再往多軌、後端、Windows App 推進。

---

## 0. 現況摘要

已完成（MVP 核心 + P0 / 大部分 P1）:

- React 18 + Vite + TypeScript,`npm run build` 與 `npx tsc --noEmit` 通過。
- Agnes AI（OpenAI 相容）:金鑰可由 UI / `.env` 設定,模型、Base URL 可改;失敗自動降級本地引擎。
- 固定契約:`{ assets, clips, filters, notes, summary }`;`clips` 含 `id/assetId/start/length/in/filters/name/color`。
- Canvas 預覽:程序化素材 + 真實上傳影片,播放/暫停/回開頭/拖曳進度。
- Timeline:選取、移動、改長度、刪除、縮放、播放頭。
- Inspector:長度、亮度、色溫、暗角、黑白、字幕,即時預覽。
- 影片上傳:選擇檔案 + 整頁拖放,可加入時間軸。
- PWA:manifest + service worker + 安裝按鈕;PWA 圖示已補 `icon-512.png`。
- 匯出(草案):MediaRecorder 錄製 Canvas → WebM/MP4(依瀏覽器支援),`src/export.ts` 保留 FFmpeg 介面。
- 進階時間軸:0.5s/邊緣自動吸附、「縫合空隙」、方向鍵 nudge、Ctrl+Z/Y Undo/Redo。
- 輸出比例:16:9 / 9:16 / 1:1 切換。
- 專案自動儲存到 localStorage(影片 Blob 需重新匯入)。
- AI 可引用已上傳素材;本地/Agnes 均支援目標長度、節奏、比例解析。

---

## 1. P0 — 正確性 / 穩定性（建議先做）

這些是目前**會影響使用體驗或資料正確性**的問題,優先度最高。

| # | 項目 | 現況 / 問題 | 建議做法 | 難度 |
| --- | --- | --- | --- | --- |
| 1 | 影片拖曳的 gap / 空隙 | 單軌 timeline 拖動後會產生空隙,start 不連續,播放時會跳黑幕 | ✅ 已做:0.5s + 邊緣自動吸附、一鍵「縫合空隙」 | 中 |
| 2 | 影片 frame 抽取效能 | `renderFrame` 每幀設定 `video.currentTime`(seek),0.02s 容差可能造成畫面跳動與卡頓 | ✅ 已部分修正:播放中只播放當前 video 並提高 seek 容差到 0.08s,暫停/scrub 才精確跳轉;`requestVideoFrameCallback` 為下一步 | 中 |
| 3 | Blob URL 生命週期 | 上傳的 `URL.createObjectURL` 沒有 revoke;重設/刪除素材時可能累積記憶體 | ✅ 已做:重來時 revoke + 移除隱藏 video 元素;刪除片段不刪素材(上游保留) | 低 |
| 4 | 檔案類型/大小校驗 | 目前只依 `type.startsWith("video/")` 過濾 | ✅ 已做:大小上限 400MB、一次最多 10 支、失敗訊息明確 | 低 |
| 5 | AI prompt 的 JSON 解析強健度 | 目前 `extractJson` 靠第一個 `{` 到最後 `}`;AI 若輸出表格或大量文字可能解析錯誤 | ✅ 已做:去 code fence、大括號配對、去尾逗號、schema validate、失敗 retry 一次 | 中 |
| 6 | API Key 安全 | 目前前端直連 Agnes,Key 在瀏覽器可見 | 文件已預留 `VITE_AGNES_API_PROXY`;公開部署時移到後端(見 P2) | 低(架構已預留) |
| 7 | .env 不存在時的 UX | 沒金鑰時本地引擎照跑,OK | 保留:對話已有引導;進階「快速設定嚮導」留給 UX 階段 | 低 |

---

## 2. P1 — MVP 產品體驗（建議下一批）

讓主流程更接近「真的剪輯工具」,不是 Mock。

| # | 項目 | 建議 | 難度 |
| --- | --- | --- | --- |
| 8 | 匯出 MP4(草案版) | 先用 `MediaRecorder` 把 Canvas 錄成 WebM/MP4(依瀏覽器);再用 `@ffmpeg/ffmpeg` 做真正 MP4(worker 內跑) | ✅ 已做草案:匯出按鈕可用，MediaRecorder 錄製下載;FFmpeg 高品質轉換未做 | 高 |
| 9 | 真實影片 + AI 剪輯結合 | 目前 AI 只產程序化素材;讓 AI 可引用已上傳素材(傳 asset 列表給 prompt),剪輯「我的影片」 | ✅ 已做:Agnes 注入素材清單、scene 可用 sourceAssetId;本地引擎優先使用上傳影片 | 中 |
| 10 | 30 秒 / 節奏控制 | 增加「目標長度、節奏快/慢、TikTok/Shorts 比例」解析,並讓本地引擎與 prompt 都遵守 | ✅ 已做:targetDuration / pace / aspect 解析並套用 | 中 |
| 11 | Advanced Timeline | snap 到 0.5s/整數秒、邊界吸附、鍵盤方向鍵 nudge、Ctrl/Cmd+Z 復原 | ✅ 已做:吸附、方向鍵 nudge、Ctrl+Z/Y | 中 |
| 12 | 多音軌 / 背景音樂 | 至少一條 audio 軌 + 音量;音樂來源先內建幾段可循環音訊 | 高(下一里程碑) |
| 13 | 字幕編輯體驗 | 目前字幕是 per-clip 一段文字;升級成字幕軌,有起始/結束時間、樣式 | 中 |
| 14 | 專案儲存 | 把 `assets/clips/plan` 序列化到 localStorage / IndexedDB,離開自動保存,進來可恢復 | ✅ 已做:localStorage 自動儲存/恢復(影片需重新匯入);升級 IndexedDB 存原始檔留後續 | 中 |
| 15 | 匯出入度 / 範本 | 提供常見比例(16:9、9:16、1:1)與匯出預設;畫布可切比例 | ✅ 已做比例切換 16:9/9:16/1:1;完整匯出範本與 LUT 留後續 | 中 |

---

## 3. P2 — 架構 / 擴充(為了公開版與 Windows App)

| # | 項目 | 建議 | 難度 |
| --- | --- | --- | --- |
| 16 | 後端 API 代理 | 用 Node/Cloudflare Worker/Deno 做 OpenAI-compatible 代理,Key 只在伺服器;前端只改 `VITE_AGNES_API_PROXY` | ✅ 已做:Vercel `api/agnes.ts`(chat/image/video proxy) + `vercel.json` | 中 |
| 17 | Agnes 圖片/影片生成 | 把 `AssetKind` 擴充成可載入 Agnes image/video 生成模型(透過 API),存入 IndexedDB 當素材 | ✅ 已做:`media.ts` + `Asset.kind=image` + Inspector「AI 生成素材」(影片任務＋輪詢);IndexedDB 為後續 | 高 |
| 18 | Tauri 打包 | 新增 `src-tauri`,把 `dist/` 包成 `.exe`/`.msi`;拖放、檔案選取走 Tauri API;WebView2 高效能 | ✅ 已建骨架+打包教學(需本機 Rust 才能產 .exe) | 中 |
| 19 | PWA 離線強化 | 服務 worker 對 `dist` 資源做版本化 cache;首次裝完離線可開;新增後台更新提示 | ✅ 已做:sw.js v2,shell+icons 快取,API 永不快取 | 低 |
| 20 | 效能優化 | `offscreenCanvas` 預渲染縮圖;大影片改用 `video` 跨距渲染;Timeline 大量 clip 減少 re-render(useMemo / 虛擬化) | ✅ 部分:AssetThumb/Timeline/Inspector 加 React.memo;offscreen/虛擬化為後續 | 中 |
| 21 | Accessibility | 鍵盤標籤、`aria-label`、focus ring、縮放/對比度;拖曳避免只靠滑鼠(增加鍵盤 nudge) | ✅ 已做:focus-visible、aria-label、鍵盤 nudge/undo;完整對比度稽核為後續 | 低 |
| 22 | 國際化 | 目前繁中硬編碼;抽 `i18n`(至少 en-US),未來的 Windows 市場適用 | ✅ 已做:`i18n.ts` + 語言切換,覆蓋主介面;完整翻譯為後續 | 中 |

---

## 4. P3 — 長期產品方向

- 多軌 / multi-track timeline、轉場(transitions)、音訊波形、LUT。
- AI 自動找精彩片段(須有真實影片分析或 metadata)。
- AI 自動字幕(Whisper 或 Agnes 語音)、自動配樂。
- 專案雲端同步 / 多人協作。
- 匯出到 YouTube/TikTok/Shorts 的尺寸與格式建議。

---

## 5. 建議里程碑(每步都可交付、可測試)

### M1 — 穩定 MVP(1~2 週)
- 完成 P0:timeline 空隙處理、影片 frame 效能、blob 清理、AI JSON 強健度。
- 完成 8(MediaRecorder 快速導出)、14(專案儲存)。

### M2 — 可剪輯自己的影片(2~3 週)
- 完成 9、10、11、13、15。
- 真實影片 + AI 規劃、目標長度/節奏、進階 timeline、字幕軌、畫布比例。

### M3 — 公開版(2~3 週)
- 完成 16 後端代理、18 Tauri、19 PWA 離線強化、20 效能、22 i18n。

### M4 — 進階版
- 多軌、轉場、AI 找精彩片段、AI 字幕/配樂、MP4 真正匯出(ffmpeg.wasm worker)。

---

## 6. 優先建議(如果只挑 5 件)

1. **匯出 MP4(至少 MediaRecorder 快速導出)** — 主流程「匯出」是空的,補上體驗差最多。
2. **Timeline 空隙收合 / snap** — 拖動後跳黑幕是現在最明顯的使用痛點。
3. **真實影片 frame 渲染效能** — 大影片播放會卡,決定「能不能真正剪自己的影片」。
4. **AI 引用已上傳素材** — 把目前「AI 產生 placeholder」升級成「AI 剪我的影片」,是產品核心差異。
5. **後端代理 + 專案儲存** — 為公開版與資料安全打好底。

---

## 7. 技術備註(實施時建議)

- 匯出用 Web Worker,避免 ffmpeg.wasm 阻塞 UI;`export.ts` 已定義 `Exporter` / `ExportJob` 契約,直接補實作即可。
- 影片 frame 建議:
  - 播放中用 hidden `<video>` + `requestVideoFrameCallback` 同步到 canvas;
  - 只在使用者拖 scrubber / 手動改 `in` 時才 `currentTime = x`。
- 資料契約不要破壞:`{ assets, clips, filters, notes, summary, engine }`。若要新增欄位(如 audio、transitions),用 optional + 向後相容。
- 素材來源上游要收斂成 `AssetSource`(`generated | found | upload | remote`),方便接後續 Agnes image/video、素材庫。
