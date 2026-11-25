/**
 * Sound and music, generated on the device with the Web Audio API
 * (no files, no network). The context starts on the first touch, as iOS
 * requires. The music is a generative synth loop whose layers and tempo
 * grow with the intensity of the game.
 */

const KEY = 'uno-por-ciento:sound';
type Prefs = { sfx: boolean; music: boolean };
let prefs: Prefs = { sfx: true, music: true };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
} catch {
  /* storage unavailable */
}
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = prefs.sfx ? 0.55 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Call from a touch: unlocks audio on iOS. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}
if (typeof window !== 'undefined') {
  const once = () => unlockAudio();
  window.addEventListener('pointerdown', once, { passive: true });
  window.addEventListener('touchend', once, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

export const soundPrefs = () => prefs;
export function setSoundPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  if (ctx) {
    sfxBus.gain.setTargetAtTime(prefs.sfx ? 0.55 : 0, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(prefs.music && musicOn ? 0.5 : 0, ctx.currentTime, 0.2);
  }
  listeners.forEach((f) => f());
}
export function onSoundPrefs(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

// ── Building blocks ───────────────────────────────────────────────────────
function tone(freq: number, dur: number, type: OscillatorType, vol: number, opts: { to?: number; at?: number; bus?: GainNode; attack?: number } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.at ?? 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(opts.bus ?? sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noise(dur: number, vol: number, filter: { type: BiquadFilterType; freq: number; to?: number; q?: number }, opts: { at?: number; bus?: GainNode } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.6 + Math.random() * 0.8;
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.setValueAtTime(filter.freq, t0);
  if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
  f.Q.value = filter.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(opts.bus ?? sfxBus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

// ── Sound effects ─────────────────────────────────────────────────────────
const last: Record<string, number> = {};
/** Plays a cue unless the same one played very recently (many shots per frame). */
function gate(name: string, gap: number): boolean {
  if (!ctx || !prefs.sfx || ctx.state !== 'running') return false;
  const now = ctx.currentTime;
  if ((last[name] ?? -1) > now - gap) return false;
  last[name] = now;
  return true;
}
const jitter = (f: number) => f * (0.94 + Math.random() * 0.12);

export function sfx(name: string) {
  if (!ctx) return;
  const [kind, sub] = name.split(':');
  switch (kind) {
    case 'shot': {
      if (!gate(`shot-${sub}`, 0.07)) return;
      switch (sub) {
        case 'canon': tone(jitter(520), 0.07, 'square', 0.05, { to: 180 }); break;
        case 'hielo': tone(jitter(1400), 0.09, 'triangle', 0.05, { to: 700 }); break;
        case 'misil': noise(0.25, 0.08, { type: 'bandpass', freq: 900, to: 300 }); break;
        case 'mortero':
        case 'acido': tone(jitter(160), 0.18, 'sine', 0.12, { to: 70 }); break;
        case 'bumeran': tone(jitter(600), 0.15, 'sawtooth', 0.025, { to: 900 }); break;
        default: tone(jitter(700), 0.06, 'square', 0.035, { to: 300 });
      }
      return;
    }
    case 'zap':
      if (!gate('zap', 0.09)) return;
      noise(0.16, 0.12, { type: 'highpass', freq: 2500 });
      tone(jitter(1800), 0.12, 'sawtooth', 0.05, { to: 200 });
      return;
    case 'snipe':
      if (!gate('snipe', 0.1)) return;
      tone(1200, 0.2, 'sawtooth', 0.06, { to: 90 });
      noise(0.08, 0.1, { type: 'highpass', freq: 4000 });
      return;
    case 'beam':
      if (!gate('beam', 0.2)) return;
      tone(880, 0.3, 'triangle', 0.06, { to: 1760 });
      return;
    case 'boom':
      if (!gate('boom', 0.08)) return;
      noise(0.45, 0.22, { type: 'lowpass', freq: 1200, to: 80 });
      tone(jitter(110), 0.35, 'sine', 0.18, { to: 40 });
      return;
    case 'kill':
      if (!gate('kill', 0.045)) return;
      tone(jitter(300 + Math.random() * 400), 0.08, 'triangle', 0.045, { to: 1200 });
      return;
    case 'bossdie':
      noise(1.4, 0.35, { type: 'lowpass', freq: 2000, to: 60 });
      tone(90, 1.2, 'sawtooth', 0.12, { to: 30 });
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'triangle', 0.08, { at: 0.15 + i * 0.09 }));
      return;
    case 'hurt':
      if (!gate('hurt', 0.12)) return;
      tone(140, 0.3, 'sawtooth', 0.14, { to: 50 });
      noise(0.2, 0.15, { type: 'lowpass', freq: 600 });
      return;
    case 'level':
      [660, 880, 1320].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, { at: i * 0.06 }));
      return;
    case 'pick':
      tone(1000, 0.08, 'sine', 0.08, { to: 1500 });
      return;
    case 'evo':
    case 'fusion':
    case 'asc':
    case 'chip': {
      const base = kind === 'chip' ? 196 : kind === 'fusion' ? 261 : 329;
      [1, 1.25, 1.5, 2, 2.5].forEach((m, i) => tone(base * m, 0.7, 'sawtooth', 0.04, { at: i * 0.07, attack: 0.04 }));
      noise(0.8, 0.08, { type: 'highpass', freq: 3000, to: 8000 });
      return;
    }
    case 'wave':
      tone(220, 0.6, 'sawtooth', 0.05, { to: 440, attack: 0.1 });
      return;
    case 'boss':
      [0, 0.45].forEach((at) => tone(73, 0.8, 'sawtooth', 0.12, { at, attack: 0.05 }));
      noise(1, 0.12, { type: 'lowpass', freq: 400 });
      return;
    case 'wallbreak':
      noise(0.7, 0.3, { type: 'bandpass', freq: 700, to: 150, q: 2 });
      return;
    case 'over':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'triangle', 0.1, { at: i * 0.18 }));
      return;
    case 'good':
      [784, 1175].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, { at: i * 0.08 }));
      return;
    case 'bad':
      tone(220, 0.35, 'square', 0.06, { to: 110 });
      return;
    case 'tap':
      if (!gate('tap', 0.03)) return;
      tone(1800, 0.03, 'sine', 0.03);
      return;
  }
}

// ── Music: a generative synth loop ────────────────────────────────────────
let musicOn = false;
let timer = 0;
let step = 0;
let nextTime = 0;
let intensity = 0;
let tension = false;
// A minor progression: Am – F – C – G, with a darker turn for bosses.
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const BOSS = [[57, 60, 63], [56, 59, 63], [53, 56, 60], [55, 58, 62]];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function scheduleStep(t: number) {
  if (!ctx) return;
  const bar = Math.floor(step / 16) % 4;
  const s = step % 16;
  const chord = (tension ? BOSS : CHORDS)[bar];
  const lvl = intensity;
  const voice = (freq: number, dur: number, type: OscillatorType, vol: number, at: number) => tone(freq, dur, type, vol, { at: at - ctx!.currentTime, bus: musicBus, attack: 0.01 });
  // Kick on the beat (from the start), snare from intensity 2
  if (s % 4 === 0) voice(110, 0.18, 'sine', 0.35, t), tone(60, 0.2, 'sine', 0.3, { at: t - ctx.currentTime, bus: musicBus, to: 40 });
  if (lvl >= 2 && s % 8 === 4) noise(0.12, 0.12, { type: 'highpass', freq: 1800 }, { at: t - ctx.currentTime, bus: musicBus });
  if (lvl >= 1 && s % 2 === 1) noise(0.03, 0.04, { type: 'highpass', freq: 7000 }, { at: t - ctx.currentTime, bus: musicBus });
  // Bass: eighth notes on the root
  if (s % 2 === 0) voice(midi(chord[0] - 24), 0.2, 'sawtooth', 0.09, t);
  // Pad at the start of each bar
  if (s === 0) for (const n of chord) voice(midi(n), 2.2, 'triangle', 0.035, t);
  // Arpeggio from intensity 1, faster at 3
  if (lvl >= 1 && (lvl >= 3 || s % 2 === 0)) voice(midi(chord[(s >> (lvl >= 3 ? 0 : 1)) % 3] + 12), 0.12, 'square', 0.025, t);
  // Lead stabs at high intensity
  if (lvl >= 4 && (s === 6 || s === 14)) voice(midi(chord[2] + 24), 0.25, 'sawtooth', 0.03, t);
}

function scheduler() {
  if (!ctx || !musicOn) return;
  const bpm = 96 + intensity * 7 + (tension ? 6 : 0);
  const stepDur = 60 / bpm / 4;
  while (nextTime < ctx.currentTime + 0.15) {
    scheduleStep(nextTime);
    nextTime += stepDur;
    step++;
  }
}

/** Starts the music loop (if enabled). */
export function startMusic() {
  const c = ensure();
  if (!c || musicOn) return;
  musicOn = true;
  step = 0;
  nextTime = c.currentTime + 0.1;
  musicBus.gain.setTargetAtTime(prefs.music ? 0.5 : 0, c.currentTime, 0.6);
  timer = window.setInterval(scheduler, 50);
}
export function stopMusic() {
  if (!ctx || !musicOn) return;
  musicOn = false;
  window.clearInterval(timer);
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}
/** 0 (calm) to 4 (frantic); `boss` darkens the harmony. */
export function setMusicIntensity(level: number, boss = false) {
  intensity = Math.max(0, Math.min(4, Math.round(level)));
  tension = boss;
}
