import { memo, useState } from "react";
import {
  Aperture,
  Captions,
  Image,
  Library,
  Loader2,
  Music,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sun,
  ThermometerSun,
  Timer,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import AssetThumb from "./AssetThumb";
import { t } from "../i18n";
import type {
  Asset,
  AudioClip,
  Clip,
  ClipFilters,
  SubtitleClip,
} from "../types";

interface Props {
  clip: Clip | null;
  assets: Asset[];
  audioClips: AudioClip[];
  subtitles: SubtitleClip[];
  selectedAudioId: string | null;
  selectedSubtitleId: string | null;
  uploading: boolean;
  uploadError: string | null;
  onFiles: (files: FileList | File[]) => void;
  onPickFiles: () => void;
  onAudioFiles: (files: FileList | File[]) => void;
  onPickAudioFiles: () => void;
  onAddToTimeline: (assetId: string) => void;
  onPatchClip: (id: string, patch: Partial<Clip>) => void;
  onUpdateFilter: (key: keyof ClipFilters, value: number | boolean | string) => void;
  onDelete: (id: string) => void;
  onAddAudioPreset: () => void;
  onPatchAudio: (id: string, patch: Partial<AudioClip>) => void;
  onDeleteAudio: (id: string) => void;
  onSelectAudio: (id: string | null) => void;
  onAddSubtitle: () => void;
  onPatchSubtitle: (id: string, patch: Partial<SubtitleClip>) => void;
  onDeleteSubtitle: (id: string) => void;
  onSelectSubtitle: (id: string | null) => void;
  generating: boolean;
  onGenerateMedia: (prompt: string, kind: "image" | "video") => void;
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
  video: "上傳影片",
  image: "AI 圖片",
};

function GenerateBox({
  generating,
  onGenerateMedia,
}: {
  generating: boolean;
  onGenerateMedia: (prompt: string, kind: "image" | "video") => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"image" | "video">("image");
  return (
    <div className="generate-zone">
      <div className="generate-head">
        <Sparkles size={14} />
        <span>{t("generateZone")}</span>
      </div>
      <textarea
        className="generate-input"
        value={prompt}
        placeholder="例如：夕陽下的海邊，電影感，高細節"
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
      />
      <div className="generate-row">
        <div className="generate-kinds">
          {(["image", "video"] as const).map((k) => (
            <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)} title={k === "image" ? t("generateImage") : t("generateVideo")}>
              {k === "image" ? <Image size={12} /> : <Video size={12} />}
              {k === "image" ? t("generateImage") : t("generateVideo")}
            </button>
          ))}
        </div>
        <button
          className="btn ghost small"
          disabled={generating || !prompt.trim()}
          onClick={() => {
            onGenerateMedia(prompt.trim(), kind);
          }}
        >
          {generating ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          {t("generate")}
        </button>
      </div>
    </div>
  );
}

function UploadBox({
  title,
  sub,
  onPickFiles,
  onFiles,
  uploading,
  error,
}: {
  title: string;
  sub: string;
  onPickFiles: () => void;
  onFiles: (files: FileList | File[]) => void;
  uploading: boolean;
  error: string | null;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`upload-zone ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <div className="upload-zone-icon">
        <Upload size={16} />
      </div>
      <div className="upload-zone-text">
        <div className="upload-title">{title}</div>
        <div className="upload-sub">{sub}</div>
      </div>
      <button className="btn ghost small" onClick={onPickFiles} disabled={uploading}>
        {uploading ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
        選擇
      </button>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}

const Inspector = memo(function Inspector({
  clip,
  assets,
  audioClips,
  subtitles,
  selectedAudioId,
  selectedSubtitleId,
  uploading,
  uploadError,
  onFiles,
  onPickFiles,
  onAudioFiles,
  onPickAudioFiles,
  onAddToTimeline,
  onPatchClip,
  onUpdateFilter,
  onDelete,
  onAddAudioPreset,
  onPatchAudio,
  onDeleteAudio,
  onSelectAudio,
  onAddSubtitle,
  onPatchSubtitle,
  onDeleteSubtitle,
  onSelectSubtitle,
  generating,
  onGenerateMedia,
}: Props) {
  const [tab, setTab] = useState<"media" | "audio" | "subs">("media");
  const clipAsset = clip ? assets.find((a) => a.id === clip.assetId) : undefined;
  const selectedAudio = audioClips.find((a) => a.id === selectedAudioId) ?? null;
  const selectedSub = subtitles.find((s) => s.id === selectedSubtitleId) ?? null;

  return (
    <>
      <div className="panel-head">
        <h2>工作面板</h2>
        <span className="conn-pill off">
          <Library size={11} />
          {assets.length} 素材
        </span>
      </div>

      <div className="inspector-tabs">
        <button className={tab === "media" ? "on" : ""} onClick={() => setTab("media")}>
          {t("media")}
        </button>
        <button className={tab === "audio" ? "on" : ""} onClick={() => setTab("audio")}>
          {t("audio")}
          {audioClips.length > 0 && <i>{audioClips.length}</i>}
        </button>
        <button className={tab === "subs" ? "on" : ""} onClick={() => setTab("subs")}>
          {t("subs")}
          {subtitles.length > 0 && <i>{subtitles.length}</i>}
        </button>
      </div>

      <div className="scroll">
        {tab === "media" && (
          <MediaTab
            clip={clip}
            clipAsset={clipAsset}
            assets={assets}
            uploading={uploading}
            uploadError={uploadError}
            generating={generating}
            onGenerateMedia={onGenerateMedia}
            onFiles={onFiles}
            onPickFiles={onPickFiles}
            onAddToTimeline={onAddToTimeline}
            onPatchClip={onPatchClip}
            onUpdateFilter={onUpdateFilter}
            onDelete={onDelete}
          />
        )}

        {tab === "audio" && (
          <AudioTab
            clips={audioClips}
            selectedAudio={selectedAudio}
            uploading={uploading}
            uploadError={uploadError}
            onPickFiles={onPickAudioFiles}
            onFiles={onAudioFiles}
            onAddPreset={onAddAudioPreset}
            onSelect={onSelectAudio}
            onPatch={onPatchAudio}
            onDelete={onDeleteAudio}
          />
        )}

        {tab === "subs" && (
          <SubtitleTab
            clips={subtitles}
            selectedSub={selectedSub}
            onAdd={onAddSubtitle}
            onSelect={onSelectSubtitle}
            onPatch={onPatchSubtitle}
            onDelete={onDeleteSubtitle}
          />
        )}
      </div>
    </>
  );
});

export default Inspector;

function MediaTab({
  clip,
  clipAsset,
  assets,
  uploading,
  uploadError,
  generating,
  onGenerateMedia,
  onFiles,
  onPickFiles,
  onAddToTimeline,
  onPatchClip,
  onUpdateFilter,
  onDelete,
}: {
  clip: Clip | null;
  clipAsset: Asset | undefined;
  assets: Asset[];
  uploading: boolean;
  uploadError: string | null;
  generating: boolean;
  onGenerateMedia: (prompt: string, kind: "image" | "video") => void;
  onFiles: (files: FileList | File[]) => void;
  onPickFiles: () => void;
  onAddToTimeline: (assetId: string) => void;
  onPatchClip: (id: string, patch: Partial<Clip>) => void;
  onUpdateFilter: (key: keyof ClipFilters, value: number | boolean | string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <GenerateBox generating={generating} onGenerateMedia={onGenerateMedia} />
      <UploadBox
        title="上傳影片素材"
        sub="選擇檔案或拖曳影片到這裡"
        onPickFiles={onPickFiles}
        onFiles={onFiles}
        uploading={uploading}
        error={uploadError}
      />
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
            <input type="text" value={clip.name} onChange={(e) => onPatchClip(clip.id, { name: e.target.value })} />
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
                片段字幕(舊式)
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
          <p>AI 生成或找到的素材會出現在這裡,每一段都有即時預覽。</p>
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
                  <span className="mono">
                    {a.kind === "video" ? a.duration.toFixed(1) + "s" : `${a.palette} · ${a.motion}`}
                  </span>
                </div>
                <button className="btn ghost small asset-add" onClick={() => onAddToTimeline(a.id)}>
                  <Plus size={12} />
                  加入時間軸
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AudioTab({
  clips,
  selectedAudio,
  uploading,
  uploadError,
  onPickFiles,
  onFiles,
  onAddPreset,
  onSelect,
  onPatch,
  onDelete,
}: {
  clips: AudioClip[];
  selectedAudio: AudioClip | null;
  uploading: boolean;
  uploadError: string | null;
  onPickFiles: () => void;
  onFiles: (files: FileList | File[]) => void;
  onAddPreset: () => void;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<AudioClip>) => void;
  onDelete: (id: string) => void;
}) {
  const list: AudioClip[] = clips;
  const selAudioId = selectedAudio?.id ?? null;
  return (
    <>
      <UploadBox
        title="上傳音訊"
        sub="背景音樂 / MP3、WAV…"
        onPickFiles={onPickFiles}
        onFiles={onFiles}
        uploading={uploading}
        error={uploadError}
      />
      <button className="btn ghost small wide" onClick={onAddPreset}>
        <Music size={13} />
        加入內建背景音樂
      </button>
      {selectedAudio ? (
        <div className="inspector-body">
          <div className="field">
            <label>
              <span className="field-label">
                <Music size={12} />
                名稱
              </span>
            </label>
            <input type="text" value={selectedAudio.name} onChange={(e) => onPatch(selectedAudio.id, { name: e.target.value })} />
          </div>
          <SliderField
            icon={<Timer size={12} />}
            label="起始時間"
            value={selectedAudio.start}
            min={0}
            max={120}
            step={0.1}
            format={(v) => `${v.toFixed(1)} 秒`}
            onChange={(v) => onPatch(selectedAudio.id, { start: v })}
          />
          <SliderField
            icon={<Timer size={12} />}
            label="長度"
            value={selectedAudio.length}
            min={0.3}
            max={60}
            step={0.1}
            format={(v) => `${v.toFixed(1)} 秒`}
            onChange={(v) => onPatch(selectedAudio.id, { length: v })}
          />
          <SliderField
            icon={<Music size={12} />}
            label="音量"
            value={selectedAudio.volume * 100}
            min={0}
            max={100}
            format={(v) => `${Math.round(v)}%`}
            onChange={(v) => onPatch(selectedAudio.id, { volume: Math.round(v) / 100 })}
          />
          <div className="field row">
            <span className="field-label">循環播放</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!selectedAudio.loop}
                onChange={(e) => onPatch(selectedAudio.id, { loop: e.target.checked })}
              />
              <span className="knob" />
            </label>
          </div>
          <button className="btn danger" onClick={() => onDelete(selectedAudio.id)}>
            <Trash2 size={14} />
            刪除音軌
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="empty-note">
          <p>音軌可在預覽與匯出時播放。</p>
          <p className="dim">加入內建音樂或上傳自己的音訊,再到時間軸拖動/改長度。</p>
        </div>
      ) : (
        <div className="asset-list">
          {list.map((a: AudioClip) => (
            <button key={a.id} className={`asset clickable ${a.id === selAudioId ? "selected" : ""}`} onClick={() => onSelect(a.id)}>
              <div className="asset-info">
                <div className="name">
                  <Music size={12} /> {a.name}
                </div>
                <div className="meta">
                  <span className="asset-kind k-video">{a.source === "preset" ? "內建音樂" : "上傳音訊"}</span>
                  <span className="mono">{a.length.toFixed(1)}s · {Math.round(a.volume * 100)}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function SubtitleTab({
  clips,
  selectedSub,
  onAdd,
  onSelect,
  onPatch,
  onDelete,
}: {
  clips: SubtitleClip[];
  selectedSub: SubtitleClip | null;
  onAdd: () => void;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<SubtitleClip>) => void;
  onDelete: (id: string) => void;
}) {
  const list: SubtitleClip[] = clips;
  const selSubId = selectedSub?.id ?? null;
  return (
    <>
      <button className="btn ghost small wide" onClick={onAdd}>
        <Plus size={13} />
        在目前播放頭新增字幕
      </button>
      {selectedSub ? (
        <div className="inspector-body">
          <div className="field">
            <label>
              <span className="field-label">
                <Pencil size={12} />
                字幕文字
              </span>
            </label>
            <input
              type="text"
              value={selectedSub.text}
              onChange={(e) => onPatch(selectedSub.id, { text: e.target.value })}
            />
          </div>
          <SliderField
            icon={<Timer size={12} />}
            label="起始時間"
            value={selectedSub.start}
            min={0}
            max={120}
            step={0.1}
            format={(v) => `${v.toFixed(1)} 秒`}
            onChange={(v) => onPatch(selectedSub.id, { start: v })}
          />
          <SliderField
            icon={<Timer size={12} />}
            label="持續時間"
            value={selectedSub.length}
            min={0.3}
            max={15}
            step={0.1}
            format={(v) => `${v.toFixed(1)} 秒`}
            onChange={(v) => onPatch(selectedSub.id, { length: v })}
          />
          <div className="field">
            <label>
              <span className="field-label">位置</span>
            </label>
            <div className="seg">
              {(["bottom", "center", "top"] as const).map((p) => (
                <button
                  key={p}
                  className={selectedSub.style?.position === p || (p === "bottom" && !selectedSub.style?.position) ? "on" : ""}
                  onClick={() => onPatch(selectedSub.id, { style: { ...selectedSub.style, position: p } })}
                >
                  {p === "bottom" ? "底部" : p === "center" ? "中間" : "上方"}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>
              <span className="field-label">字級比例</span>
            </label>
            <input
              type="range"
              min={0.03}
              max={0.1}
              step={0.005}
              value={selectedSub.style?.size ?? 0.05}
              onChange={(e) => onPatch(selectedSub.id, { style: { ...selectedSub.style, size: parseFloat(e.target.value) } })}
            />
          </div>
          <button className="btn danger" onClick={() => onDelete(selectedSub.id)}>
            <Trash2 size={14} />
            刪除字幕
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="empty-note">
          <p>字幕軌會顯示在影片畫面上。</p>
          <p className="dim">在播放頭位置新增一條字幕,再填入文字、調整時段。</p>
        </div>
      ) : (
        <div className="asset-list">
          {list.map((s: SubtitleClip) => (
            <button key={s.id} className={`asset clickable ${s.id === selSubId ? "selected" : ""}`} onClick={() => onSelect(s.id)}>
              <div className="asset-info">
                <div className="name">
                  <Pencil size={12} /> {s.text || "字幕"}
                </div>
                <div className="meta">
                  <span className="asset-kind k-found">字幕</span>
                  <span className="mono">{s.start.toFixed(1)}s → {(s.start + s.length).toFixed(1)}s</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
