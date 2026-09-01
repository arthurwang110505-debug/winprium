import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Film, Pause, Play, SkipBack, Volume2, VolumeX } from "lucide-react";
import { planEdit } from "./planner";
import { getSettings, hasApiKey } from "./agnes";
import { CLIP_COLORS, drawAssetFrame, drawSubtitle, drawVideoAssetFrame, uid } from "./assets";
import { AUDIO_PRESETS, audioEngine, createAudioClipPreset, makeUploadAudioClip } from "./audio";
import type {
  AgnesSettings,
  AspectRatio,
  Asset,
  AudioClip,
  ChatMsg,
  Clip,
  ClipFilters,
  SubtitleClip,
} from "./types";
import TopBar from "./components/TopBar";
import ChatPanel from "./components/ChatPanel";
import Timeline, { type DragMode } from "./components/Timeline";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/SettingsModal";

const ZOOM_STEPS = [50, 70, 90, 120, 160];
const SNAP_STEP = 0.5;
const EDGE_SNAP = 0.2;
const ASPECT_SIZES: Record<AspectRatio, { w: number; h: number }> = {
  "16:9": { w: 960, h: 540 },
  "9:16": { w: 540, h: 960 },
  "1:1": { w: 720, h: 720 },
};
const SAVE_KEY = "winprium.project.v1";
const MAX_UPLOAD_MB = 400;
const MAX_UPLOAD_FILES = 10;

interface Snapshot {
  assets: Asset[];
  clips: Clip[];
  selectedClipId: string | null;
  audioClips: AudioClip[];
  subtitles: SubtitleClip[];
}

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

function snapVal(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export default function App() {
  const [conn, setConn] = useState<AgnesSettings>(() => getSettings());
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    { role: "ai", text: greeting(hasApiKey()) },
  ]);
  const [thinking, setThinking] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(2);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pastLen, setPastLen] = useState(0);
  const [futureLen, setFutureLen] = useState(0);

  const pxPerSec = ZOOM_STEPS[zoomIdx];
  const canvasSize = ASPECT_SIZES[aspect];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const clipsRef = useRef<Clip[]>([]);
  const audioClipsRef = useRef<AudioClip[]>([]);
  const subtitlesRef = useRef<SubtitleClip[]>([]);
  const assetsRef = useRef<Record<string, Asset>>({});
  const assetsListRef = useRef<Asset[]>([]);
  const selectedClipIdRef = useRef<string | null>(null);
  const selectedAudioIdRef = useRef<string | null>(null);
  const selectedSubtitleIdRef = useRef<string | null>(null);
  const draggingRef = useRef<{
    kind: "clip" | "audio" | "subtitle";
    targetId: string;
    mode: DragMode;
    startX: number;
    origStart: number;
    origLength: number;
    origIn: number;
    px: number;
  } | null>(null);
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const projectLoadedRef = useRef(false);
  const scrubbingRef = useRef(false);
  const recordingRef = useRef(false);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    audioClipsRef.current = audioClips;
  }, [audioClips]);

  useEffect(() => {
    subtitlesRef.current = subtitles;
  }, [subtitles]);

  useEffect(() => {
    assetsListRef.current = assets;
  }, [assets]);

  useEffect(() => {
    selectedClipIdRef.current = selectedClipId;
  }, [selectedClipId]);

  useEffect(() => {
    selectedAudioIdRef.current = selectedAudioId;
  }, [selectedAudioId]);

  useEffect(() => {
    selectedSubtitleIdRef.current = selectedSubtitleId;
  }, [selectedSubtitleId]);

  const assetsById = useMemo(() => {
    const map: Record<string, Asset> = {};
    for (const a of assets) map[a.id] = a;
    return map;
  }, [assets]);

  useEffect(() => {
    assetsRef.current = assetsById;
  }, [assetsById]);

  // ---- 歷史(Undo / Redo) ----
  const pushHistory = useCallback(() => {
    pastRef.current.push({
      assets: assetsListRef.current,
      clips: clipsRef.current,
      audioClips: audioClipsRef.current,
      subtitles: subtitlesRef.current,
      selectedClipId: selectedClipIdRef.current,
    });
    if (pastRef.current.length > 60) pastRef.current.shift();
    futureRef.current = [];
    setPastLen(pastRef.current.length);
    setFutureLen(0);
  }, []);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push({
      assets: assetsListRef.current,
      clips: clipsRef.current,
      audioClips: audioClipsRef.current,
      subtitles: subtitlesRef.current,
      selectedClipId: selectedClipIdRef.current,
    });
    setAssets(prev.assets);
    setClips(prev.clips);
    setAudioClips(prev.audioClips);
    setSubtitles(prev.subtitles);
    setSelectedClipId(prev.selectedClipId);
    setPlaying(false);
    setPastLen(pastRef.current.length);
    setFutureLen(futureRef.current.length);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push({
      assets: assetsListRef.current,
      clips: clipsRef.current,
      audioClips: audioClipsRef.current,
      subtitles: subtitlesRef.current,
      selectedClipId: selectedClipIdRef.current,
    });
    setAssets(next.assets);
    setClips(next.clips);
    setAudioClips(next.audioClips);
    setSubtitles(next.subtitles);
    setSelectedClipId(next.selectedClipId);
    setPlaying(false);
    setPastLen(pastRef.current.length);
    setFutureLen(futureRef.current.length);
  }, []);

  // ---- 影片素材管理(Blob URL → 隱藏 <video> 元素) ----
  function ensureVideoHost(): HTMLDivElement {
    if (!videoHostRef.current) {
      const host = document.createElement("div");
      host.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
      document.body.appendChild(host);
      videoHostRef.current = host;
    }
    return videoHostRef.current;
  }

  function getVideo(asset: Asset): HTMLVideoElement | null {
    if (asset.kind !== "video" || !asset.videoUrl) return null;
    const map = videoRefs.current;
    if (!map[asset.id]) {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = asset.videoUrl;
      v.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
      ensureVideoHost().appendChild(v);
      map[asset.id] = v;
    }
    return map[asset.id];
  }

  function pauseVideosExcept(activeId?: string) {
    for (const [id, v] of Object.entries(videoRefs.current)) {
      if (id !== activeId && !v.paused) v.pause();
    }
  }

  function revokeVideoUrls(list: Asset[]) {
    for (const a of list) {
      if (a.kind === "video" && a.videoUrl) URL.revokeObjectURL(a.videoUrl);
      const v = videoRefs.current[a.id];
      if (v) {
        v.pause();
        v.src = "";
        v.remove();
        delete videoRefs.current[a.id];
      }
    }
  }

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("video/"));
    if (!files.length) return;
    if (files.length > MAX_UPLOAD_FILES) {
      setUploadError(`一次最多上傳 ${MAX_UPLOAD_FILES} 支影片。`);
      return;
    }
    const oversize = files.find((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
    if (oversize) {
      setUploadError(`「${oversize.name}」超過 ${MAX_UPLOAD_MB}MB 上限,請先壓縮後再上傳。`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    let pending = files.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) setUploading(false);
    };
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const probe = document.createElement("video");
      probe.muted = true;
      probe.preload = "metadata";
      probe.src = url;
      probe.onloadedmetadata = () => {
        const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 6;
        const asset: Asset = {
          id: uid("asset"),
          name: file.name.replace(/\.[^.]+$/, "") || "上傳影片",
          kind: "video",
          palette: "mono",
          motion: "drift",
          label: file.name,
          seed: 0,
          duration,
          videoUrl: url,
        };
        setAssets((prev) => [...prev, asset]);
        setSelectedClipId(null);
        probe.remove();
        done();
      };
      probe.onerror = () => {
        URL.revokeObjectURL(url);
        setUploadError(`無法讀取影片:${file.name}(格式可能不受瀏覽器支援)`);
        probe.remove();
        done();
      };
    });
  }, []);

  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAudioFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("audio/"));
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    let pending = files.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) setUploading(false);
    };
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const probe = document.createElement("audio");
      probe.preload = "metadata";
      probe.src = url;
      probe.onloadedmetadata = () => {
        const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 6;
        const clip = makeUploadAudioClip(url, file.name.replace(/\.[^.]+$/, "") || "音訊", duration);
        pushHistory();
        setAudioClips((prev) => [...prev, clip]);
        setSelectedAudioId(clip.id);
        setNotice(`已加入音軌「${clip.name}」(預覽播放時會播出)。`);
        probe.remove();
        done();
      };
      probe.onerror = () => {
        URL.revokeObjectURL(url);
        setUploadError(`無法讀取音訊:${file.name}(格式可能不受瀏覽器支援)`);
        probe.remove();
        done();
      };
    });
  }, [pushHistory]);

  function addAudioPreset() {
    const start = clips.reduce((m, c) => Math.max(m, c.start + c.length), 0);
    const clip = createAudioClipPreset(AUDIO_PRESETS[0].key, start);
    pushHistory();
    setAudioClips((prev) => [...prev, clip]);
    setSelectedAudioId(clip.id);
    setNotice(`已加入背景音樂「${clip.name}」。`);
  }

  function addAssetToTimeline(assetId: string) {
    const asset = assetsById[assetId];
    if (!asset) return;
    pushHistory();
    const start = clips.reduce((m, c) => Math.max(m, c.start + c.length), 0);
    const length = asset.kind === "video" ? Math.min(asset.duration || 6, 10) : asset.duration;
    const safeLen = Math.min(Math.max(0.3, length), asset.duration || length || 6);
    const clip: Clip = {
      id: uid("clip"),
      assetId,
      start,
      length: safeLen,
      in: 0,
      filters: {},
      name: asset.name,
      color: CLIP_COLORS[clips.length % CLIP_COLORS.length],
    };
    setClips((prev) => [...prev, clip]);
    setSelectedClipId(clip.id);
    setTime(start);
    setPlaying(false);
  }

  // ---- 專案儲存(自動保存) ----
  useEffect(() => {
    if (projectLoadedRef.current) return;
    projectLoadedRef.current = true;
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved) as {
        assets?: Asset[];
        clips?: Clip[];
        audioClips?: AudioClip[];
        subtitles?: SubtitleClip[];
        aspect?: AspectRatio;
        zoomIdx?: number;
      };
      const savedAssets = data.assets ?? [];
      const skipped: string[] = [];
      const validAssets: Asset[] = [];
      const validIds = new Set<string>();
      for (const a of savedAssets) {
        if (a.kind === "video" && !a.videoUrl) {
          skipped.push(a.name);
          continue;
        }
        validAssets.push(a);
        validIds.add(a.id);
      }
      const validAudio = (data.audioClips ?? []).filter((c) => c.source === "preset");
      const validSubs = data.subtitles ?? [];
      const validClips = (data.clips ?? []).filter((c) => validIds.has(c.assetId));
      if (validAssets.length || validClips.length || validAudio.length || validSubs.length) {
        setAssets(validAssets);
        setClips(validClips);
        setAudioClips(validAudio);
        setSubtitles(validSubs);
        if (data.aspect) setAspect(data.aspect);
        if (typeof data.zoomIdx === "number") setZoomIdx(data.zoomIdx);
        setSelectedClipId(validClips[0]?.id ?? null);
        setSelectedAudioId(validAudio[0]?.id ?? null);
        setSelectedSubtitleId(validSubs[0]?.id ?? null);
        if (skipped.length) {
          setNotice(`已恢復上次專案。上傳影片需重新匯入:${skipped.slice(0, 3).join("、")}${skipped.length > 3 ? "…" : ""}。`);
        } else {
          setNotice("已恢復上次專案(上傳音訊需重新匯入)。");
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!projectLoadedRef.current) return;
    const t = window.setTimeout(() => {
      try {
        const persist = {
          v: 1,
          assets: assets.map((a) => (a.kind === "video" ? { ...a, videoUrl: "" } : a)),
          clips,
          audioClips: audioClips.map((c) => (c.source === "upload" ? { ...c, url: "" } : c)),
          subtitles,
          aspect,
          zoomIdx,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(persist));
      } catch {
        /* ignore */
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [assets, clips, audioClips, subtitles, aspect, zoomIdx]);

  // ---- 整頁拖放影片 ----
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        setDragging(true);
      }
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [handleFiles]);

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

  const { w: CW, h: CH } = canvasSize;

  const renderFrame = useCallback(
    (t: number, live = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const drawSubs = (tt: number) => {
        const sub = subtitlesRef.current.find((s) => tt >= s.start && tt < s.start + s.length);
        if (sub) drawSubtitle(ctx, CW, CH, sub, sub.style);
      };
      const clip = clipAtTime(t);
      if (!clip) {
        pauseVideosExcept();
        ctx.fillStyle = "#05060a";
        ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.font = `500 18px "Sora", "Noto Sans TC", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("— 空白軌 —", CW / 2, CH / 2);
        drawSubs(t);
        return;
      }
      const asset = assetsRef.current[clip.assetId];
      if (!asset) return;
      if (asset.kind === "video") {
        const video = getVideo(asset);
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          pauseVideosExcept(asset.id);
          if (live && video.paused) video.play().catch(() => undefined);
          const sourceT = (t - clip.start + (clip.in || 0)) % Math.max(asset.duration, 0.01);
          drawVideoAssetFrame(ctx, CW, CH, video, sourceT, clip.filters || {});
        } else {
          ctx.fillStyle = "#05060a";
          ctx.fillRect(0, 0, CW, CH);
          ctx.fillStyle = "rgba(255,255,255,0.28)";
          ctx.font = `500 18px "Sora", "Noto Sans TC", sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`載入影片中…${asset.name}`, CW / 2, CH / 2);
        }
        drawSubs(t);
        return;
      }
      pauseVideosExcept();
      const localT = ((t - clip.start + (clip.in || 0)) % Math.max(asset.duration, 0.01)) / Math.max(asset.duration, 0.01);
      drawAssetFrame(ctx, CW, CH, asset, localT, clip.filters || {});
      drawSubs(t);
    },
    [clipAtTime, CW, CH]
  );

  // 播放迴圈
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audioEngine.stopAll();
      return;
    }
    lastTsRef.current = performance.now();
    const loop = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((prev) => {
        const total = clipsRef.current.reduce((m, c) => Math.max(m, c.start + c.length), 0);
        let next = prev + dt;
        if (next >= total) next = recordingRef.current ? Math.max(0, total - 0.001) : 0; // 匯出時停在結尾,否則循環播放
        renderFrame(next, true);
        audioEngine.sync(next, !audioMuted, audioClipsRef.current);
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, renderFrame, audioMuted]);

  // 暫停時也要即時重繪(微調立即預覽),並把音軌停在當前位置
  useEffect(() => {
    if (!playing) {
      renderFrame(time, false);
      audioEngine.sync(time, false, audioClipsRef.current);
    }
  }, [time, clips, assetsById, playing, renderFrame]);

  useEffect(() => {
    audioEngine.setMuted(audioMuted);
  }, [audioMuted]);

  // ---- 送出 AI 指令 ----
  async function handleSend(prompt: string) {
    if (thinking) return;
    pushHistory();
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setThinking(true);

    const plan = await planEdit(prompt, { assets: assetsListRef.current, clips: clipsRef.current });

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

    // 規劃器回傳的 asset 若是已上傳素材,直接併入(不重複);否則新增
    setAssets((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      for (const a of plan.assets) if (!map.has(a.id)) map.set(a.id, a);
      return Array.from(map.values());
    });
    setClips(plan.clips);
    setSelectedClipId(plan.clips[0]?.id ?? null);
    if (plan.aspect) setAspect(plan.aspect);
    setTime(0);
    setPlaying(false);
    if (plan.targetDuration) setNotice(`AI 依你的要求規劃了約 ${plan.targetDuration} 秒的草稿(目前 ${plan.clips.reduce((m, c) => m + c.length, 0).toFixed(1)} 秒)。`);

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

  // ---- 時間軸拖曳 + snap ----
  function onClipMouseDown(e: React.MouseEvent, clip: Clip, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    draggingRef.current = {
      kind: "clip",
      targetId: clip.id,
      mode,
      startX: e.clientX,
      origStart: clip.start,
      origLength: clip.length,
      origIn: clip.in || 0,
      px: pxPerSec,
    };
    setSelectedClipId(clip.id);
    setSelectedAudioId(null);
    setSelectedSubtitleId(null);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onAudioMouseDown(e: React.MouseEvent, clip: AudioClip, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    draggingRef.current = {
      kind: "audio",
      targetId: clip.id,
      mode,
      startX: e.clientX,
      origStart: clip.start,
      origLength: clip.length,
      origIn: clip.in || 0,
      px: pxPerSec,
    };
    setSelectedAudioId(clip.id);
    setSelectedClipId(null);
    setSelectedSubtitleId(null);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onSubtitleMouseDown(e: React.MouseEvent, sub: SubtitleClip, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    draggingRef.current = {
      kind: "subtitle",
      targetId: sub.id,
      mode,
      startX: e.clientX,
      origStart: sub.start,
      origLength: sub.length,
      origIn: 0,
      px: pxPerSec,
    };
    setSelectedSubtitleId(sub.id);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function snapMove(v: number, movingId: string, prev: { id: string; start: number; length: number }[]): number {
    let s = snapVal(v, SNAP_STEP);
    for (const c of prev) {
      if (c.id === movingId) continue;
      const ends = [c.start, c.start + c.length];
      for (const e of ends) {
        if (Math.abs(v - e) < EDGE_SNAP) s = e;
      }
    }
    return Math.max(0, s);
  }

  function onDragMove(e: MouseEvent) {
    const d = draggingRef.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / d.px;
    if (d.kind === "clip") {
      setClips((prev) =>
        prev.map((c) => {
          if (c.id !== d.targetId) return c;
          if (d.mode === "move") return { ...c, start: snapMove(d.origStart + deltaSec, c.id, prev) };
          if (d.mode === "resize-right") {
            const len = snapVal(d.origLength + deltaSec, SNAP_STEP);
            return { ...c, length: Math.max(0.3, len) };
          }
          if (d.mode === "resize-left") {
            const newStart = snapMove(d.origStart + deltaSec, c.id, prev);
            const consumed = newStart - d.origStart;
            const newLen = Math.max(0.3, d.origLength - consumed);
            return { ...c, start: newStart, length: newLen, in: d.origIn + consumed };
          }
          return c;
        })
      );
      return;
    }
    if (d.kind === "audio") {
      setAudioClips((prev) =>
        prev.map((c) => {
          if (c.id !== d.targetId) return c;
          if (d.mode === "move") return { ...c, start: snapMove(d.origStart + deltaSec, c.id, prev) };
          if (d.mode === "resize-right") {
            const len = snapVal(d.origLength + deltaSec, SNAP_STEP);
            return { ...c, length: Math.max(0.3, len) };
          }
          if (d.mode === "resize-left") {
            const newStart = snapMove(d.origStart + deltaSec, c.id, prev);
            const consumed = newStart - d.origStart;
            const newLen = Math.max(0.3, d.origLength - consumed);
            return { ...c, start: newStart, length: newLen, in: d.origIn + consumed };
          }
          return c;
        })
      );
      return;
    }
    setSubtitles((prev) =>
      prev.map((s) => {
        if (s.id !== d.targetId) return s;
        if (d.mode === "move") return { ...s, start: snapMove(d.origStart + deltaSec, s.id, prev) };
        if (d.mode === "resize-right") {
          const len = snapVal(d.origLength + deltaSec, SNAP_STEP);
          return { ...s, length: Math.max(0.3, len) };
        }
        if (d.mode === "resize-left") {
          const newStart = snapMove(d.origStart + deltaSec, s.id, prev);
          const consumed = newStart - d.origStart;
          const newLen = Math.max(0.3, d.origLength - consumed);
          return { ...s, start: newStart, length: newLen };
        }
        return s;
      })
    );
  }

  function onDragEnd() {
    draggingRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }

  // ---- 縫合空隙 ----
  function tightenClips() {
    pushHistory();
    setClips((prev) => {
      let cursor = 0;
      return [...prev]
        .sort((a, b) => a.start - b.start)
        .map((c) => {
          const next = { ...c, start: cursor };
          cursor += c.length;
          return next;
        });
    });
  }

  // ---- 進度條(支援按住拖) ----
  function scrubTo(clientX: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setTime(ratio * (totalDuration || 0));
  }
  function onScrubberDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!clips.length) return;
    setPlaying(false);
    scrubbingRef.current = true;
    const el = e.currentTarget;
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

  const patchClip = useCallback(
    (id: string, patch: Partial<Clip>) => {
      if (patch) pushHistory();
      setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [pushHistory]
  );

  const updateFilter = useCallback(
    (key: keyof ClipFilters, value: number | boolean | string) => {
      if (!selectedClipIdRef.current) return;
      pushHistory();
      setClips((prev) =>
        prev.map((c) =>
          c.id === selectedClipIdRef.current ? { ...c, filters: { ...c.filters, [key]: value } } : c
        )
      );
    },
    [pushHistory]
  );

  const deleteClip = useCallback(
    (id: string) => {
      pushHistory();
      setClips((prev) => prev.filter((c) => c.id !== id));
      if (selectedClipIdRef.current === id) setSelectedClipId(null);
    },
    [pushHistory]
  );

  const patchAudio = useCallback(
    (id: string, patch: Partial<AudioClip>) => {
      pushHistory();
      setAudioClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, length: Math.max(0.3, patch.length ?? c.length) } : c)));
    },
    [pushHistory]
  );

  const deleteAudio = useCallback(
    (id: string) => {
      pushHistory();
      audioEngine.disposeUpload(id);
      setAudioClips((prev) => prev.filter((c) => c.id !== id));
      if (selectedAudioIdRef.current === id) setSelectedAudioId(null);
    },
    [pushHistory]
  );

  const patchSubtitle = useCallback(
    (id: string, patch: Partial<SubtitleClip>) => {
      pushHistory();
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, length: Math.max(0.3, patch.length ?? s.length) } : s)));
    },
    [pushHistory]
  );

  const deleteSubtitle = useCallback(
    (id: string) => {
      pushHistory();
      setSubtitles((prev) => prev.filter((s) => s.id !== id));
      if (selectedSubtitleIdRef.current === id) setSelectedSubtitleId(null);
    },
    [pushHistory]
  );

  function addSubtitleAtTime() {
    const start = Math.max(0, Math.round(time * 10) / 10);
    const sub: SubtitleClip = {
      id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      start,
      length: Math.min(3, Math.max(0.5, totalDuration - start)),
      text: "點這裡輸入字幕",
      style: { position: "bottom" },
    };
    pushHistory();
    setSubtitles((prev) => [...prev, sub]);
    setSelectedSubtitleId(sub.id);
  }

  function nudgeSelected(dir: -1 | 1, big: boolean) {
    if (!selectedClipId) return;
    pushHistory();
    const step = big ? 0.5 : 0.1;
    setClips((prev) =>
      prev.map((c) => (c.id === selectedClipId ? { ...c, start: Math.max(0, c.start + dir * step) } : c))
    );
  }

  // ---- 快捷鍵 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.code === "Space") {
        e.preventDefault();
        if (clipsRef.current.length) setPlaying((p) => !p);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        e.preventDefault();
        deleteClip(selectedClipId);
      } else if (e.key === "ArrowLeft" && selectedClipId) {
        e.preventDefault();
        nudgeSelected(-1, e.shiftKey);
      } else if (e.key === "ArrowRight" && selectedClipId) {
        e.preventDefault();
        nudgeSelected(1, e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedClipId, deleteClip, undo, redo, nudgeSelected]);

  function handleZoom(dir: 1 | -1) {
    setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir)));
  }

  function handleTimelineScrub(t: number) {
    setPlaying(false);
    setTime(t);
  }

  function handleReset() {
    if (!window.confirm("確定要清空目前的草稿、重新開始嗎?(上傳影片的瀏覽器記憶體也會釋放)")) return;
    revokeVideoUrls(assetsListRef.current);
    audioEngine.disposeAll();
    pastRef.current = [];
    futureRef.current = [];
    setPastLen(0);
    setFutureLen(0);
    setClips([]);
    setAssets([]);
    setAudioClips([]);
    setSubtitles([]);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setSelectedSubtitleId(null);
    setPlaying(false);
    setTime(0);
    setNotice(null);
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    setMessages([{ role: "ai", text: greeting(hasApiKey()) }]);
  }

  // ---- 匯出 MP4(先用 MediaRecorder 錄製 Canvas;FFmpeg 之後接)----
  function pickMime(): string {
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
  }

  async function handleExport() {
    if (!clipsRef.current.length || recording || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const mime = pickMime();
    if (!mime || typeof MediaRecorder === "undefined") {
      window.alert("此瀏覽器不支援 Canvas 錄影,請改用 Chrome / Edge 後再匯出。");
      return;
    }
    const stream = canvas.captureStream(30);
    // 把背景音樂/上傳音訊一起錄進匯出檔案
    if (!audioMuted && audioClipsRef.current.length) {
      const audioStream = audioEngine.getAudioStream();
      audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const stopDone = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    setRecording(true);
    recordingRef.current = true;
    setTime(0);
    setPlaying(true);
    rec.start(300);
    const endMs = Math.max(600, totalDuration * 1000 + 180);
    window.setTimeout(async () => {
      try {
        rec.stop();
        await stopDone;
        const type = mime.split(";")[0] || "video/webm";
        const blob = new Blob(chunks, { type });
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `winprium-${Date.now()}.${ext}`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        setNotice(`已匯出 ${ext.toUpperCase()}(${(blob.size / 1024 / 1024).toFixed(1)} MB)。`);
      } catch (err) {
        setNotice(`匯出失敗:${err instanceof Error ? err.message : String(err)}`);
      } finally {
        stream.getTracks().forEach((t) => t.stop());
        recordingRef.current = false;
        setRecording(false);
        setPlaying(false);
      }
    }, endMs);
  }

  const currentClipName = clipAtTime(time)?.name;

  return (
    <div className="app">
      <TopBar
        hasKey={conn.apiKey.length > 0}
        model={conn.model}
        canUndo={pastLen > 0}
        canRedo={futureLen > 0}
        onUndo={undo}
        onRedo={redo}
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
          {notice && (
            <div className="studio-notice">
              <span>{notice}</span>
              <button className="icon-btn" onClick={() => setNotice(null)} aria-label="關閉提示">
                ×
              </button>
            </div>
          )}
          <div className="preview-wrap">
            <canvas
              ref={canvasRef}
              className={`preview-canvas ${clips.length ? "" : "idle"}`}
              width={CW}
              height={CH}
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
              disabled={!clips.length || recording}
              title="Space"
            >
              {playing && !recording ? <Pause size={15} /> : <Play size={15} />}
              {recording ? "錄影中…" : playing ? "暫停" : "播放"}
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
            <button
              className="icon-btn-lg"
              onClick={() => setAudioMuted((m) => !m)}
              title={audioMuted ? "開啟音效" : "靜音"}
              aria-label={audioMuted ? "開啟音效" : "靜音"}
            >
              {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div className="aspect-switch" title="輸出比例">
              {(["16:9", "9:16", "1:1"] as AspectRatio[]).map((r) => (
                <button
                  key={r}
                  className={aspect === r ? "on" : ""}
                  onClick={() => {
                    setAspect(r);
                    setPlaying(false);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              className="btn ghost export-btn"
              onClick={handleExport}
              disabled={!clips.length || recording}
              title={recording ? "正在錄製…" : "把目前時間軸錄成影片(MP4/WebM)"}
            >
              <Download size={14} />
              {recording ? "匯出中…" : "匯出 MP4"}
            </button>
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
            audioClips={audioClips}
            subtitles={subtitles}
            assetsById={assetsById}
            selectedClipId={selectedClipId}
            selectedAudioId={selectedAudioId}
            selectedSubtitleId={selectedSubtitleId}
            time={time}
            totalDuration={totalDuration}
            pxPerSec={pxPerSec}
            onZoom={handleZoom}
            onSelect={setSelectedClipId}
            onClipMouseDown={onClipMouseDown}
            onAudioMouseDown={onAudioMouseDown}
            onSubtitleMouseDown={onSubtitleMouseDown}
            onScrub={handleTimelineScrub}
            onTighten={tightenClips}
          />
        </section>

        {/* 右:素材庫 + 微調 */}
        <section className="panel right">
          <Inspector
            clip={selectedClip}
            assets={assets}
            audioClips={audioClips}
            subtitles={subtitles}
            selectedAudioId={selectedAudioId}
            selectedSubtitleId={selectedSubtitleId}
            uploading={uploading}
            uploadError={uploadError}
            onFiles={handleFiles}
            onPickFiles={() => fileInputRef.current?.click()}
            onAudioFiles={handleAudioFiles}
            onPickAudioFiles={() => audioInputRef.current?.click()}
            onAddToTimeline={addAssetToTimeline}
            onPatchClip={patchClip}
            onUpdateFilter={updateFilter}
            onDelete={deleteClip}
            onAddAudioPreset={addAudioPreset}
            onPatchAudio={patchAudio}
            onDeleteAudio={deleteAudio}
            onSelectAudio={setSelectedAudioId}
            onAddSubtitle={addSubtitleAtTime}
            onPatchSubtitle={patchSubtitle}
            onDeleteSubtitle={deleteSubtitle}
            onSelectSubtitle={setSelectedSubtitleId}
          />
        </section>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setConn(getSettings())}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) handleAudioFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card">
            <Film size={28} strokeWidth={1.5} />
            <div className="drop-title">放開以匯入影片</div>
            <div className="drop-sub">支援瀏覽器可播放的影片格式(MP4 / WebM 等)</div>
          </div>
        </div>
      )}
    </div>
  );
}
