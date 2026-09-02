import { useEffect, useState } from "react";
import { Globe, KeyRound, Loader2, PlugZap, Save, Sparkles, X } from "lucide-react";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  MODEL_PRESETS,
  getSettings,
  saveSettings,
  testConnection,
} from "../agnes";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ open, onClose, onSaved }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [envKey, setEnvKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = getSettings();
    setApiKey(s.keySource === "local" ? s.apiKey : "");
    setBaseUrl(s.baseUrl);
    setModel(s.model);
    setEnvKey(s.keySource === "env");
    setResult(null);
    setSavedFlash(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSave() {
    saveSettings({ apiKey, baseUrl, model });
    setSavedFlash(true);
    onSaved();
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function handleClear() {
    setApiKey("");
    setBaseUrl(DEFAULT_BASE_URL);
    setModel(DEFAULT_MODEL);
    saveSettings({ apiKey: "", baseUrl: "", model: "" });
    onSaved();
    setResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const msg = await testConnection({
        apiKey: apiKey || undefined,
        baseUrl,
        model,
      });
      setResult({ ok: true, msg });
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <span className="logo-tile small">
              <Sparkles size={15} />
            </span>
            <div>
              <div className="modal-name">Agnes AI 設定</div>
              <div className="modal-sub">OpenAI 相容格式 · 金鑰只存在你的瀏覽器</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉設定">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>
              <span className="field-label">
                <KeyRound size={12} />
                API 金鑰
              </span>
              {envKey && <span className="env-note">偵測到 .env 提供的金鑰(此處留空即用環境變數)</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              placeholder="sk-…(到 Agnes 控制台申請)"
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label>
              <span className="field-label">
                <Globe size={12} />
                Base URL
              </span>
            </label>
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>

          <div className="field">
            <label>
              <span className="field-label">
                <Sparkles size={12} />
                模型
              </span>
            </label>
            <input
              type="text"
              list="agnes-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <datalist id="agnes-models">
              {MODEL_PRESETS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <div className="field-help">
              免費:agnes-2.5-flash / agnes-2.0-flash · 付費旗艦:agnes-2.5-pro
            </div>
          </div>

          <div className="field-help dim-box">
            也可以用 <code>.env</code> 設定:<code>VITE_AGNES_API_KEY</code>、
            <code>VITE_AGNES_BASE_URL</code>、<code>VITE_AGNES_MODEL</code>(Vite 需 VITE_ 前綴)。
          </div>

          {result && (
            <div className={`test-result ${result.ok ? "ok" : "fail"}`}>
              {result.ok ? "✓ " : "✕ "}
              {result.msg}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={handleClear}>
            清除本機設定
          </button>
          <div className="spacer" />
          <button className="btn ghost" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />}
            測試連線
          </button>
          <button className="btn send" onClick={handleSave}>
            <Save size={14} />
            {savedFlash ? "已儲存!" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
