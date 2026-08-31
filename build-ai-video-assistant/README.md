# AI 剪輯助理 · Winprium Studio

在**瀏覽器裡跑**的 AI 影片剪輯助理 —— 打一句話,Agnes AI 幫你規劃素材、排好時間軸,你再審片、微調。
Windows 用 Chrome / Edge 打開就能用,還能一鍵**安裝成桌面 App**(PWA),不用 Mac、不用寫 C、沒有授權包袱(100% 原創程式碼)。

## 核心迴圈(產品靈魂)

> **你打一句話 → AI 規劃素材、排時間軸 → 你審片(播放預覽) → 你微調(拖時間軸、調濾鏡)**

## 功能

- **AI 助理面板**:打一句話(例如「幫我做一支海邊日落的短片,4 段,暖色調,標題『夏日』」),AI 會逐步顯示規劃過程,然後直接生成可審片的草稿。
- **Agnes AI 規劃引擎**:`POST {BaseURL}/v1/chat/completions`(OpenAI 相容),回傳結構化 JSON,自動轉成時間軸草稿。
- **永不中斷的備援**:沒設金鑰 → 內建本地規則引擎;API 連線失敗 → 自動降級本地引擎並在對話中說明。兩種模式產出**完全相同的計畫格式**,UI 不用動。
- **會動的預覽播放器**:播放(循環)、暫停、回開頭、可拖曳進度條;Space 快捷鍵。
- **時間軸**:片段拖曳搬移、拖兩側改長度、點選/刪除(Delete 鍵)、刻度尺點擊跳轉、縮放(px/s)、每段即時縮圖。
- **微調面板**:長度、亮度、色溫(冷↔暖)、電影暗角、黑白、字幕,全部逐格即時預覽。
- **素材庫**:每個素材都有程序化生成的動態縮圖與來源標籤。
- **可安裝成 App(PWA)**:頂列「安裝 App」按鈕;manifest + service worker,安裝後可離線啟動、出現在開始功能表與桌面。

## 怎麼跑

```bash
npm install
npm run dev      # 開發
npm run build    # 打包(PWA 功能在正式 build 才啟用)
npm run preview  # 預覽打包結果
```

## 接你的 Agnes 金鑰(兩種方式,可並用)

**方式一:介面設定(最快)** — 右上角齒輪 → 貼上 `sk-` 金鑰 →「測試連線」→「儲存」。金鑰只存在你瀏覽器的 localStorage。

**方式二:環境變數** — 複製 `.env.example` 為 `.env`:

```bash
VITE_AGNES_API_KEY=sk-your-key-here
VITE_AGNES_BASE_URL=https://apihub.agnes-ai.com
VITE_AGNES_MODEL=agnes-2.5-flash
```

優先序:介面設定 > 環境變數。模型建議用免費的 `agnes-2.5-flash`;`agnes-2.5-pro` 為付費旗艦。

## 安裝成桌面 App(PWA)

1. `npm run build && npm run preview`(或部署到任何 https 空間)。
2. Chrome / Edge 點頂列「**安裝 App**」,或網址列右側的安裝圖示。
3. 之後就像一般軟體:開始功能表/桌面圖示開啟、獨立視窗、可離線啟動。
   - 想要 `.exe` 安裝包的話,之後可用 Tauri 或 Electron 把同一個 `dist/` 包起來(前端不用改)。

## 契約格式(規劃器 ↔ UI 之間的約定,換引擎不用動 UI)

```ts
{
  assets: Asset[],   // 素材(程序化渲染,motion/palette/seed 決定畫面)
  clips: Clip[],     // { id, assetId, start, length, in, filters, name, color }
  filters: {},       // 全域濾鏡建議
  notes: string[],   // AI 的行動紀錄(逐步顯示)
  summary: string,   // 一句話總結
  engine: "agnes" | "local"
}
```

## 程式結構

```
src/
  App.tsx               主畫面:播放器迴圈、拖曳邏輯、快捷鍵、版面
  planner.ts            協調器:Agnes 優先,失敗/無金鑰降級本地引擎
  agnes.ts              Agnes AI 用戶端(OpenAI 相容)+ JSON 清洗 + 測試連線
  localPlanner.ts       本地規則版備援引擎
  assets.ts             素材程序化渲染器(canvas 逐格繪製)
  types.ts              契約型別
  hooks/usePwaInstall.ts  PWA 安裝提示
  components/           TopBar / ChatPanel / Timeline / Inspector / SettingsModal / AssetThumb
public/
  manifest.webmanifest  PWA 描述檔
  sw.js                 Service Worker(離線快取,API 永不快取)
  icons/                App 圖示
```

## 之後要升級的地方(設計上已留好接點)

| 部分 | 現在 | 升級方式 |
| --- | --- | --- |
| AI 規劃 | Agnes API(本地引擎備援) | 改 `src/agnes.ts` 即可換供應商 |
| 素材 | Canvas 程序化動畫 | 在 `assets.ts` 的 draw 換成真實影格;可接 agnes-image / agnes-video 生成模型 |
| 匯出 mp4 | 尚未 | 用 ffmpeg.wasm(@ffmpeg/ffmpeg)把時間軸逐格算成影片 |

## 授權

MIT — 這是你自己的原創專案,想怎麼用都可以。
