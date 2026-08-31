import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// PWA:註冊 service worker(僅正式環境,開發模式不快取避免干擾)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* 靜默失敗:不影響主功能 */
    });
  });
}
