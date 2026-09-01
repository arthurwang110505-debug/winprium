# AI 剪輯助理 · Winprium Studio

在**瀏覽器裡跑**的 AI 影片剪輯助理 —— 打一句話，Agnes AI 幫你規劃素材、排好時間軸，你再審片、微調。你也可以上傳自己的影片，加入時間軸直接預覽漸層調色、暗角、字幕等效果。

Windows 用 Chrome / Edge 打開就能用，還能一鍵**安裝成桌面 App（PWA）**，不用 Mac、不用寫 C、沒有授權包袱（100% 原創程式碼）。

## 核心迴圈（產品靈魂）

> **你打一句話 → AI 規劃素材、排時間軸 → 你審片（播放預覽）→ 你微調（拖時間軸、調濾鏡）**

## 功能

- **AI 助理面板**：打一句話（例如「幫我做一支海邊日落的短片，4 段，暖色調，標題『夏日』」），AI 會逐步顯示規劃過程，然後直接生成可審片的草稿。
- **Agnes AI 規劃引擎**：`POST {BaseURL}/v1/chat/completions`（OpenAI 相容），回傳結構化 JSON，自動轉成時間軸草稿。
- **永不中斷的備援**：沒設金鑰 → 內建本地規則引擎；API 連線失敗 → 自動降級本地引擎並在對話中說明。兩種模式產出**完全相同的計畫格式**，UI 不用動。
- **影片上傳與預覽**：選擇檔案或直接拖曳影片進網站（上限 400MB、10 支）；素材可加入時間軸，在 Canvas 預覽中即時逐格播放，並套用亮度／色溫／暗角／黑白／字幕。
- **AI 剪你的影片**：Agnes / 本地引擎都會知道已上傳素材；輸入「把我的影片剪成 30 秒」時會優先使用你的影片，支援目標長度、節奏、直式比例。
- **會動的預覽播放器**：播放（循環）、暫停、回開頭、可拖曳進度條；Space 快捷鍵。
- **時間軸**：片段拖曳搬移（自動吸附 0.5s / 邊緣吸附）、一鍵「縫合空隙」、拖兩側改長度、點選/刪除（Delete 鍵）、方向鍵微調、刻度尺點擊跳轉、縮放（px/s）、每段即時縮圖。
- **Undo / Redo**：Ctrl+Z 復原、Ctrl+Y / Ctrl+Shift+Z 重做，頂列有按鈕。
- **微調面板**：長度、亮度、色溫（冷↔暖）、電影暗角、黑白、字幕，全部逐格即時預覽。
- **素材庫**：AI 生成動態縮圖、來源標籤，以及你上傳的真實影片素材。
- **輸出比例**：可切換 16:9 / 9:16 / 1:1，預覽畫布與匯出都對應。
- **匯出影片**：目前用 MediaRecorder 把 Canvas 錄成 MP4 / WebM（依瀏覽器支援），真 MP4 轉檔之後接 ffmpeg.wasm。
- **專案自動儲存**：assets / clips / 比例會自動存到 localStorage，刷新後恢復（上傳影片需重新匯入）。
- **可安裝成 App（PWA）**：頂列「安裝 App」按鈕；manifest + service worker，安裝後可離線啟動、出現在開始功能表與桌面。

## 技術棧

- **React 18** + TypeScript
- **Vite 7**（`vite-plugin-singlefile` 打包成單一 HTML，方便部署/嵌入）
- **純前端優先**：Agnes AI 走 OpenAI-compatible fetch；也可透過後端代理保護金鑰
- **PWA**：manifest + service worker，可安裝、可離線啟動
- CSS 維持手寫 `styles.css`（深空剪輯室主題），未綁定過重 UI 框架

## 怎麼跑（開發、Build）

```bash
npm install
npm run dev      # 開發（http://localhost:5173）
npm run build    # 打包（dist/index.html，PWA 功能在正式 build 才啟用）
npm run preview  # 預覽打包結果
```

## 接你的 Agnes 金鑰（兩種方式，可並用）

**方式一：介面設定（最快）** — 右上角齒輪 → 貼上 `sk-` 金鑰 →「測試連線」→「儲存」。金鑰只存在你瀏覽器的 localStorage。

**方式二：環境變數** — 複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

```bash
VITE_AGNES_API_KEY=sk-your-key-here
VITE_AGNES_BASE_URL=https://apihub.agnes-ai.com
VITE_AGNES_MODEL=agnes-2.5-flash
```

優先序：介面設定 > 環境變數。模型建議用免費的 `agnes-2.5-flash`；`agnes-2.5-pro` 為付費旗艦。

### 後端代理（保護 API Key）

如果之後要公開部署，建議把呼叫搬到後端，避免金鑰暴露在瀏覽器。架構已預留：

```bash
# 設定後，前端不再直連 Agnes，
# 而是把 OpenAI 相容請求 POST 到這個完整端點：
VITE_AGNES_API_PROXY=https://your-backend.example.com/v1/chat/completions
```

後端只需做 OpenAI-compatible 代理（把 `Authorization` 換成伺服器端的 Agnes 金鑰），前端與 UI 完全不用改。

## 契約格式（規劃器 ↔ UI 之間的約定，換引擎不用動 UI）

```ts
{
  assets: Asset[],   // 素材（程序化渲染 / 使用者上傳影片，motion/palette/seed or videoUrl 決定畫面）
  clips: Clip[],     // { id, assetId, start, length, in, filters, name, color }
  filters: {},       // 全域濾鏡建議
  notes: string[],   // AI 的行動紀錄（逐步顯示）
  summary: string,   // 一句話總結
  engine: "agnes" | "local"
}
```

## 影片上傳

1. 右側「素材庫」→「上傳影片素材」→「選擇」，或直接把影片拖進整個視窗。
2. 支援瀏覽器可播放格式（MP4、WebM 等）。
3. 上傳後會在素材區看到檔案縮圖；點「加入時間軸」即可把它排到時間軸尾端。
4. Preview、Timeline、Inspector 都會即時反映；亮度、色溫、暗角、黑白、字幕都能即時套用。

## 程式結構

```
src/
  App.tsx                主畫面：影片預覽(Canvas)、播放迴圈、拖曳邏輯、快捷鍵、影片上傳
  planner.ts             協調器：Agnes 優先，失敗/無金鑰降級本地引擎
  agnes.ts               Agnes AI 用戶端（OpenAI 相容）+ JSON 清洗 + 測試連線 + 後端代理
  localPlanner.ts        本地規則版備援引擎
  assets.ts              程序化素材繪製 + 真實影片 frame 繪製 + 濾鏡套用
  types.ts               契約型別（含 video 素材）
  export.ts              匯出架構預留（後續接 ffmpeg.wasm）
  hooks/usePwaInstall.ts PWA 安裝提示
  components/            TopBar / ChatPanel / Timeline / Inspector / SettingsModal / AssetThumb
public/
  manifest.webmanifest   PWA 描述檔
  sw.js                  Service Worker（離線快取，API 永不快取）
  icons/                 App 圖示（icon.svg / icon-512.png）
```

## 之後要升級的地方（設計上已留好接點）

| 部分 | 現在 | 升級方式 |
| --- | --- | --- |
| AI 規劃 | Agnes API（本地引擎備援） | 改 `src/agnes.ts` 或後端代理即可換供應商 |
| 素材 | Canvas 程序化動畫 + 使用者上傳影片 | 在 `assets.ts` 的 draw 換成真實影格；可接 agnes-image / agnes-video 生成模型 |
| 匯出 mp4 | MediaRecorder 錄製 WebM/MP4（草案） | 用 @ffmpeg/ffmpeg 做逐格高品質 MP4 |
| Undo / Redo | 已做：Ctrl+Z / Ctrl+Y + 頂列按鈕 | 可擴充成支援更多 state 欄位 |
| 專案儲存 | 已做：localStorage 自動保存 | 之後升級成 IndexedDB 儲存原始影片 |

## 未來如何打包成 Windows App

第一階段先驗證 Web App（現在已完成），之後用同一份前端包 Windows App：

- **PWA（現在就有）**：`npm run build && npm run preview`（或部署到 https），Chrome/Edge 安裝即可變成獨立 App。體積最小、不用寫原生碼。
- **Tauri（建議）**：前端不變，把 `dist/` 用 Tauri 包成 `.exe`/`.msi`。體積小（比 Electron 小很多）、記憶體佔用低、Microsoft Edge WebView2 共用，Windows 體驗好。
- **Electron（次要備案）**：開發生態最完整，但包體與記憶體較大。若未來有 Node 端連原生能力需求再考慮。

> 前端已不綁定 node 或特定 runtime，只產出標準 HTML/JS/CSS + 靜態資源，因此切到 Tauri/Electron 時不需要重寫。

## 授權

MIT — 這是你自己的原創專案，想怎麼用都可以。
