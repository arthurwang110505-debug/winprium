import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clapperboard,
  Download,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";

interface Props {
  hasKey: boolean;
  model: string;
  onOpenSettings: () => void;
  onReset: () => void;
}

export default function TopBar({ hasKey, model, onOpenSettings, onReset }: Props) {
  const { canInstall, installed, promptInstall } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    const close = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showHelp]);

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
        <span className="logo-name">AI 剪輯助理</span>
        <span className="logo-sub">Winprium Studio · 瀏覽器就是你的剪輯室</span>
      </div>

      <span className={`engine-badge ${hasKey ? "on" : "off"}`} title={hasKey ? `模型:${model}` : "尚未設定 Agnes 金鑰"}>
        <span className="dot" />
        {hasKey ? `Agnes AI · ${model}` : "本地規則模式"}
      </span>

      <div className="spacer" />

      {installed ? (
        <span className="installed-badge">
          <BadgeCheck size={14} />
          已安裝為 App
        </span>
      ) : (
        <div className="install-wrap" ref={helpRef}>
          <button className="btn install" onClick={handleInstall}>
            <Download size={15} />
            安裝 App
          </button>
          {showHelp && (
            <div className="install-pop">
              <div className="install-pop-head">
                <span>把剪輯室裝到電腦上</span>
                <button className="icon-btn" onClick={() => setShowHelp(false)} aria-label="關閉">
                  <X size={14} />
                </button>
              </div>
              <ol>
                <li>
                  <b>Chrome / Edge(Windows)</b>
                  <br />
                  網址列右邊的「安裝」圖示,或選單 ⋮ →「安裝 AI 剪輯助理」。
                </li>
                <li>
                  <b>安裝後</b>
                  <br />
                  會出現在開始功能表與桌面,像一般 App 一樣開啟、可離線啟動。
                </li>
                <li>
                  <b>iOS / Android</b>
                  <br />
                  分享 →「加入主畫面」。
                </li>
              </ol>
              <div className="install-pop-note">
                <Check size={12} /> 這是 PWA 漸進式網頁應用 — 免安裝包、自動更新、容量極小。
              </div>
            </div>
          )}
        </div>
      )}

      <button className="icon-btn-lg" onClick={onOpenSettings} title="Agnes API 設定">
        <Settings size={17} />
      </button>
      <button className="icon-btn-lg" onClick={onReset} title="重來(清空草稿)">
        <RotateCcw size={16} />
      </button>
    </header>
  );
}
