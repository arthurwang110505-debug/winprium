// 輕量 i18n — 目前支援繁中(預設)、英文。
// 用法:
//   import { t, setLocale, getLocale } from "./i18n";
//   t("key")
// 未來若翻譯量大,可換成 react-i18next + JSON 語言包,這裡保留介面。

export type Locale = "zh-TW" | "en-US";

const dict: Record<Locale, Record<string, string>> = {
  "zh-TW": {
    appName: "AI 剪輯助理",
    appSub: "Winprium Studio · 瀏覽器就是你的剪輯室",
    localMode: "本地規則模式",
    lang: "語言",
    install: "安裝 App",
    installed: "已安裝為 App",
    settings: "Agnes API 設定",
    reset: "重來(清空草稿)",
    undo: "復原 (Ctrl+Z)",
    redo: "重做 (Ctrl+Y / Ctrl+Shift+Z)",
    timeline: "時間軸",
    tighten: "縫合空隙",
    zoomIn: "放大時間軸",
    zoomOut: "縮小時間軸",
    media: "素材",
    audio: "音軌",
    subs: "字幕",
    generate: "生成",
    generateZone: "AI 生成素材",
    generateImage: "圖片",
    generateVideo: "影片",
    uploadVideoTitle: "上傳影片素材",
    uploadVideoSub: "選擇檔案或拖曳影片到這裡",
    export: "匯出 MP4",
    exporting: "匯出中…",
    play: "播放",
    pause: "暫停",
    goStart: "回到開頭",
  },
  "en-US": {
    appName: "AI Video Assistant",
    appSub: "Winprium Studio · Your editing room in the browser",
    localMode: "Local Rule Engine",
    lang: "Language",
    install: "Install App",
    installed: "Installed as App",
    settings: "Agnes API Settings",
    reset: "Reset (clear draft)",
    undo: "Undo (Ctrl+Z)",
    redo: "Redo (Ctrl+Y / Ctrl+Shift+Z)",
    timeline: "Timeline",
    tighten: "Tighten gaps",
    zoomIn: "Zoom in timeline",
    zoomOut: "Zoom out timeline",
    media: "Media",
    audio: "Audio",
    subs: "Subtitles",
    generate: "Generate",
    generateZone: "AI Generate Asset",
    generateImage: "Image",
    generateVideo: "Video",
    uploadVideoTitle: "Upload video",
    uploadVideoSub: "Choose or drop video files here",
    export: "Export MP4",
    exporting: "Exporting…",
    play: "Play",
    pause: "Pause",
    goStart: "Go to start",
  },
};

let current: Locale = "zh-TW";

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem("winprium.locale", locale);
    document.documentElement.lang = locale;
  } catch {
    /* ignore */
  }
}

export function t(key: string): string {
  return dict[current][key] ?? dict["zh-TW"][key] ?? key;
}

// 啟動時套用已儲存語言
try {
  const saved = localStorage.getItem("winprium.locale");
  if (saved === "en-US" || saved === "zh-TW") {
    current = saved;
    document.documentElement.lang = saved;
  }
} catch {
  /* ignore */
}
