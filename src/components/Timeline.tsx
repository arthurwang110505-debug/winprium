import { memo } from "react";
import { Magnet, Mic2, Pencil, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import AssetThumb from "./AssetThumb";
import { t } from "../i18n";
import type { Asset, AudioClip, Clip, SubtitleClip } from "../types";

export type DragMode = "move" | "resize-left" | "resize-right";

interface Props {
  clips: Clip[];
  audioClips: AudioClip[];
  subtitles: SubtitleClip[];
  assetsById: Record<string, Asset>;
  selectedClipId: string | null;
  selectedAudioId: string | null;
  selectedSubtitleId: string | null;
  time: number;
  totalDuration: number;
  pxPerSec: number;
  onZoom: (dir: 1 | -1) => void;
  onSelect: (id: string | null) => void;
  onClipMouseDown: (e: React.MouseEvent, clip: Clip, mode: DragMode) => void;
  onAudioMouseDown: (e: React.MouseEvent, clip: AudioClip, mode: DragMode) => void;
  onSubtitleMouseDown: (e: React.MouseEvent, sub: SubtitleClip, mode: DragMode) => void;
  onScrub: (t: number) => void;
  onTighten: () => void;
}

const Timeline = memo(function Timeline({
  clips,
  audioClips,
  subtitles,
  assetsById,
  selectedClipId,
  selectedAudioId,
  selectedSubtitleId,
  time,
  totalDuration,
  pxPerSec,
  onZoom,
  onSelect,
  onClipMouseDown,
  onAudioMouseDown,
  onSubtitleMouseDown,
  onScrub,
  onTighten,
}: Props) {
  const labelStep = pxPerSec >= 70 ? 1 : pxPerSec >= 45 ? 2 : 5;
  const labelCount = Math.ceil(totalDuration) + 1;
  const contentWidth = Math.max(totalDuration * pxPerSec + 80, 400);

  function rulerScrub(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.min(totalDuration, Math.max(0, (e.clientX - rect.left) / pxPerSec));
    onScrub(t);
  }

  function clearSelect(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement;
    if (
      el.closest(".clip") ||
      el.closest(".tl-ruler") ||
      el.closest(".audio-clip") ||
      el.closest(".sub-clip")
    )
      return;
    onSelect(null);
  }

  return (
    <div className="timeline">
      <div className="tl-head">
        <span className="tl-title">
          {t("timeline")}
          <em>
            影片 {clips.length} 段 · 音軌 {audioClips.length} · 字幕 {subtitles.length} · 總長{" "}
            {totalDuration.toFixed(1)}s
          </em>
        </span>
        <span className="tl-tip">拖動搬移(自動吸附) · 拖兩側改長度 · 點兩下字幕改名 · Ctrl+Z 復原</span>
        <div className="tl-tools">
          <button
            className="btn ghost small"
            onClick={onTighten}
            disabled={clips.length < 2}
            title="把所有影片片段往前收合,移除空隙"
          >
            <Magnet size={13} />
            {t("tighten")}
          </button>
          <div className="tl-zoom">
            <button className="icon-btn" onClick={() => onZoom(-1)} title={t("zoomOut")} aria-label={t("zoomOut")}>
              <ZoomOut size={14} />
            </button>
            <span className="tl-zoom-val">{pxPerSec}px/s</span>
            <button className="icon-btn" onClick={() => onZoom(1)} title={t("zoomIn")} aria-label={t("zoomIn")}>
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="tl-scroll" onClick={clearSelect}>
        <div className="tl-content" style={{ width: contentWidth }}>
          <div
            className="tl-ruler"
            onMouseDown={rulerScrub}
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0, transparent calc(100% - 1px), rgba(255,255,255,0.09) calc(100% - 1px)), repeating-linear-gradient(90deg, transparent 0, transparent calc(100% - 1px), rgba(255,255,255,0.2) calc(100% - 1px))",
              backgroundSize: `${pxPerSec / 2}px 100%, ${pxPerSec * labelStep}px 100%`,
            }}
          >
            {Array.from({ length: labelCount }).map((_, i) =>
              i % labelStep === 0 ? (
                <span key={i} className="tl-tick mono" style={{ left: i * pxPerSec + 4 }}>
                  {i}s
                </span>
              ) : null
            )}
          </div>

          {/* 影片軌 */}
          <div className="track" data-track="video">
            <div className="track-label">
              <FilmMini />
              <span>V</span>
            </div>
            {clips.length === 0 && <div className="track-empty">時間軸是空的 — 在左邊打一句話,讓 AI 生成第一版草稿。</div>}
            {clips.map((c) => {
              const asset = assetsById[c.assetId];
              return (
                <div
                  key={c.id}
                  className={`clip ${c.id === selectedClipId ? "selected" : ""}`}
                  style={
                    {
                      left: c.start * pxPerSec,
                      width: Math.max(26, c.length * pxPerSec),
                      "--clip-color": c.color || "#46e0b8",
                    } as React.CSSProperties
                  }
                  onMouseDown={(e) => onClipMouseDown(e, c, "move")}
                >
                  {asset && (
                    <AssetThumb
                      asset={asset}
                      width={128}
                      height={72}
                      t={Math.min(0.9, ((c.in || 0) + 0.2) / asset.duration)}
                      filters={c.filters}
                      className="clip-canvas"
                    />
                  )}
                  <div className="clip-shade" />
                  <div className="label">
                    <span className="clip-name">{c.name}</span>
                    <span className="clip-dur mono">{c.length.toFixed(1)}s</span>
                  </div>
                  <div className="handle left" onMouseDown={(e) => onClipMouseDown(e, c, "resize-left")} />
                  <div className="handle right" onMouseDown={(e) => onClipMouseDown(e, c, "resize-right")} />
                </div>
              );
            })}
          </div>

          {/* 音軌 */}
          <div className="track audio" data-track="audio">
            <div className="track-label">
              <Volume2 size={11} />
              <span>A</span>
            </div>
            {audioClips.length === 0 && <div className="track-empty">背景音樂軌 — 在右側加音樂或上傳音訊。</div>}
            {audioClips.map((a) => (
              <div
                key={a.id}
                className={`audio-clip ${a.id === selectedAudioId ? "selected" : ""}`}
                style={
                  {
                    left: a.start * pxPerSec,
                    width: Math.max(26, a.length * pxPerSec),
                    "--audio-color": a.color || "#57d0ff",
                  } as React.CSSProperties
                }
                onMouseDown={(e) => onAudioMouseDown(e, a, "move")}
              >
                <Mic2 size={11} />
                <span className="audio-name">{a.name}</span>
                <span className="audio-dur mono">{a.length.toFixed(1)}s</span>
                <div className="handle left" onMouseDown={(e) => onAudioMouseDown(e, a, "resize-left")} />
                <div className="handle right" onMouseDown={(e) => onAudioMouseDown(e, a, "resize-right")} />
              </div>
            ))}
          </div>

          {/* 字幕軌 */}
          <div className="track subs" data-track="subs">
            <div className="track-label">
              <Pencil size={11} />
              <span>T</span>
            </div>
            {subtitles.length === 0 && <div className="track-empty">字幕軌 — 在右側新增字幕。</div>}
            {subtitles.map((s) => (
              <div
                key={s.id}
                className={`sub-clip ${s.id === selectedSubtitleId ? "selected" : ""}`}
                style={
                  {
                    left: s.start * pxPerSec,
                    width: Math.max(26, s.length * pxPerSec),
                  } as React.CSSProperties
                }
                onMouseDown={(e) => onSubtitleMouseDown(e, s, "move")}
              >
                <span className="sub-text">{s.text || "字幕"}</span>
                <div className="handle left" onMouseDown={(e) => onSubtitleMouseDown(e, s, "resize-left")} />
                <div className="handle right" onMouseDown={(e) => onSubtitleMouseDown(e, s, "resize-right")} />
              </div>
            ))}
          </div>

          {clips.length > 0 && (
            <div className="playhead" style={{ left: time * pxPerSec }}>
              <span className="playhead-cap" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Timeline;

function FilmMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 2v20M17 2v20M2 9h5M2 15h5M17 9h5M17 15h5" />
    </svg>
  );
}
