import { useCallback, useEffect, useRef, useState } from 'react';
import { CATALOGUE_SIZE, choose, choosePact, kindsOf, MAX_DEFENDERS, offer, offerPacts, pactCount, placements, RARITY_LABEL, type Card, type Placement } from '../invasion/cards';
import { LAB, labCost, labLevel, startOpts } from '../invasion/lab';
import { DEF_EL, DEF_INFO, defenderName, ELEMENTS, SYNERGIES, ULTS } from '../invasion/defenders';
import type { InvasionResult } from '../invasion/record';
import { draw, drawBackground, type View } from '../invasion/render';
import { BOSS_NAMES, datosFor, energyFor, layoutRings, newGame, rand, restore, snapshot, spinRings, update, xpNeed, type InvasionSnapshot } from '../invasion/sim';
import type { DefKind, Game } from '../invasion/types';
import type { InvasionRecord } from '../storage/persistence';
import { IconBack } from '../components/Icons';
import { haptic } from '../haptics';
import type { CoreState } from '../engine/core';
import { chipImage } from '../invasion/coreImage';
import { Quality } from '../invasion/quality';
import { refreshSynergies } from '../invasion/cards';
import { DEF_KINDS } from '../invasion/defenders';
import { MODS, titanName } from '../invasion/sim';
import { onSoundPrefs, setMusicIntensity, setSoundPrefs, sfx, soundPrefs, startMusic, stopMusic, unlockAudio } from '../audio';
import { CHIPS, MAX_CHIPS } from '../invasion/defenders';
import { motionMs } from '../motion';

interface Props {
  record: InvasionRecord;
  color: string;
  onSnapshot: (s: InvasionSnapshot) => void;
  onFinish: (g: Game) => InvasionResult;
  onBuyLab: (id: string) => boolean;
  onSetStart: (index: number) => void;
  /** The chip built in «Tu Núcleo»: it becomes the core here. */
  core: CoreState;
  onHome: () => void;
}

type Phase = 'intro' | 'lab' | 'play' | 'over';
interface Hud {
  wave: number;
  hp: number;
  max: number;
  level: number;
  xp: number;
  need: number;
  kills: number;
  threat: number;
  defenders: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** World units across the short side of the screen. */
const WORLD = 360;
/** The view zooms out as chips are added, so all of them fit. */
/** Camera zoom-out for each number of chips (up to three main cores with four outposts each). */
/** Pause close-up on the central chip. */
const PAUSE_ZOOM = 0.9;
const ZOOM = [1, 1.55, 1.6, 1.8, 1.9, 2.15, 2.3, 2.4, 2.45, 2.5, 2.6, 2.7, 2.75, 2.8, 2.85];

export function InvasionScreen({ record, color, onSnapshot, onFinish, onBuyLab, onSetStart, core, onHome }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const [hud, setHud] = useState<Hud | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [pacts, setPacts] = useState<Card[] | null>(null);
  const pactsRef = useRef<Card[] | null>(null);
  /** Pause: the defender you picked, and the one you are dragging. */
  const [sel, setSel] = useState<number | null>(null);
  const selRef = useRef<number | null>(null);
  selRef.current = sel;
  const dragRef = useRef<{ id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<{ text: string; sub?: string; boss?: boolean; key: number } | null>(null);
  const [result, setResult] = useState<InvasionResult | null>(null);
  const [placing, setPlacing] = useState<{ card: Card; opts: Placement[] } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const view = useRef<View>({ w: 390, h: 800, scale: 1, color });
  const bg = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(false);
  const zoomRef = useRef(1);
  const userZoom = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch0 = useRef<{ d: number; z: number } | null>(null);
  const coreImg = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    chipImage(core)
      .then((img) => {
        if (alive) coreImg.current = img;
      })
      // Without the image the core is drawn as before.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [core]);
  const dprRef = useRef(1);
  const quality = useRef(new Quality(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  const fitRef = useRef<() => void>(() => {});
  const hudSig = useRef('');
  const [prefs, setPrefs] = useState(soundPrefs);
  useEffect(() => onSoundPrefs(() => setPrefs({ ...soundPrefs() })), []);
  const toggleSound = (k: 'sfx' | 'music') => {
    unlockAudio();
    setSoundPrefs({ [k]: !soundPrefs()[k] });
    if (k === 'music' && soundPrefs().music && phaseRef.current === 'play') startMusic();
  };
  const cardsRef = useRef<Card[] | null>(null);
  const finished = useRef(false);
  const seenFusions = useRef(new Set<number>());
  const labRef = useRef(record.lab);
  labRef.current = record.lab;
  const snapRef = useRef(onSnapshot);
  const finishRef = useRef(onFinish);
  snapRef.current = onSnapshot;
  finishRef.current = onFinish;
  pausedRef.current = paused;
  cardsRef.current = cards;

  const showBanner = (text: string, sub?: string, boss?: boolean) => setBanner({ text, sub, boss, key: Date.now() });

  const start = useCallback((from: InvasionSnapshot | null) => {
    const v = view.current;
    const ax = v.w / 2 / v.scale;
    const ay = v.h / 2 / v.scale;
    game.current = from ? restore(from, ax, ay) : newGame(undefined, ax, ay, startOpts(labRef.current));
    finished.current = false;
    setResult(null);
    setCards(null);
    pactsRef.current = null;
    setPacts(null);
    setPaused(false);
    setPhase('play');
    unlockAudio();
    startMusic();
    zoomRef.current = ZOOM[(game.current.chips ?? 1) - 1];
    haptic('heavy');
  }, []);

  // Size: canvas fills the screen; the world keeps WORLD units on the short side.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = quality.current.step.dpr;
      dprRef.current = dpr;
      const v = view.current;
      v.w = r.width;
      v.h = r.height;
      v.scale = Math.min(r.width, r.height) / (WORLD * zoomRef.current);
      v.color = color;
      const c = canvas.current;
      if (c) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      bg.current ??= document.createElement('canvas');
      drawBackground(bg.current, v, dpr);
      const g = game.current;
      if (g) {
        g.arena = v.w / 2 / v.scale;
        g.arenaY = v.h / 2 / v.scale;
      } else if (c) {
        // Before the game starts, show the board.
        const ctx = c.getContext('2d', { alpha: false });
        ctx?.setTransform(1, 0, 0, 1, 0, 0);
        ctx?.drawImage(bg.current, 0, 0);
      }
    };
    fitRef.current = fit;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [color]);

  // Test hook (only with the e2e flag): lets the browser tests drive the game.
  useEffect(() => {
    try {
      if (localStorage.getItem('uno-por-ciento:e2e') === '1') {
        (window as unknown as { __inv?: unknown }).__inv = game;
        (window as unknown as { __invQ?: unknown }).__invQ = quality;
        (window as unknown as { __invView?: unknown }).__invView = view;
      }
    } catch {
      /* no storage */
    }
  }, []);

  useEffect(() => () => stopMusic(), []);

  // Pause when the app goes to the background.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && game.current && !game.current.over) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Game loop
  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let musicT = 0;
    let bgT = 0;
    let bgDirty = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const interval = now - last;
      const real = Math.min(0.05, interval / 1000);
      last = now;
      const t0 = performance.now();
      const g = game.current;
      const c = canvas.current;
      if (!g || !c) return;
      // Slow motion for epic moments.
      if (g.slowmo > 0) g.slowmo = Math.max(0, g.slowmo - real);
      const dt = real * (g.slowmo > 0 ? 0.35 : 1);
      const running = !pausedRef.current && !cardsRef.current && !pactsRef.current;
      if (running) update(g, dt);
      // Zoom out smoothly when a chip is added.
      // Paused: the camera closes in on your central chip.
      const want = pausedRef.current ? PAUSE_ZOOM : ZOOM[Math.min(ZOOM.length, g.chips) - 1] / userZoom.current;
      if (pausedRef.current && !cardsRef.current && !pactsRef.current) spinRings(g, real);
      const v0 = view.current;
      if (Math.abs(want - zoomRef.current) > 0.002 || Math.abs(v0.scale - Math.min(v0.w, v0.h) / (WORLD * zoomRef.current)) > 1e-4) {
        if (Math.abs(want - zoomRef.current) > 0.002) zoomRef.current += (want - zoomRef.current) * Math.min(1, pausedRef.current ? real * 6 : dt * 2.5);
        const v = view.current;
        v.scale = Math.min(v.w, v.h) / (WORLD * zoomRef.current);
        g.arena = v.w / 2 / v.scale;
        g.arenaY = v.h / 2 / v.scale;
        bgDirty = true;
      }
      // Redrawing the background is costly: at most ~6 times a second while zooming.
      bgT -= real;
      if (bgDirty && bgT <= 0 && bg.current) {
        drawBackground(bg.current, view.current, dprRef.current);
        bgDirty = false;
        bgT = 0.16;
      }
      // Sound
      for (const n of g.sfx) sfx(n);
      g.sfx.length = 0;
      musicT -= dt;
      if (musicT <= 0) {
        musicT = 0.5;
        setMusicIntensity(Math.min(4, Math.floor(g.wave / 7) + (g.chips > 1 ? 1 : 0)), g.viruses.some((x) => x.boss));
      }
      // Events
      for (const e of g.events) {
        if (e === 'wave' || e === 'boss') {
          snapRef.current(snapshot(g));
          if (e === 'boss') {
            const bossType = g.spawns.find((s) => BOSS_NAMES[s.type])?.type;
            showBanner(`Oleada ${g.wave}`, g.wave % 25 === 0 ? `¡Titán: ${titanName(g.wave)}!` : bossType ? `¡Jefe: ${BOSS_NAMES[bossType]}!` : '¡Jefe!', true);
            haptic('heavy');
          } else showBanner(`Oleada ${g.wave}`);
          sfx(e);
        } else if (e === 'hit') haptic('error');
        else if (e === 'level') sfx('level');
        else if (e === 'chip') {
          haptic('heavy');
          sfx('chip');
          const ch = CHIPS[g.chips - 2];
          showBanner(ch?.main ? `¡${ch.core === 1 ? 'Segundo' : 'Tercer'} núcleo: ${ch.name}!` : `¡Nuevo chip: ${ch?.name ?? ''}!`, ch?.main ? 'Un núcleo nuevo con defensores nunca vistos' : 'Trabaja conectado a su núcleo con sus propios defensores');
        }
        else if (e === 'bosskill') {
          haptic('heavy');
          showBanner('Jefe eliminado', undefined, true);
        } else if (e === 'backup') showBanner('Copia de seguridad', 'El núcleo se ha restaurado');
        else if (e === 'evo') {
          haptic('success');
          sfx('evo');
        }
        else if (e === 'fusion') {
          haptic('heavy');
          sfx('fusion');
          showBanner('¡Fusión legendaria!', defenderName(g.defenders.find((d) => d.fuse && !seenFusions.current.has(d.id)) ?? g.defenders[0]));
          g.defenders.forEach((d) => d.fuse && seenFusions.current.add(d.id));
        } else if (e.startsWith('mod:')) {
          const m = MODS[e.slice(4)];
          if (m) showBanner(m.name, m.desc, true);
          sfx('boss');
        } else if (e.startsWith('phase:')) {
          showBanner(`¡Fase ${e.slice(6)}!`, 'El jefe cambia de táctica', true);
          haptic('heavy');
          sfx('boss');
        } else if (e === 'emp') {
          haptic('error');
          sfx('hurt');
        } else if (e === 'titankill') {
          showBanner('¡Titán derrotado!', '+3 mejoras', true);
          haptic('heavy');
          sfx('bossdie');
        } else if (e === 'chipevo') {
          const ev = [...CHIPS].reverse().find((c) => c.form && g.taken[g.taken.length - 1] === `chipevo-${c.id}`) ?? CHIPS.find((c) => g.taken.includes(`chipevo-${c.id}`));
          showBanner(`¡Evolución conjunta: ${ev?.form?.name ?? ''}!`, `Chip ${ev?.name ?? ''} al máximo`, true);
          haptic('heavy');
          sfx('fusion');
        } else if (e === 'coreevo') {
          showBanner(['', '¡El núcleo evoluciona!', '¡Núcleo binario!', '¡Núcleo trinario!'][g.g.coreEvo] ?? '¡El núcleo evoluciona!', g.g.coreEvo < 3 ? 'Se abre un núcleo nuevo' : 'La forma final', true);
          haptic('heavy');
          sfx('chip');
        } else if (e === 'wallbreak') {
          haptic('error');
          sfx('wallbreak');
          showBanner('¡Muro roto!', 'Se reconstruye en la próxima oleada', true);
        } else if (e.startsWith('syn:')) {
          const sy = SYNERGIES.find((x) => x.id === e.slice(4));
          if (sy) showBanner(`Sinergia: ${sy.name}`, sy.desc);
        }
      }
      g.events.length = 0;
      if (running && g.pending > 0 && !g.over) {
        const o = offer(g, () => rand(g));
        cardsRef.current = o;
        setCards(o);
        haptic('success');
      } else if (running && g.pact && !g.over) {
        // End of a wave: choose one pact.
        const o = offerPacts(g, () => rand(g));
        if (o.length) {
          pactsRef.current = o;
          setPacts(o);
          haptic('heavy');
        } else g.pact = false;
      }
      if (g.over && !finished.current) {
        finished.current = true;
        haptic('heavy');
        sfx('over');
        stopMusic();
        window.setTimeout(() => {
          setResult(finishRef.current(g));
          setPhase('over');
        }, motionMs(1300, 300));
      }
      const ctx = c.getContext('2d', { alpha: false });
      const q = quality.current;
      const dr = dragRef.current;
      if (ctx && bg.current) draw(ctx, g, { ...view.current, coreImg: coreImg.current, lite: q.step.lite, sel: pausedRef.current ? selRef.current : null, drag: pausedRef.current && dr?.moved ? { id: dr.id, x: dr.x, y: dr.y } : null }, bg.current, c.width / view.current.w);
      // Adapt effects and resolution to keep the frame rate up.
      if (q.sample(interval, performance.now() - t0) && q.step.dpr !== dprRef.current) fitRef.current();
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.12;
        // Re-render the HUD only when something it shows has changed.
        const need = xpNeed(g.level);
        const sig = `${g.wave}|${Math.round((g.hp / g.maxHp) * 200)}|${g.level}|${Math.floor((g.xp / need) * 60)}|${g.kills}|${g.g.enemyHp.toFixed(2)}|${g.defenders.length}`;
        if (sig !== hudSig.current) {
          hudSig.current = sig;
          setHud({ wave: g.wave, hp: g.hp, max: g.maxHp, level: g.level, xp: g.xp, need, kills: g.kills, threat: g.g.enemyHp, defenders: g.defenders.length });
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // The end screen keeps the board drawn behind it.
  useEffect(() => {
    if (phase === 'over') {
      const g = game.current;
      const c = canvas.current;
      const ctx = c?.getContext('2d', { alpha: false });
      if (g && ctx && bg.current) draw(ctx, g, view.current, bg.current, c!.width / view.current.w);
    }
  }, [phase]);

  const pick = (c: Card, at?: number) => {
    const g = game.current;
    if (!g) return;
    // A new defender: first choose where it goes on the ring.
    if (c.kind === 'new' && at === undefined) {
      const opts = placements(g, c.id.slice(4) as DefKind);
      if (opts.length > 1) {
        haptic('tap');
        setPlacing({ card: c, opts });
        return;
      }
    }
    setPlacing(null);
    choose(g, c, at);
    sfx(c.kind === 'asc' ? 'asc' : 'pick');
    haptic(c.kind === 'evo' || c.kind === 'fusion' || c.kind === 'asc' ? 'heavy' : 'success');
    if (g.pending > 0) {
      const o = offer(g, () => rand(g));
      cardsRef.current = o;
      setCards(o);
    } else {
      cardsRef.current = null;
      setCards(null);
    }
  };
  const pickPact = (c: Card) => {
    const g = game.current;
    if (!g) return;
    choosePact(g, c);
    sfx('pick');
    haptic('heavy');
    pactsRef.current = null;
    setPacts(null);
  };
  const reroll = () => {
    const g = game.current;
    if (!g || g.g.rerolls <= 0) return;
    g.g.rerolls -= 1;
    haptic('tap');
    const o = offer(g, () => rand(g));
    cardsRef.current = o;
    setCards(o);
  };
  /** Formation: swap two defenders of the same ring. */
  const swapDefs = (a: number, b: number) => {
    const g = game.current;
    if (!g || a === b) return;
    const i = g.defenders.findIndex((d) => d.id === a);
    const j = g.defenders.findIndex((d) => d.id === b);
    if (i < 0 || j < 0 || (g.defenders[i].chip ?? 0) !== (g.defenders[j].chip ?? 0)) return;
    [g.defenders[i], g.defenders[j]] = [g.defenders[j], g.defenders[i]];
    refreshSynergies(g);
    g.events = g.events.filter((e) => !e.startsWith('syn:'));
    layoutRings(g);
    haptic('success');
    sfx('pick');
    setHud((h) => (h ? { ...h } : h));
  };
  /** Screen point → world. */
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    const v = view.current;
    return { x: (e.clientX - r.left - v.w / 2) / v.scale, y: (e.clientY - r.top - v.h / 2) / v.scale };
  };
  const defAt = (p: { x: number; y: number }, skip?: number) => {
    const g = game.current;
    if (!g) return null;
    let best: Game['defenders'][number] | null = null;
    let bd = 26 * 26;
    for (const d of g.defenders) {
      if (d.id === skip) continue;
      const dd = (d.x - p.x) ** 2 + (d.y - p.y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return best;
  };
  const endNow = () => {
    const g = game.current;
    if (!g) return;
    g.over = true;
    setPaused(false);
  };
  const resume = () => {
    setSel(null);
    dragRef.current = null;
    setPaused(false);
  };

  const g = game.current;
  const evoCards = cards?.[0]?.kind === 'evo';

  return (
    <div className={`inv${paused && phase === 'play' ? ' is-paused' : ''}`} ref={wrap}>
      <canvas
        ref={canvas}
        className="inv-canvas"
        aria-label="Tablero de la invasión"
        onPointerDown={(e) => {
          if (pausedRef.current) {
            // Pause: pick up a defender to move it.
            const p = toWorld(e);
            const d = defAt(p);
            if (d) {
              dragRef.current = { id: d.id, x: p.x, y: p.y, sx: e.clientX, sy: e.clientY, moved: false };
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            } else setSel(null);
            return;
          }
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch0.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: userZoom.current };
          }
        }}
        onPointerMove={(e) => {
          const dr = dragRef.current;
          if (pausedRef.current && dr) {
            const p = toWorld(e);
            dr.x = p.x;
            dr.y = p.y;
            if (Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) > 8) dr.moved = true;
            return;
          }
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && pinch0.current) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            userZoom.current = Math.max(0.6, Math.min(1.8, (pinch0.current.z * d) / Math.max(20, pinch0.current.d)));
          }
        }}
        onPointerUp={(e) => {
          const dr = dragRef.current;
          if (pausedRef.current && dr) {
            dragRef.current = null;
            const g = game.current;
            const me = g?.defenders.find((d) => d.id === dr.id);
            if (dr.moved) {
              // Dropped on a ring mate: they swap places.
              const o = defAt(toWorld(e), dr.id);
              if (o && me && (o.chip ?? 0) === (me.chip ?? 0)) swapDefs(dr.id, o.id);
              setSel(dr.id);
            } else if (sel !== null && sel !== dr.id && me && (g?.defenders.find((d) => d.id === sel)?.chip ?? 0) === (me.chip ?? 0)) {
              // Tap one, then tap another: swap.
              swapDefs(sel, dr.id);
              setSel(null);
            } else setSel(sel === dr.id ? null : dr.id);
            return;
          }
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch0.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch0.current = null;
        }}
      />

      {phase === 'intro' && (
        <div className="inv-intro">
          <button type="button" className="icon-btn inv-back" aria-label="Inicio" onClick={onHome}>
            <IconBack />
          </button>
          <div className="inv-intro-body">
            <span className="eyebrow">Modo infinito</span>
            <h1 className="inv-title display">Invasión</h1>
            <p className="inv-lead">Los virus atacan tu núcleo desde todas partes. Tus defensores disparan solos: tú decides cómo evolucionan.</p>
            <ul className="inv-rules">
              <li>Cada nivel eliges una mejora entre {CATALOGUE_SIZE} tipos distintos.</li>
              <li>Cada defensor evoluciona dos veces: tú eliges el camino.</li>
              <li>Combina defensores para activar sinergias y fusiona dos al máximo en uno legendario.</li>
              <li>Cuanto más fuerte eres, más fuertes vienen ellos.</li>
            </ul>
            {record.bestWave > 0 && (
              <p className="inv-best tnum">
                Mejor oleada <b>{record.bestWave}</b> · {fmt(record.totalKills)} virus eliminados
              </p>
            )}
          </div>
          <div className="inv-intro-cta">
            <div className="inv-sound-row">
              <button type="button" className={`inv-toggle${prefs.sfx ? ' is-on' : ''}`} aria-pressed={prefs.sfx} onClick={() => toggleSound('sfx')}>
                Efectos {prefs.sfx ? 'sí' : 'no'}
              </button>
              <button type="button" className={`inv-toggle${prefs.music ? ' is-on' : ''}`} aria-pressed={prefs.music} onClick={() => toggleSound('music')}>
                Música {prefs.music ? 'sí' : 'no'}
              </button>
            </div>

            <button type="button" className="inv-lab-btn" onClick={() => setPhase('lab')}>
              <span className="display">Laboratorio</span>
              <span className="tnum">◆ {fmt(record.datos)}</span>
            </button>
            {record.run ? (
              <>
                <button type="button" className="btn btn-primary btn-xl" onClick={() => start(record.run)}>
                  Continuar · oleada {record.run.wave + 1}
                </button>
                <button type="button" className="btn btn-ghost btn-lg" onClick={() => start(null)}>
                  Nueva partida
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary btn-xl" onClick={() => start(null)}>
                Defender el núcleo
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'lab' && (
        <div className="inv-intro inv-lab">
          <header className="map-top">
            <button type="button" className="icon-btn" aria-label="Volver" onClick={() => setPhase('intro')}>
              <IconBack />
            </button>
            <div className="map-title">
              <span className="eyebrow">Mejoras permanentes</span>
              <span className="map-name display">Laboratorio</span>
            </div>
            <span className="energy-pill energy-pill--datos display tnum">◆ {fmt(record.datos)}</span>
          </header>
          <div className="inv-lab-scroll">
            <p className="inv-lab-hint">Ganas datos ◆ en cada invasión: más cuanto más lejos llegues y más jefes derrotes.</p>
            {labLevel(record.lab, 'elegir') > 0 && (
              <section>
                <p className="eyebrow inv-lab-group">Tu defensor inicial</p>
                <div className="inv-start-list">
                  {DEF_KINDS.filter((k) => ['canon', 'laser', 'rayo', 'pulso', 'misil', 'hielo', 'cuchillas', 'mortero'].includes(k) || labLevel(record.lab, `u-${k}`) > 0).map((k) => {
                    const idx = DEF_KINDS.indexOf(k) + 1;
                    const on = (record.lab.start ?? 1) === idx;
                    return (
                      <button key={k} type="button" className={`inv-start${on ? ' is-on' : ''}`} style={{ ['--c' as string]: DEF_INFO[k].color }} onClick={() => { onSetStart(idx); haptic('tap'); }}>
                        {DEF_INFO[k].name}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            {(['unlock', 'boost', 'element'] as const).map((grp) => (
              <section key={grp}>
                <p className="eyebrow inv-lab-group">{grp === 'unlock' ? 'Nuevos defensores' : grp === 'boost' ? 'Mejoras para cada partida' : 'Afinidades de elemento'}</p>
                <div className="inv-lab-grid">
                  {LAB.filter((it) => it.group === grp).map((it) => {
                    const lvl = labLevel(record.lab, it.id);
                    const cost = labCost(record.lab, it.id);
                    const done = cost === null;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        className={`inv-lab-item${done ? ' is-done' : ''}`}
                        style={{ ['--c' as string]: it.color ?? 'var(--lime)' }}
                        disabled={done || record.datos < (cost ?? 0)}
                        onClick={() => haptic(onBuyLab(it.id) ? 'success' : 'error')}
                      >
                        <span className="inv-lab-name">{it.name}</span>
                        <span className="inv-lab-desc">{it.desc}</span>
                        <span className="inv-lab-foot tnum">
                          {it.max > 1 && (
                            <span className="inv-lab-pips" aria-label={`Nivel ${lvl} de ${it.max}`}>
                              {Array.from({ length: it.max }, (_, k) => <i key={k} className={k < lvl ? 'is-on' : ''} />)}
                            </span>
                          )}
                          <b>{done ? (it.group === 'unlock' ? 'Desbloqueado' : 'Máximo') : `◆ ${fmt(cost!)}`}</b>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {phase === 'play' && hud && g && (
        <>
          <div className="inv-hud">
            <div className="inv-hud-row">
              <button type="button" className="icon-btn inv-pause" aria-label="Pausa" onClick={() => setPaused(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
                  <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
                </svg>
              </button>
              <div className="inv-wave">
                <span className="display tnum">Oleada {Math.max(1, hud.wave)}</span>
                <span className="inv-threat tnum">Amenaza ×{hud.threat.toFixed(2).replace('.', ',')}</span>
              </div>
              <span className="inv-kills display tnum">
                {fmt(hud.kills)}
                <small>eliminados</small>
              </span>
            </div>
            <div className="inv-bars">
              <div className="inv-bar inv-bar--hp" aria-label={`Integridad ${Math.round((hud.hp / hud.max) * 100)} %`}>
                <span style={{ transform: `scaleX(${Math.max(0, hud.hp / hud.max)})` }} className={hud.hp / hud.max < 0.35 ? 'is-low' : ''} />
                <b className="tnum">Núcleo {Math.max(0, Math.round((hud.hp / hud.max) * 100))} %</b>
              </div>
              <div className="inv-bar inv-bar--xp">
                <span style={{ transform: `scaleX(${Math.min(1, hud.xp / hud.need)})` }} />
                <b className="tnum">Nivel {hud.level}</b>
              </div>
            </div>
          </div>
          {g.viruses.some((v) => v.type === 'titan') && (() => {
            const ti = g.viruses.find((v) => v.type === 'titan')!;
            return (
              <div className="inv-titan" aria-label="Vida del titán">
                <span className="display">{titanName(Math.max(25, g.wave))}</span>
                <div className="inv-titan-bar">
                  <span style={{ transform: `scaleX(${Math.max(0, ti.hp / ti.max)})` }} />
                </div>
                <small className="tnum">Fase {(ti.phase ?? 0) + 1}/3</small>
              </div>
            );
          })()}
          {banner && (
            <div className={`inv-banner${banner.boss ? ' inv-banner--boss' : ''}`} key={banner.key} onAnimationEnd={() => setBanner(null)}>
              <span className="display">{banner.text}</span>
              {banner.sub && <small>{banner.sub}</small>}
            </div>
          )}
        </>
      )}

      {phase === 'play' && cards && g && placing && (
        <div className="inv-sheet" role="dialog" aria-label="Coloca tu defensor">
          <div className="inv-sheet-card">
            <span className="eyebrow">Nuevo defensor</span>
            <p className="inv-sheet-title display">¿Dónde colocas {placing.card.title}?</p>
            <p className="inv-place-hint">Los combos son más fuertes si los dos defensores están juntos.</p>
            <div className="inv-cards inv-places">
              {placing.opts.map((o, i) => (
                <button key={o.at} type="button" className="inv-card inv-place" style={{ ['--c' as string]: placing.card.color, ['--i' as string]: i }} onClick={() => pick(placing.card, o.at)}>
                  <RingPreview g={g} at={o.at} kind={placing.card.id.slice(4) as DefKind} />
                  <span className="inv-place-text">
                    <span className="inv-card-title display">
                      Entre {defenderName(o.left)} y {defenderName(o.right)}
                    </span>
                    <span className={`inv-card-desc${o.syn.length ? ' is-syn' : ''}`}>{o.syn.length ? `Refuerza: ${o.syn.join(', ')}` : 'Sin combos con sus vecinos'}</span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className="inv-reroll inv-place-back" onClick={() => setPlacing(null)}>
              Volver a las cartas
            </button>
          </div>
        </div>
      )}

      {phase === 'play' && cards && g && !placing && (
        <div className="inv-sheet" role="dialog" aria-label="Elige una mejora">
          <div className="inv-sheet-card">
            <span className="eyebrow">{evoCards ? '¡Evolución!' : `Nivel ${g.level}`}</span>
            <p className="inv-sheet-title display">{evoCards ? 'Elige un camino' : 'Elige una mejora'}</p>
            <div className={`inv-cards${evoCards ? ' inv-cards--evo' : ''}`}>
              {cards.map((c, i) => (
                <button key={c.key} type="button" className={`inv-card inv-card--${c.kind} inv-card--${c.rarity}`} style={{ ['--c' as string]: c.color, ['--c2' as string]: c.color2 ?? c.color, ['--i' as string]: i }} onClick={() => pick(c)}>
                  <span className="inv-card-top">
                    <span className="inv-card-tag">{c.tag}</span>
                    <span className="inv-card-rarity">{RARITY_LABEL[c.rarity]}</span>
                  </span>
                  <span className="inv-card-title display">{c.title}</span>
                  <span className="inv-card-desc">{c.desc}</span>
                </button>
              ))}
            </div>
            <div className="inv-sheet-foot">
              <span className="tnum">
                Defensores {g.defenders.length}/{MAX_DEFENDERS} · cada mejora refuerza a los virus
              </span>
              {!evoCards && g.g.rerolls > 0 && (
                <button type="button" className="inv-reroll" onClick={reroll}>
                  Cambiar ({g.g.rerolls})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'play' && pacts && g && !cards && (
        <div className="inv-sheet" role="dialog" aria-label="Elige un pacto">
          <div className="inv-sheet-card">
            <span className="eyebrow">Oleada {g.wave} superada</span>
            <p className="inv-sheet-title display">Elige un pacto</p>
            <div className="inv-cards">
              {pacts.map((c, i) => (
                <button key={c.key} type="button" className="inv-card inv-card--pact inv-card--epica" style={{ ['--c' as string]: c.color, ['--c2' as string]: c.color, ['--i' as string]: i }} onClick={() => pickPact(c)}>
                  <span className="inv-card-top">
                    <span className="inv-card-tag">{c.tag}</span>
                    <span className="inv-card-rarity">Pacto</span>
                  </span>
                  <span className="inv-card-title display">{c.title}</span>
                  <span className="inv-card-desc">{c.desc}</span>
                </button>
              ))}
            </div>
            <div className="inv-sheet-foot">
              <span className="tnum">
                {pactCount(g)} pactos · experiencia +{Math.round((g.g.xpMul - 1) * 100)} % · amenaza ×{g.g.enemyHp.toFixed(1).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>
      )}

      {phase === 'play' && paused && g && !cards && !pacts && (
        <PauseView g={g} sel={sel} prefs={prefs} onToggle={toggleSound} onResume={resume} onEnd={endNow} />
      )}

      {phase === 'over' && result && (
        <div className="inv-sheet inv-sheet--over" role="dialog" aria-label="Fin de la invasión">
          <div className="inv-sheet-card">
            <span className="eyebrow">{result.newRecord ? '¡Nuevo récord!' : 'Núcleo destruido'}</span>
            <p className="inv-over-num display tnum">{result.wave}</p>
            <p className="inv-over-label">{result.wave === 1 ? 'oleada' : 'oleadas'}</p>
            <div className="inv-over-stats">
              <div>
                <b className="display tnum">{fmt(result.kills)}</b>
                <span>virus</span>
              </div>
              <div>
                <b className="display tnum">{result.bosses}</b>
                <span>jefes</span>
              </div>
              <div>
                <b className="display tnum">{fmtTime(result.time)}</b>
                <span>tiempo</span>
              </div>
            </div>
            {result.threat !== undefined && (
              <div className="inv-over-meter" aria-label={`Amenaza ×${result.threat.toFixed(1)}: recompensas ×${result.threatMul.toFixed(2)}`}>
                <div className="inv-over-meter-row">
                  <span>Amenaza ×{result.threat.toFixed(1).replace('.', ',')}</span>
                  <b className="tnum">recompensas ×{result.threatMul.toFixed(2).replace('.', ',')}</b>
                </div>
                <div className="inv-over-meter-bar">
                  <span style={{ transform: `scaleX(${Math.min(1, Math.log(Math.max(1, result.threat)) / Math.log(60))})` }} />
                </div>
                <small>Cuanto más lejos llegas y más dura es la amenaza, más ganas.</small>
              </div>
            )}
            <div className="inv-over-loot">
              {result.energy > 0 && <span className="energy-pill display tnum">+{fmt(result.energy)} ⚡ Núcleo</span>}
              {result.datos > 0 && <span className="energy-pill energy-pill--datos display tnum">+{fmt(result.datos)} ◆ Laboratorio</span>}
            </div>
            <div className="inv-pause-cta">
              <button type="button" className="btn btn-primary btn-xl" onClick={() => start(null)}>
                Otra vez
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={onHome}>
                Inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pause: the camera is on your central chip; stats on one side, actions on the other. */
function PauseView({ g, sel, prefs, onToggle, onResume, onEnd }: { g: Game; sel: number | null; prefs: { sfx: boolean; music: boolean }; onToggle: (k: 'sfx' | 'music') => void; onResume: () => void; onEnd: () => void }) {
  const d = g.defenders.find((x) => x.id === sel) ?? null;
  const ring = d ? g.defenders.filter((x) => (x.chip ?? 0) === (d.chip ?? 0)) : [];
  const i = d ? ring.indexOf(d) : -1;
  const nb = d && ring.length > 1 ? [ring[(i - 1 + ring.length) % ring.length], ring[(i + 1) % ring.length]].filter((x, k, a) => x !== d && a.indexOf(x) === k) : [];
  const adj = d ? SYNERGIES.filter((sy) => g.synAdj.includes(sy.id) && kindsOf(d).some((k) => k === sy.a || k === sy.b)) : [];
  return (
    <div className="inv-pausev" role="dialog" aria-label="Pausa">
      <div className="inv-pausev-side inv-pausev-stats">
        <span className="eyebrow">Pausa · {fmtTime(g.t)}</span>
        <dl className="inv-pausev-grid tnum">
          <div><dt>Oleada</dt><dd>{g.wave}</dd></div>
          <div><dt>Nivel</dt><dd>{g.level}</dd></div>
          <div><dt>Virus</dt><dd>{fmt(g.kills)}</dd></div>
          <div><dt>Mejoras</dt><dd>{g.taken.length}</dd></div>
          <div><dt>Pactos</dt><dd>{pactCount(g)}</dd></div>
          <div><dt>Experiencia</dt><dd>+{Math.round((g.g.xpMul - 1) * 100)} %</dd></div>
          <div><dt>Amenaza</dt><dd>×{g.g.enemyHp.toFixed(1).replace('.', ',')}</dd></div>
          <div><dt>Chips</dt><dd>{g.chips}/{MAX_CHIPS}</dd></div>
        </dl>
        <p className="inv-pausev-loot tnum">Si terminas ahora: ⚡ {fmt(energyFor(g))} · ◆ {fmt(datosFor(g))}</p>
        <div className="inv-sound-row">
          <button type="button" className={`inv-toggle${prefs.sfx ? ' is-on' : ''}`} aria-pressed={prefs.sfx} onClick={() => onToggle('sfx')}>
            Efectos {prefs.sfx ? 'sí' : 'no'}
          </button>
          <button type="button" className={`inv-toggle${prefs.music ? ' is-on' : ''}`} aria-pressed={prefs.music} onClick={() => onToggle('music')}>
            Música {prefs.music ? 'sí' : 'no'}
          </button>
        </div>
      </div>
      <div className="inv-pausev-side inv-pausev-actions">
        {d ? (
          <div className="inv-pausev-pick" style={{ ['--c' as string]: DEF_INFO[d.kind].color }}>
            <b>{defenderName(d)}</b>
            <span className="tnum">
              <i style={{ color: ELEMENTS[DEF_EL[d.kind]].color }}>{ELEMENTS[DEF_EL[d.kind]].name}</i> · nv {d.lvl} · {fmt(d.kills)} virus · {ULTS[d.kind].name}
            </span>
            {nb.length > 0 && <span>Vecinos: {nb.map((x) => defenderName(x)).join(' y ')}</span>}
            {adj.length > 0 && <span className="inv-pausev-syn">Sinergia de vecinos: {adj.map((x) => x.name).join(', ')}</span>}
            <small>Arrástralo sobre otro de su anillo, o toca el otro, para cambiarlos.</small>
          </div>
        ) : (
          <p className="inv-pausev-hint">Toca un defensor para elegirlo y arrástralo a otro sitio de su anillo.</p>
        )}
        <div className="inv-pause-cta inv-pausev-cta">
          <button type="button" className="btn btn-primary btn-lg" onClick={onResume}>
            Continuar
          </button>
          <button type="button" className="btn btn-ghost btn-lg btn-danger" onClick={onEnd}>
            Terminar partida
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small diagram of the ring with the new defender in its proposed place. */
function RingPreview({ g, at, kind }: { g: Game; at: number; kind: DefKind }) {
  const list: { kinds: DefKind[]; isNew: boolean }[] = g.defenders.map((d) => ({ kinds: kindsOf(d), isNew: false }));
  list.splice(at, 0, { kinds: [kind], isNew: true });
  const n = list.length;
  return (
    <svg viewBox="-30 -30 60 60" className="inv-ring-preview" aria-hidden="true">
      <circle r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="2 3" />
      <rect x="-5" y="-5" width="10" height="10" rx="2.5" fill="#15171b" stroke="var(--lime)" strokeWidth="1.2" />
      {list.map((d, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
        const x = Math.cos(a) * 20;
        const y = Math.sin(a) * 20;
        return d.isNew ? (
          <g key={i}>
            <circle cx={x} cy={y} r="7.5" fill={DEF_INFO[kind].color} opacity="0.25" />
            <circle cx={x} cy={y} r="4.6" fill={DEF_INFO[kind].color} stroke="#fff" strokeWidth="1.2" />
          </g>
        ) : (
          <circle key={i} cx={x} cy={y} r="3.2" fill={DEF_INFO[d.kinds[0]].color} opacity="0.85" />
        );
      })}
    </svg>
  );
}
