import { useCallback, useEffect, useRef, useState } from 'react';
import { aiStep, buildLevel, levelInfo, PER_SECTOR, SECTORS, TOTAL_LEVELS } from '../enlace/levels';
import { nextLevel, totalStars, type EnlaceResult } from '../enlace/record';
import { drawEnlace, fitView, toScreen, toWorld, type Drag, type EView, type Skin } from '../enlace/render';
import { COLORS, MATERIALS } from '../engine/core';
import { canLink, cut, KIND_INFO, link, nodeR, update, type EGame, type ELink } from '../enlace/sim';
import type { SaveData } from '../storage/persistence';
import { IconBack } from '../components/Icons';
import { haptic } from '../haptics';
import { setMusicIntensity, sfx, startMusic, stopMusic, unlockAudio } from '../audio';

interface Props {
  save: SaveData;
  onFinish: (n: number, won: boolean, time: number) => EnlaceResult;
  onHome: () => void;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const Stars = ({ n, size = 12 }: { n: number; size?: number }) => (
  <span className="enl-stars" aria-label={`${n} de 3 estrellas`}>
    {[0, 1, 2].map((k) => (
      <svg key={k} viewBox="0 0 24 24" width={size} height={size} className={k < n ? 'is-on' : ''} aria-hidden="true">
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" />
      </svg>
    ))}
  </span>
);

export function EnlaceScreen({ save, onFinish, onHome }: Props) {
  const [phase, setPhase] = useState<'map' | 'play'>('map');
  const [level, setLevel] = useState(() => nextLevel(save));
  const [sector, setSector] = useState(() => levelInfo(nextLevel(save)).sector);
  const [result, setResult] = useState<EnlaceResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<EGame | null>(null);
  const view = useRef<EView>(fitView(390, 800, 90, 30));
  const dpr = useRef(1);
  const drag = useRef<Drag | null>(null);
  const trail = useRef<{ x: number; y: number }[]>([]);
  const pausedRef = useRef(false);
  const done = useRef(false);
  const skinRef = useRef<Skin | undefined>(undefined);
  {
    const col = COLORS.find((c) => c.id === save.core.color)?.hex ?? '#c8ff2e';
    const mat = MATERIALS.find((m) => m.id === save.core.material) ?? MATERIALS[0];
    skinRef.current = { color: col, body: mat.body, edge: mat.edge };
  }
  pausedRef.current = paused || !!result;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const levelRef = useRef(level);
  levelRef.current = level;
  const next = nextLevel(save);
  const stars = totalStars(save);

  const start = useCallback((n: number) => {
    game.current = buildLevel(n);
    done.current = false;
    setLevel(n);
    setResult(null);
    setPaused(false);
    setHint(levelInfo(n).hint ?? null);
    setPhase('play');
    unlockAudio();
    startMusic();
    haptic('tap');
  }, []);

  useEffect(() => () => stopMusic(), []);
  useEffect(() => {
    try {
      if (localStorage.getItem('uno-por-ciento:e2e') === '1') Object.assign(window as object, { __enl: game, __enlView: view, __enlScreen: toScreen });
    } catch {
      /* no storage */
    }
  }, []);

  // Size
  useEffect(() => {
    if (phase !== 'play') return;
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      dpr.current = Math.min(3, window.devicePixelRatio || 1);
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
      view.current = fitView(r.width, r.height, top + 64, 16);
      const c = canvas.current;
      if (c) {
        c.width = Math.round(r.width * dpr.current);
        c.height = Math.round(r.height * dpr.current);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // Loop
  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    let last = performance.now();
    let hud = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = game.current;
      const c = canvas.current;
      if (!g || !c) return;
      if (!pausedRef.current && !g.over) {
        update(g, dt);
        aiStep(g, dt);
      }
      for (const s of g.sfx) {
        sfx(s);
        if (s === 'capture') haptic('success');
        if (s === 'lost') haptic('error');
      }
      g.sfx.length = 0;
      if (g.over && !done.current) {
        done.current = true;
        const res = finishRef.current(levelRef.current, g.over === 1, g.t);
        setResult(res);
        haptic(res.won ? 'heavy' : 'error');
        stopMusic();
      }
      const ctx = c.getContext('2d');
      if (ctx) drawEnlace(ctx, g, view.current, dpr.current, drag.current, trail.current, skinRef.current);
      hud -= dt;
      if (hud <= 0) {
        hud = 0.25;
        setClock(g.t);
        const enemies = g.nodes.filter((n) => n.owner >= 2).length;
        setMusicIntensity(Math.min(4, 1 + Math.floor(enemies / 3)), false);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Touch: drag from your chip to lay a trace; swipe across a trace to cut it.
  const nodeAt = (sx: number, sy: number) => {
    const g = game.current!;
    const w = toWorld(view.current, sx, sy);
    let best = null;
    let bd = Infinity;
    for (const n of g.nodes) {
      const d = Math.hypot(n.x - w.x, n.y - w.y);
      if (d < nodeR(n) + 16 && d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };
  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    const g = game.current;
    if (!g || pausedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    const n = nodeAt(p.x, p.y);
    if (n && n.owner === 1) {
      const w = toWorld(view.current, p.x, p.y);
      drag.current = { from: n, x: w.x, y: w.y, target: null, ok: false };
      haptic('tap');
    } else trail.current = [p];
    if (hint) setHint(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = game.current;
    if (!g) return;
    const p = local(e);
    if (drag.current) {
      const w = toWorld(view.current, p.x, p.y);
      const t = nodeAt(p.x, p.y);
      drag.current.x = w.x;
      drag.current.y = w.y;
      drag.current.target = t && t !== drag.current.from ? t : null;
      drag.current.ok = !!drag.current.target && canLink(g, drag.current.from, drag.current.target, 1);
      return;
    }
    if (!trail.current.length) return;
    const prev = trail.current[trail.current.length - 1];
    trail.current.push(p);
    if (trail.current.length > 14) trail.current.shift();
    // Cut any of your traces crossed by the swipe.
    for (const l of [...g.links]) {
      if (l.owner !== 1) continue;
      const f = crossAt(g, l, prev, p);
      if (f !== null) {
        cut(g, l, f);
        haptic('tap');
      }
    }
  };
  const onUp = () => {
    const g = game.current;
    if (g && drag.current?.target && drag.current.ok) link(g, drag.current.from, drag.current.target, 1);
    drag.current = null;
    trail.current = [];
  };

  /** Where (0-1 along the trace) a swipe segment crosses it, or null. */
  const crossAt = (g: EGame, l: ELink, a: { x: number; y: number }, b: { x: number; y: number }): number | null => {
    const s = g.nodes.find((n) => n.id === l.from)!;
    const t = g.nodes.find((n) => n.id === l.to)!;
    const reach = l.state === 'on' ? l.clash : l.built / Math.max(l.len, 1);
    const p0 = toScreen(view.current, s.x, s.y);
    const p1full = toScreen(view.current, t.x, t.y);
    const p1 = { x: p0.x + (p1full.x - p0.x) * reach, y: p0.y + (p1full.y - p0.y) * reach };
    const d = (p1.x - p0.x) * (b.y - a.y) - (p1.y - p0.y) * (b.x - a.x);
    if (Math.abs(d) < 1e-6) return null;
    const u = ((a.x - p0.x) * (b.y - a.y) - (a.y - p0.y) * (b.x - a.x)) / d;
    const v = ((a.x - p0.x) * (p1.y - p0.y) - (a.y - p0.y) * (p1.x - p0.x)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? u * reach : null;
  };

  const info = levelInfo(level);

  if (phase === 'map') {
    const first = sector * PER_SECTOR + 1;
    return (
      <div className="screen-inner enl-map">
        <header className="map-top">
          <button type="button" className="icon-btn" aria-label="Inicio" onClick={onHome}>
            <IconBack />
          </button>
          <div className="map-title">
            <span className="eyebrow tnum">
              {Math.min(TOTAL_LEVELS, next - 1)}/{TOTAL_LEVELS} niveles · {stars}/{TOTAL_LEVELS * 3} ★
            </span>
            <span className="map-name display">Enlace</span>
          </div>
        </header>
        <p className="enl-lead">Tiende trazas desde tus chips, drena a los virus y conquista toda la red.</p>
        <nav className="enl-sectors" aria-label="Sectores">
          {SECTORS.map((name, i) => {
            const open = i * PER_SECTOR + 1 <= next;
            return (
              <button key={name} type="button" className={`enl-sector${i === sector ? ' is-active' : ''}`} disabled={!open} onClick={() => setSector(i)}>
                <b className="tnum">{i + 1}</b>
                <span>{open ? name : 'Bloqueado'}</span>
              </button>
            );
          })}
        </nav>
        <div className="enl-grid">
          {Array.from({ length: PER_SECTOR }, (_, k) => {
            const n = first + k;
            const st = save.enlace.stars[n] ?? 0;
            const open = n <= next || st > 0;
            return (
              <button key={n} type="button" className={`enl-level${n === next ? ' is-next' : ''}${st ? ' is-done' : ''}`} disabled={!open} onClick={() => start(n)} aria-label={`Nivel ${levelInfo(n).name}`}>
                <span className="display tnum">{k + 1}</span>
                {open ? <Stars n={st} size={9} /> : <span className="enl-lock">🔒</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary btn-xl enl-play" onClick={() => start(next)}>
          Jugar nivel {levelInfo(next).name}
        </button>
      </div>
    );
  }

  return (
    <div className="enl" ref={wrap}>
      <canvas ref={canvas} className="enl-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Red de chips" />
      <div className="enl-hud">
        <button type="button" className="icon-btn" aria-label="Pausa" onClick={() => setPaused(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
        <div className="enl-hud-title">
          <span className="display tnum">Nivel {info.name}</span>
          <small>{SECTORS[info.sector]}</small>
        </div>
        <span className={`enl-clock display tnum${clock > info.par ? ' is-late' : ''}`}>
          {fmtTime(clock)}
          <small>★★★ {fmtTime(info.par)}</small>
        </span>
      </div>
      {hint && (
        <button type="button" className="enl-hint" onClick={() => setHint(null)}>
          {hint}
        </button>
      )}
      <ul className="enl-legend" aria-hidden="true">
        {game.current &&
          [...new Set(game.current.nodes.map((n) => n.kind))]
            .filter((k) => k !== 'std')
            .map((k) => (
              <li key={k}>
                <b>{KIND_INFO[k].name}</b> {KIND_INFO[k].desc}
              </li>
            ))}
      </ul>

      {paused && !result && (
        <div className="inv-sheet" role="dialog" aria-label="Pausa">
          <div className="inv-sheet-card">
            <span className="eyebrow">Pausa · {fmtTime(clock)}</span>
            <p className="inv-sheet-title display">Nivel {info.name}</p>
            <div className="inv-pause-cta">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setPaused(false)}>
                Continuar
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => start(level)}>
                Reiniciar
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => { stopMusic(); setPhase('map'); }}>
                Ver niveles
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="inv-sheet inv-sheet--over" role="dialog" aria-label={result.won ? 'Nivel superado' : 'Red perdida'}>
          <div className="inv-sheet-card">
            <span className="eyebrow">{result.won ? `Nivel ${info.name} superado` : 'Red perdida'}</span>
            {result.won ? (
              <>
                <div className="enl-result-stars">
                  <Stars n={result.stars} size={40} />
                </div>
                <p className="inv-over-label tnum">
                  {fmtTime(result.time)} {result.best ? '· mejor tiempo' : ''}
                </p>
                {result.energy > 0 && <span className="energy-pill display tnum inv-over-energy">+{result.energy} ⚡ para tu Núcleo</span>}
              </>
            ) : (
              <p className="inv-over-label">Los virus se han quedado con todos tus chips.</p>
            )}
            <div className="inv-pause-cta">
              {result.won && level < TOTAL_LEVELS && (
                <button type="button" className="btn btn-primary btn-xl" onClick={() => start(level + 1)}>
                  Siguiente nivel
                </button>
              )}
              <button type="button" className={`btn ${result.won ? 'btn-ghost' : 'btn-primary'} btn-lg`} onClick={() => start(level)}>
                {result.won ? 'Repetir' : 'Reintentar'}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => { setResult(null); setPhase('map'); setSector(levelInfo(Math.min(TOTAL_LEVELS, level + (result.won ? 1 : 0))).sector); }}>
                Ver niveles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
