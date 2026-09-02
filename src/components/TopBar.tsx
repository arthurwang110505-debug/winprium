import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clapperboard,
  Download,
  Globe,
  Redo2,
  RotateCcw,
  Settings,
  Undo2,
  X,
} from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { getLocale, setLocale, t, type Locale } from "../i18n";

interface Props {
  hasKey: boolean;
  model: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
}

export default function TopBar({
  hasKey,
  model,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSettings,
  onReset,
}: Props) {
  const { canInstall, installed, promptInstall } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    const close = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showHelp]);

  function switchLocale(next: Locale) {
    setLocale(next);
    setLocaleState(next);
  }

  async function handleInstall() {
    if (canInstall) {
      const ok = await promptInstall();
      if (!ok) setShowHelp(true);
    } else {
      setShowHelp((s) => !s);
    }
  }

  return (
    <header className="topbar">
      <div className="logo-tile">
        <Clapperboard size={19} strokeWidth={2.2} />
      </div>
      <div className="logo-text">
        <span className="logo-name">{t("appName")}</span>
        <span className="logo-sub">{t("appSub")}</span>
      </div>

      <span className={`engine-badge ${hasKey ? "on" : "off"}`} title={hasKey ? `模型:${model}` : t("settings")}>
        <span className="dot" />
        {hasKey ? `Agnes AI · ${model}` : t("localMode")}
      </span>

      <div className="spacer" />

      <div className="lang-switch" title={t("lang")}>
        <Globe size={13} />
        <button className={locale === "zh-TW" ? "on" : ""} onClick={() => switchLocale("zh-TW")} aria-label="繁體中文">
          繁
        </button>
        <button className={locale === "en-US" ? "on" : ""} onClick={() => switchLocale("en-US")} aria-label="English">
          EN
        </button>
      </div>

      <div className="history-tools">
        <button className="icon-btn-lg" onClick={onUndo} disabled={!canUndo} title={t("undo")} aria-label="undo">
          <Undo2 size={16} />
        </button>
        <button className="icon-btn-lg" onClick={onRedo} disabled={!canRedo} title={t("redo")} aria-label="redo">
          <Redo2 size={16} />
        </button>
      </div>

      {installed ? (
        <span className="installed-badge">
          <BadgeCheck size={14} />
          {t("installed")}
        </span>
      ) : (
        <div className="install-wrap" ref={helpRef}>
          <button className="btn install" onClick={handleInstall}>
            <Download size={15} />
            {t("install")}
          </button>
          {showHelp && (
            <div className="install-pop">
              <div className="install-pop-head">
                <span>{t("install")}</span>
                <button className="icon-btn" onClick={() => setShowHelp(false)} aria-label="close">
                  <X size={14} />
                </button>
              </div>
              <ol>
                <li>
                  <b>Chrome / Edge(Windows)</b>
                  <br />
                  {locale === "zh-TW"
                    ? "網址列右邊的「安裝」圖示,或選單 ⋮ →「安裝 AI 剪輯助理」。"
                    : 'Use the install icon in the address bar, or the menu ⋮ → "Install App".'}
                </li>
                <li>
                  <b>{locale === "zh-TW" ? "安裝後" : "After install"}</b>
                  <br />
                  {locale === "zh-TW"
                    ? "會出現在開始功能表與桌面,像一般 App 一樣開啟、可離線啟動。"
                    : "Appears in Start menu and desktop, opens like an app, works offline."}
                </li>
                <li>
                  <b>iOS / Android</b>
                  <br />
                  {locale === "zh-TW" ? "分享 →「加入主畫面」。" : 'Share → "Add to Home Screen".'}
                </li>
              </ol>
              <div className="install-pop-note">
                <Check size={12} />{locale === "zh-TW" ? "這是 PWA 漸進式網頁應用 — 免安裝包、自動更新、容量極小。" : "This is a PWA — no install package, auto-update, tiny footprint."}
              </div>
            </div>
          )}
        </div>
      )}

      <button className="icon-btn-lg" onClick={onOpenSettings} title={t("settings")} aria-label={t("settings")}>
        <Settings size={17} />
      </button>
      <button className="icon-btn-lg" onClick={onReset} title={t("reset")} aria-label={t("reset")}>
        <RotateCcw size={16} />
      </button>
    </header>
  );
}
