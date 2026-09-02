import { useEffect, useRef, useState } from "react";
import { Check, Cpu, SendHorizonal, Sparkles, User } from "lucide-react";
import type { ChatMsg } from "../types";

interface Props {
  messages: ChatMsg[];
  thinking: boolean;
  connected: boolean;
  onSend: (text: string) => void;
}

const EXAMPLES = [
  "幫我做一支海邊日落的短片,4 段,暖色調,標題「夏日」",
  "生成 5 段城市夜景,霓虹科技感,加電影暗角",
  "森林自然主題,6 段,黑白復古風",
];

export default function ChatPanel({ messages, thinking, connected, onSend }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function send(text?: string) {
    const v = (text ?? input).trim();
    if (!v || thinking) return;
    setInput("");
    onSend(v);
  }

  return (
    <>
      <div className="panel-head">
        <h2>AI 助理</h2>
        <span className={`conn-pill ${connected ? "on" : "off"}`}>
          <Cpu size={11} />
          {connected ? "Agnes API" : "本地引擎"}
        </span>
      </div>

      <div className="scroll chat-scroll" ref={listRef}>
        <div className="chat">
          {messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.role}`}>
              <span className={`avatar ${m.role}`}>
                {m.role === "ai" ? <Sparkles size={12} /> : <User size={12} />}
              </span>
              <div className={`msg ${m.role}`}>
                {m.steps?.map((s, j) => (
                  <div className="step-line" key={j} style={{ animationDelay: `${j * 0.06}s` }}>
                    <span className="step-check">
                      <Check size={10} strokeWidth={3.2} />
                    </span>
                    <span>{s}</span>
                  </div>
                ))}
                {m.text && <div className="msg-text">{m.text}</div>}
                {m.engine && !m.streaming && (
                  <span className={`engine-tag ${m.engine}`}>
                    {m.engine === "agnes" ? "由 Agnes AI 規劃" : "由本地引擎規劃"}
                  </span>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="msg-row ai">
              <span className="avatar ai">
                <Sparkles size={12} />
              </span>
              <div className="msg ai thinking-box">
                <span className="thinking-label">AI 思考中</span>
                <span className="dots">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="composer">
        <div className="chips">
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="chip" onClick={() => send(ex)} disabled={thinking}>
              {ex.length > 16 ? ex.slice(0, 16) + "…" : ex}
            </button>
          ))}
        </div>
        <textarea
          value={input}
          placeholder="例如:幫我做一支海邊日落的短片,暖色調,標題「夏日」"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
        />
        <div className="composer-foot">
          <span className="hint">Ctrl/⌘ + Enter 送出</span>
          <button className="btn send" disabled={thinking || !input.trim()} onClick={() => send()}>
            {thinking ? "處理中…" : "送給 AI"}
            <SendHorizonal size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
