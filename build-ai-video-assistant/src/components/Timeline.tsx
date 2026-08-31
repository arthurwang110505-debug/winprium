import { ZoomIn, ZoomOut } from "lucide-react";
import AssetThumb from "./AssetThumb";
import type { Asset, Clip } from "../types";

export type DragMode = "move" | "resize-left" | "resize-right";

interface Props {
  clips: Clip[];
  assetsById: Record<string, Asset>;
  selectedClipId: string | null;
  time: number;
  totalDuration: number;
  pxPerSec: number;
  onZoom: (dir: 1 | -1) => void;
  onSelect: (id: string | null) => void;
  onClipMouseDown: (e: React.MouseEvent, clip: Clip, mode: DragMode) => void;
  onScrub: (t: number) => void;
}

export default function Timeline({
  clips,
  assetsById,
  selectedClipId,
  time,
  totalDuration,
  pxPerSec,
  onZoom,
  onSelect,
  onClipMouseDown,
  onScrub,
}: Props) {
  const labelStep = pxPerSec >= 70 ? 1 : pxPerSec >= 45 ? 2 : 5;
  const labelCount = Math.ceil(totalDuration) + 1;
  const contentWidth = Math.max(totalDuration * pxPerSec + 80, 400);

  function rulerScrub(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.min(totalDuration, Math.max(0, (e.clientX - rect.left) / pxPerSec));
    onScrub(t);
  }

  return (
    <div className="timeline">
      <div className="tl-head">
        <span className="tl-title">
          時間軸
          <em>
            {clips.length} 段 · 總長 {totalDuration.toFixed(1)}s
          </em>
        </span>
        <span className="tl-tip">拖動整塊搬移 · 拖兩側白邊改長度 · 點一下選取</span>
        <div className="tl-zoom">
          <button className="icon-btn" onClick={() => onZoom(-1)} title="縮小" aria-label="縮小時間軸">
            <ZoomOut size={14} />
          </button>
          <span className="tl-zoom-val">{pxPerSec}px/s</span>
          <button className="icon-btn" onClick={() => onZoom(1)} title="放大" aria-label="放大時間軸">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div
        className="tl-scroll"
        onClick={(e) => {
          // 點到片段(mousedown 已選取)或刻度尺(已跳轉)時,不取消選取
          const el = e.target as HTMLElement;
          if (el.closest(".clip") || el.closest(".tl-ruler")) return;
          onSelect(null);
        }}
      >
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

          <div className="track">
            {clips.length === 0 && (
              <div className="track-empty">時間軸是空的 — 在左邊打一句話,讓 AI 生成第一版草稿。</div>
            )}
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
                  <div
                    className="handle left"
                    onMouseDown={(e) => onClipMouseDown(e, c, "resize-left")}
                  />
                  <div
                    className="handle right"
                    onMouseDown={(e) => onClipMouseDown(e, c, "resize-right")}
                  />
                </div>
              );
            })}
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
}
