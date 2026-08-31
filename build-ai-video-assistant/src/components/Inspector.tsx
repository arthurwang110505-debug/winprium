import {
  Aperture,
  Captions,
  Library,
  SlidersHorizontal,
  Sun,
  ThermometerSun,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import AssetThumb from "./AssetThumb";
import type { Asset, Clip, ClipFilters } from "../types";

interface Props {
  clip: Clip | null;
  assets: Asset[];
  onPatchClip: (id: string, patch: Partial<Clip>) => void;
  onUpdateFilter: (key: keyof ClipFilters, value: number | boolean | string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function SliderField({
  icon,
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>
        <span className="field-label">
          {icon}
          {label}
        </span>
        <span className="field-val mono">{format ? format(value) : value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

const KIND_LABEL: Record<Asset["kind"], string> = {
  generated: "AI 生成",
  found: "素材庫",
  title: "標題卡",
};

export default function Inspector({ clip, assets, onPatchClip, onUpdateFilter, onDelete, onClose }: Props) {
  const clipAsset = clip ? assets.find((a) => a.id === clip.assetId) : undefined;

  return (
    <>
      <div className="panel-head">
        <h2>{clip ? "微調片段" : "素材庫"}</h2>
        {clip ? (
          <button className="icon-btn" onClick={onClose} title="取消選取" aria-label="取消選取">
            <X size={14} />
          </button>
        ) : (
          <span className="conn-pill off">
            <Library size={11} />
            {assets.length} 個素材
          </span>
        )}
      </div>

      <div className="scroll">
        {clip ? (
          <div className="inspector-body">
            {clipAsset && (
              <div className="clip-preview">
                <AssetThumb
                  asset={clipAsset}
                  width={272}
                  height={153}
                  t={Math.min(0.9, ((clip.in || 0) + clip.length / 2) / clipAsset.duration)}
                  filters={clip.filters}
                  className="clip-preview-canvas"
                />
                <span className="clip-preview-tag mono">
                  {clip.start.toFixed(1)}s → {(clip.start + clip.length).toFixed(1)}s
                </span>
              </div>
            )}

            <div className="field">
              <label>
                <span className="field-label">
                  <SlidersHorizontal size={12} />
                  片段名稱
                </span>
              </label>
              <input
                type="text"
                value={clip.name}
                onChange={(e) => onPatchClip(clip.id, { name: e.target.value })}
              />
            </div>

            <SliderField
              icon={<Timer size={12} />}
              label="長度"
              value={clip.length}
              min={0.3}
              max={8}
              step={0.1}
              format={(v) => `${v.toFixed(1)} 秒`}
              onChange={(v) => onPatchClip(clip.id, { length: v })}
            />
            <SliderField
              icon={<Sun size={12} />}
              label="亮度"
              value={clip.filters?.brightness || 0}
              min={-100}
              max={100}
              onChange={(v) => onUpdateFilter("brightness", v)}
            />
            <SliderField
              icon={<ThermometerSun size={12} />}
              label="色溫(冷 ← → 暖)"
              value={clip.filters?.warmth || 0}
              min={-100}
              max={100}
              onChange={(v) => onUpdateFilter("warmth", v)}
            />
            <SliderField
              icon={<Aperture size={12} />}
              label="電影暗角"
              value={clip.filters?.vignette || 0}
              min={0}
              max={100}
              onChange={(v) => onUpdateFilter("vignette", v)}
            />

            <div className="field row">
              <span className="field-label">黑白</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!clip.filters?.grayscale}
                  onChange={(e) => onUpdateFilter("grayscale", e.target.checked)}
                />
                <span className="knob" />
              </label>
            </div>

            <div className="field">
              <label>
                <span className="field-label">
                  <Captions size={12} />
                  字幕文字(留空則不顯示)
                </span>
              </label>
              <input
                type="text"
                value={clip.filters?.caption || ""}
                placeholder="在這段畫面上加字幕"
                onChange={(e) => onUpdateFilter("caption", e.target.value)}
              />
            </div>

            <button className="btn danger" onClick={() => onDelete(clip.id)}>
              <Trash2 size={14} />
              刪除這個片段
            </button>
          </div>
        ) : assets.length === 0 ? (
          <div className="empty-note">
            <p>
              AI 生成或找到的素材會出現在這裡,每一段都有即時預覽。
            </p>
            <p className="dim">點時間軸上的片段,就能在這裡微調亮度、色溫、暗角、字幕等。</p>
          </div>
        ) : (
          <div className="asset-list">
            <div className="empty-tip">點時間軸上的片段即可微調;以下是這次草稿用到的素材。</div>
            {assets.map((a) => (
              <div className="asset" key={a.id}>
                <AssetThumb asset={a} width={232} height={128} className="thumb" />
                <div className="asset-info">
                  <div className="name">{a.name}</div>
                  <div className="meta">
                    <span className={`asset-kind k-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
                    <span className="mono">{a.palette} · {a.motion}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
