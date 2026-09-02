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
- **Agnes 圖／影片生成**：右側「AI 生成素材」可輸入 prompt 生成圖片（agnes-image）或影片（agnes-video，非同步任務＋輪詢），自動加入素材庫。
- **PWA 離線**：service worker 版本化 cache，安裝後可離線啟動；API 永不快取。
- **i18n**：繁中／英文介面切換（右上角），目前先覆蓋主介面與設置。
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

## Vercel 部署（後端代理 ＋ 公開網站）

**目的**：把 Agnes 金鑰移到伺服器，避免公開網站暴露 Key。

1. 在 Vercel import 這個 repo，Root Directory 選 `.`（專案根目錄，已在最外層）。
2. Vercel 環境變數設定：`AGNES_API_KEY=sk-...`（後端用到），可選 `AGNES_BASE_URL=https://apihub.agnes-ai.com`。
3. 前端 build 變數：`VITE_AGNES_API_PROXY=/api/agnes`（注意：`VITE_` 變數在 build 時要設）。
4. 部署後，chat / image / video 都會打到 `/api/agnes`，金鑰只存在伺服器端。

> `api/agnes.ts` 是 Vercel Serverless；`vercel.json` 已設 `outputDirectory=dist`。本機開發也可直接設相同 env 測試代理。

## 環境變數一覽

| 變數 | 用途 | 範例 |
| --- | --- | --- |
| `VITE_AGNES_API_KEY` | 前端直連模式的金鑰（本地開發／測試） | `sk-...` |
| `VITE_AGNES_BASE_URL` | Agnes Base URL | `https://apihub.agnes-ai.com` |
| `VITE_AGNES_MODEL` | 聊天模型 | `agnes-2.5-flash` |
| `VITE_AGNES_API_PROXY` | 指向後端代理（公開部署用） | `/api/agnes` |
| `AGNES_API_KEY` | **Vercel 後端**用的金鑰（不要用 VITE_ 前綴） | `sk-...` |
| `AGNES_BASE_URL` | 後端要轉送的 Base URL（選填） | `https://apihub.agnes-ai.com` |

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
- **Tauri（建議，已附骨架）**：`src-tauri/` 已放好 `Cargo.toml`、`tauri.conf.json`、`build.rs`、`src/main.rs`、`src/lib.rs`、icons。前端不變，把 `dist/` 用 Tauri 包成 `.exe`/`.msi`。體積小、記憶體佔用低、Windows 體驗好。
- **Electron（次要備案）**：開發生態最完整，但包體與記憶體較大。若未來有 Node 端連原生能力需求再考慮。

### Tauri 打包步驟（Windows）

先裝兩樣東西（各裝一次就好）：

1. **Visual Studio Build Tools** — 安裝時勾「**使用 C++ 的桌面開發**」
2. **Rust** — https://rustup.rs （跳「Windows 已保護您的電腦」是正常的，見下方說明）

然後在專案資料夾開 PowerShell，照順序貼：

```bash
npm install         # 1. 裝東西（Tauri 工具已包含在裡面）
npm run build       # 2. 把網站打包好
npm run tauri:dev   # 3. 先開看看，會跳出一個桌面視窗
npm run tauri:build # 4. 正式打包成 .exe（第一次要等 3~10 分鐘）
```

打包完，`.exe` 在這裡：

```
src-tauri\target\release\bundle\nsis\
```

- 第 4 步卡住或報錯 → 改跑 `npm run tauri:build:exe`（少做一件事，比較不容易失敗）。
- 換圖示 → 改 `public/icons/icon-512.png`，再跑 `npx tauri icon public/icons/icon-512.png`。
- 為什麼要裝那兩樣：Rust 負責把程式編成 `.exe`，C++ 工具是它編譯時要用的零件，缺一個就會失敗。
- 你的 `.exe` 也沒花錢買簽章，所以別人下載時同樣會看到「Windows 已保護您的電腦」，點「其他資訊 → 仍要執行」就好。

> 前端已不綁定 node 或特定 runtime，只產出標準 HTML/JS/CSS + 靜態資源，因此切到 Tauri/Electron 時不需要重寫。

## 授權

MIT — 這是你自己的原創專案，想怎麼用都可以。
