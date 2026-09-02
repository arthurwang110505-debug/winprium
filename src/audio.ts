// 音訊 / 背景音樂引擎
// - 內建幾段 WebAudio 程序化循環音訊(不需下載外部檔)
// - 支援使用者上傳音訊(MP3 / WAV 等瀏覽器可播格式)
// - 預覽播放時與時間軸同步;匯出時把音訊加到 MediaStream 音軌

import type { AudioClip, AudioPresetInfo } from "./types";

export const AUDIO_PRESETS: AudioPresetInfo[] = [
  { key: "calm", name: "柔和水晶", duration: 8 },
  { key: "upbeat", name: "輕快節奏", duration: 6 },
  { key: "cinematic", name: "電影低鳴", duration: 10 },
  { key: "lofi", name: "Lo-Fi 氛圍", duration: 9 },
];

function buildPresetNodes(
  ctx: AudioContext,
  key: string,
  gain: GainNode
): { nodes: AudioNode[]; stop: () => void } {
  const out: AudioNode[] = [];
  const stopFns: (() => void)[] = [];
  const now = ctx.currentTime;

  const env = (node: GainNode, attack: number, sustain: number) => {
    node.gain.setValueAtTime(0, now);
    node.gain.linearRampToValueAtTime(sustain, now + attack);
  };

  if (key === "upbeat") {
    // 簡單的低音節奏 + 拍點
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    const g = ctx.createGain();
    env(g, 0.05, 1);
    osc.connect(g).connect(gain);
    out.push(osc, g);
    osc.start(now);
    stopFns.push(() => osc.stop());
    const k = ctx.createOscillator();
    k.type = "triangle";
    k.frequency.setValueAtTime(330, now);
    const kg = ctx.createGain();
    env(kg, 0.03, 0.4);
    k.connect(kg).connect(gain);
    out.push(k, kg);
    k.start(now);
    stopFns.push(() => k.stop());
  } else if (key === "cinematic") {
    // 低頻持續 + 微掃
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55, now);
    const g = ctx.createGain();
    env(g, 0.6, 0.8);
    osc.connect(g).connect(gain);
    out.push(osc, g);
    osc.start(now);
    stopFns.push(() => osc.stop());
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(82, now);
    const g2 = ctx.createGain();
    env(g2, 0.8, 0.5);
    osc2.connect(g2).connect(gain);
    out.push(osc2, g2);
    osc2.start(now);
    stopFns.push(() => osc2.stop());
  } else if (key === "lofi") {
    // 兩個柔和弦
    const freqs = [220, 277.18, 329.63];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, now);
      const g = ctx.createGain();
      env(g, 0.4, 0.22 + i * 0.03);
      o.connect(g).connect(gain);
      out.push(o, g);
      o.start(now);
      stopFns.push(() => o.stop());
    });
  } else {
    // calm / default
    const freqs = [261.63, 329.63, 392];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f, now);
      const g = ctx.createGain();
      env(g, 0.5, 0.16 + i * 0.04);
      o.connect(g).connect(gain);
      out.push(o, g);
      o.start(now);
      stopFns.push(() => o.stop());
    });
  }

  return {
    nodes: out,
    stop: () => stopFns.forEach((f) => {
      try {
        f();
      } catch {
        /* ignore */
      }
    }),
  };
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private master: GainNode | null = null;
  private presetRuns = new Map<string, { gain: GainNode; stop: () => void }>();
  private uploadEls = new Map<string, HTMLAudioElement>();

  private ensure(): { ctx: AudioContext; dest: MediaStreamAudioDestinationNode; master: GainNode } {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.dest);
      this.master.connect(this.ctx.destination);
    }
    return { ctx: this.ctx, dest: this.dest!, master: this.master! };
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume().catch(() => undefined);
    }
  }

  getAudioStream(): MediaStream {
    const { dest } = this.ensure();
    return dest.stream;
  }

  setMuted(m: boolean): void {
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  setVolume(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  private getUploadEl(clip: AudioClip): HTMLAudioElement | null {
    if (clip.source !== "upload" || !clip.url) return null;
    let el = this.uploadEls.get(clip.id);
    if (!el) {
      el = document.createElement("audio");
      el.preload = "auto";
      el.loop = clip.loop;
      el.volume = clip.volume;
      el.src = clip.url;
      this.uploadEls.set(clip.id, el);
    }
    return el;
  }

  private stopPreset(id: string): void {
    const run = this.presetRuns.get(id);
    if (!run) return;
    try {
      run.stop();
    } catch {
      /* ignore */
    }
    run.gain.disconnect();
    this.presetRuns.delete(id);
  }

  private syncPreset(clip: AudioClip, active: boolean, startOffset: number): void {
    if (!active) {
      this.stopPreset(clip.id);
      return;
    }
    const existing = this.presetRuns.get(clip.id);
    if (existing) return;
    const { ctx, master } = this.ensure();
    void ctx.resume().catch(() => undefined);
    const gain = ctx.createGain();
    gain.gain.value = clip.volume * 0.5;
    gain.connect(master);
    const preset = clip.preset && AUDIO_PRESETS.some((p) => p.key === clip.preset) ? clip.preset : AUDIO_PRESETS[0].key;
    const { stop } = buildPresetNodes(ctx, preset, gain);
    this.presetRuns.set(clip.id, { gain, stop });
    void startOffset; // preset 動態音色不需精準 seek,直接同步播放即可
  }

  // 每幀同步:找出當前播放的 audio clip,只播它;其餘停止/暫停
  sync(time: number, playing: boolean, clips: AudioClip[]): void {
    const now = Number.isFinite(time) ? Math.max(0, time) : 0;
    const active = playing
      ? clips.find((c) => now >= c.start && now < c.start + c.length) ?? null
      : null;

    // preset output
    for (const clip of clips) {
      if (clip.source === "preset") {
        const isActive = active?.id === clip.id;
        this.syncPreset(clip, isActive, now - clip.start);
      }
    }

    // upload audio elements
    for (const clip of clips) {
      if (clip.source !== "upload" || !clip.url) continue;
      const el = this.getUploadEl(clip);
      if (!el) continue;
      const isActive = active?.id === clip.id;
      if (isActive) {
        if (el.paused) {
          el.volume = clip.volume;
          el.loop = clip.loop;
          el.src = clip.url;
          el.currentTime = Math.min(Math.max(0, now - clip.start + clip.in), Math.max(0, (el.duration || clip.length) - 0.02));
          void el.play().catch(() => undefined);
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }

  stopAll(): void {
    for (const key of Array.from(this.presetRuns.keys())) this.stopPreset(key);
    for (const el of this.uploadEls.values()) {
      el.pause();
    }
  }

  disposeUpload(id: string): void {
    const el = this.uploadEls.get(id);
    if (el) {
      el.pause();
      el.src = "";
      el.remove();
      this.uploadEls.delete(id);
    }
  }

  disposeAll(): void {
    this.stopAll();
    for (const el of this.uploadEls.values()) {
      el.src = "";
      el.remove();
    }
    this.uploadEls.clear();
  }
}

export const audioEngine = new AudioEngine();

export function createAudioClipPreset(presetKey: string, start: number): AudioClip {
  const preset = AUDIO_PRESETS.find((p) => p.key === presetKey) ?? AUDIO_PRESETS[0];
  return {
    id: `audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: preset.name,
    start,
    length: preset.duration,
    in: 0,
    volume: 0.6,
    loop: false,
    source: "preset",
    preset: preset.key,
    color: "#57d0ff",
  };
}

export function makeUploadAudioClip(url: string, name: string, duration: number): AudioClip {
  return {
    id: `audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    start: 0,
    length: Math.min(duration || 6, 60),
    in: 0,
    volume: 0.7,
    loop: false,
    source: "upload",
    url,
    color: "#57d0ff",
  };
}
