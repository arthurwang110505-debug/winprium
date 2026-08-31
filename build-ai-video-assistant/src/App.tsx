import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Film, Pause, Play, SkipBack } from "lucide-react";
import { planEdit } from "./planner";
import { getSettings, hasApiKey } from "./agnes";
import { drawAssetFrame } from "./assets";
import type { AgnesSettings, Asset, ChatMsg, Clip, ClipFilters } from "./types";
import TopBar from "./components/TopBar";
import ChatPanel from "./components/ChatPanel";
import Timeline, { type DragMode } from "./components/Timeline";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/SettingsModal";

const CANVAS_W = 960;
const CANVAS_H = 540;
const ZOOM_STEPS = [50, 70, 90, 120, 160];

function greeting(hasKey: boolean): string {
  return (
    "嗨,我是你的 AI 剪輯助理。\n\n" +
    "打一句話描述想要的影片,我會幫你規劃素材、排好時間軸,你再審片與微調。\n" +
    "試試下方的範例,或直接輸入你的想法。" +
    (hasKey
      ? ""
      : "\n\n(尚未設定 Agnes API 金鑰,目前使用內建本地規則引擎;點右上角齒輪貼上金鑰,即可啟用 Agnes AI。)")
  );
}

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const s = Math.floor(t % 60);
  const m = Math.floor(t / 60);
  const cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export default function App() {
  const [conn, setConn] = useState<AgnesSettings>(() => getSettings());
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    { role: "ai", text: greeting(hasApiKey()) },
  ]);
  const [thinking, setThinking] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(2);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pxPerSec = ZOOM_STEPS[zoomIdx];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const clipsRef = useRef<Clip[]>([]);
  const assetsRef = useRef<Record<string, Asset>>({});
  const dragRef = useRef<{
    clipId: string;
    mode: DragMode;
    startX: number;
    origStart: number;
    origLength: number;
    origIn: number;
    px: number;
  } | null>(null);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const assetsById = useMemo(() => {
    const map: Record<string, Asset> = {};
    for (const a of assets) map[a.id] = a;
    return map;
  }, [assets]);

  useEffect(() => {
    assetsRef.current = assetsById;
  }, [assetsById]);

  const totalDuration = useMemo(
    () => clips.reduce((m, c) => Math.max(m, c.start + c.length), 0),
    [clips]
  );

  // 片段被刪短後,播放頭不要超出總長
  useEffect(() => {
    if (time > totalDuration) setTime(totalDuration);
  }, [totalDuration, time]);

  const clipAtTime = useCallback((t: number): Clip | null => {
    for (const c of clipsRef.current) {
      if (t >= c.start && t < c.start + c.length) return c;
    }
    return null;
  }, []);

  const renderFrame = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const clip = clipAtTime(t);
      if (!clip) {
        ctx.fillStyle = "#05060a";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.font = `500 18px "Sora", "Noto Sans TC", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("— 空白軌 —", CANVAS_W / 2, CANVAS_H / 2);
        return;
      }
      const asset = assetsRef.current[clip.assetId];
      if (!asset) return;
      const localT = ((t - clip.start + (clip.in || 0)) % asset.duration) / asset.duration;
      drawAssetFrame(ctx, CANVAS_W, CANVAS_H, asset, localT, clip.filters || {});
    },
    [clipAtTime]
  );

  // 播放迴圈
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastTsRef.current = performance.now();
    const loop = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((prev) => {
        const total = clipsRef.current.reduce((m, c) => Math.max(m, c.start + c.length), 0);
        let next = prev + dt;
        if (next >= total) next = 0; // 循環播放
        renderFrame(next);
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, renderFrame]);

  // 暫停時也要即時重繪(微調立即預覽)
  useEffect(() => {
    if (!playing) renderFrame(time);
  }, [time, clips, assetsById, playing, renderFrame]);

  // ---- 送出 AI 指令 ----
  async function handleSend(prompt: string) {
    if (thinking) return;
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setThinking(true);

    const plan = await planEdit(prompt);

    // 逐步揭示 AI 的行動紀錄(agent 感)
    for (let i = 0; i < plan.notes.length; i++) {
      await new Promise((r) => setTimeout(r, 320));
      const note = plan.notes[i];
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last && last.role === "ai" && last.streaming) {
          const updated = [...m];
          updated[updated.length - 1] = {
            ...last,
            steps: [...(last.steps || []), note],
          };
          return updated;
        }
        return [...m, { role: "ai", streaming: true, text: "", steps: [note] }];
      });
    }

    setAssets((prev) => [...prev, ...plan.assets]);
    setClips(plan.clips);
    setSelectedClipId(plan.clips[0]?.id ?? null);
    setTime(0);
    setPlaying(false);

    await new Promise((r) => setTimeout(r, 200));
    setMessages((m) => {
      const updated = [...m];
      const last = updated[updated.length - 1];
      const payload: Partial<ChatMsg> = {
        streaming: false,
        text: plan.summary,
        engine: plan.engine,
      };
      if (last && last.streaming) updated[updated.length - 1] = { ...last, ...payload };
      else updated.push({ role: "ai", text: plan.summary, engine: plan.engine });
      return updated;
    });
    setThinking(false);
  }

  // ---- 時間軸拖曳 ----
  function onClipMouseDown(e: React.MouseEvent, clip: Clip, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      clipId: clip.id,
      mode,
      startX: e.clientX,
      origStart: clip.start,
      origLength: clip.length,
      origIn: clip.in || 0,
      px: pxPerSec,
    };
    setSelectedClipId(clip.id);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    const d = dragRef.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / d.px;
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== d.clipId) return c;
        if (d.mode === "move") return { ...c, start: Math.max(0, d.origStart + deltaSec) };
        if (d.mode === "resize-right")
          return { ...c, length: Math.max(0.3, d.origLength + deltaSec) };
        if (d.mode === "resize-left") {
          const newStart = Math.max(0, d.origStart + deltaSec);
          const consumed = newStart - d.origStart;
          const newLen = Math.max(0.3, d.origLength - consumed);
          return { ...c, start: newStart, length: newLen, in: d.origIn + consumed };
        }
        return c;
      })
    );
  }

  function onDragEnd() {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }

  // ---- 進度條(支援按住拖) ----
  const scrubbingRef = useRef(false);
  function scrubTo(clientX: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setTime(ratio * (totalDuration || 0));
  }
  function onScrubberDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!clips.length) return;
    setPlaying(false);
    scrubbingRef.current = true;
    const el = e.currentTarget; // React 事件回收後 currentTarget 會是 null,先存起來
    scrubTo(e.clientX, el);
    const move = (ev: MouseEvent) => {
      if (scrubbingRef.current) scrubTo(ev.clientX, el);
    };
    const up = () => {
      scrubbingRef.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  // ---- 片段操作 ----
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;

  const patchClip = useCallback((id: string, patch: Partial<Clip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const updateFilter = useCallback(
    (key: keyof ClipFilters, value: number | boolean | string) => {
      if (!selectedClipId) return;
      setClips((prev) =>
        prev.map((c) =>
          c.id === selectedClipId ? { ...c, filters: { ...c.filters, [key]: value } } : c
        )
      );
    },
    [selectedClipId]
  );

  const deleteClip = useCallback(
    (id: string) => {
      setClips((prev) => prev.filter((c) => c.id !== id));
      if (selectedClipId === id) setSelectedClipId(null);
    },
    [selectedClipId]
  );

  // ---- 快捷鍵:Space 播放 · Delete 刪除 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (clipsRef.current.length) setPlaying((p) => !p);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        e.preventDefault();
        deleteClip(selectedClipId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedClipId, deleteClip]);

  function handleZoom(dir: 1 | -1) {
    setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir)));
  }

  function handleTimelineScrub(t: number) {
    setPlaying(false);
    setTime(t);
  }

  function handleReset() {
    if (!window.confirm("確定要清空目前的草稿、重新開始嗎?")) return;
    setClips([]);
    setAssets([]);
    setSelectedClipId(null);
    setPlaying(false);
    setTime(0);
    setMessages([{ role: "ai", text: greeting(hasApiKey()) }]);
  }

  const currentClipName = clipAtTime(time)?.name;

  return (
    <div className="app">
      <TopBar
        hasKey={conn.apiKey.length > 0}
        model={conn.model}
        onOpenSettings={() => setSettingsOpen(true)}
        onReset={handleReset}
      />

      <div className="main">
        {/* 左:AI 聊天 */}
        <section className="panel left">
          <ChatPanel
            messages={messages}
            thinking={thinking}
            connected={conn.apiKey.length > 0}
            onSend={handleSend}
          />
        </section>

        {/* 中:預覽 + 控制列 + 時間軸 */}
        <section className="center">
          <div className="preview-wrap">
            <canvas
              ref={canvasRef}
              className={`preview-canvas ${clips.length ? "" : "idle"}`}
              width={CANVAS_W}
              height={CANVAS_H}
            />
            {clips.length === 0 && (
              <div className="preview-empty">
                <span className="preview-empty-icon">
                  <Film size={34} strokeWidth={1.4} />
                </span>
                <p className="preview-empty-title">還沒有內容</p>
                <p className="preview-empty-sub">
                  在左邊打一句話,讓 AI 幫你生成第一版草稿。
                  <br />
                  例如「幫我做一支海邊日落的短片,暖色調,標題『夏日』」。
                </p>
              </div>
            )}
          </div>

          <div className="transport">
            <button
              className="btn play"
              onClick={() => setPlaying((p) => !p)}
              disabled={!clips.length}
              title="Space"
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
              {playing ? "暫停" : "播放"}
            </button>
            <button
              className="icon-btn-lg"
              onClick={() => {
                setPlaying(false);
                setTime(0);
              }}
              disabled={!clips.length}
              title="回到開頭"
            >
              <SkipBack size={15} />
            </button>
            <div className="time mono">
              {fmt(time)} <span className="time-total">/ {fmt(totalDuration)}</span>
            </div>
            {currentClipName && <span className="now-clip mono">{currentClipName}</span>}
            <div
              className={`scrubber ${clips.length ? "" : "disabled"}`}
              onMouseDown={onScrubberDown}
            >
              <div
                className="fill"
                style={{ width: `${totalDuration ? (time / totalDuration) * 100 : 0}%` }}
              />
              <div
                className="scrub-knob"
                style={{ left: `${totalDuration ? (time / totalDuration) * 100 : 0}%` }}
              />
            </div>
          </div>

          <Timeline
            clips={clips}
            assetsById={assetsById}
            selectedClipId={selectedClipId}
            time={time}
            totalDuration={totalDuration}
            pxPerSec={pxPerSec}
            onZoom={handleZoom}
            onSelect={setSelectedClipId}
            onClipMouseDown={onClipMouseDown}
            onScrub={handleTimelineScrub}
          />
        </section>

        {/* 右:素材庫 + 微調 */}
        <section className="panel right">
          <Inspector
            clip={selectedClip}
            assets={assets}
            onPatchClip={patchClip}
            onUpdateFilter={updateFilter}
            onDelete={deleteClip}
            onClose={() => setSelectedClipId(null)}
          />
        </section>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setConn(getSettings())}
      />
    </div>
  );
}
