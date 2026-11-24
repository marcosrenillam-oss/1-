import { useCallback, useEffect, useRef, useState } from 'react';
import { CATALOGUE_SIZE, choose, MAX_DEFENDERS, offer, type Card } from '../invasion/cards';
import { DEF_INFO, defenderName } from '../invasion/defenders';
import type { InvasionResult } from '../invasion/record';
import { draw, drawBackground, type View } from '../invasion/render';
import { BOSS_NAMES, energyFor, newGame, rand, restore, snapshot, tap, update, xpNeed, type InvasionSnapshot } from '../invasion/sim';
import type { Game } from '../invasion/types';
import type { InvasionRecord } from '../storage/persistence';
import { IconBack } from '../components/Icons';
import { haptic } from '../haptics';
import { motionMs } from '../motion';

interface Props {
  record: InvasionRecord;
  color: string;
  onSnapshot: (s: InvasionSnapshot) => void;
  onFinish: (g: Game) => InvasionResult;
  onHome: () => void;
}

type Phase = 'intro' | 'play' | 'over';
interface Hud {
  wave: number;
  hp: number;
  max: number;
  level: number;
  xp: number;
  need: number;
  kills: number;
  threat: number;
  tap: number;
  defenders: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** World units across the short side of the screen. */
const WORLD = 360;

export function InvasionScreen({ record, color, onSnapshot, onFinish, onHome }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [hud, setHud] = useState<Hud | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<{ text: string; sub?: string; boss?: boolean; key: number } | null>(null);
  const [result, setResult] = useState<InvasionResult | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const view = useRef<View>({ w: 390, h: 800, scale: 1, color });
  const bg = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(false);
  const cardsRef = useRef<Card[] | null>(null);
  const finished = useRef(false);
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
    game.current = from ? restore(from, ax, ay) : newGame(undefined, ax, ay);
    finished.current = false;
    setResult(null);
    setCards(null);
    setPaused(false);
    setPhase('play');
    haptic('heavy');
  }, []);

  // Size: canvas fills the screen; the world keeps WORLD units on the short side.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const v = view.current;
      v.w = r.width;
      v.h = r.height;
      v.scale = Math.min(r.width, r.height) / WORLD;
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
        const ctx = c.getContext('2d');
        ctx?.setTransform(1, 0, 0, 1, 0, 0);
        ctx?.drawImage(bg.current, 0, 0);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [color]);

  // Test hook (only with the e2e flag): lets the browser tests drive the game.
  useEffect(() => {
    try {
      if (localStorage.getItem('uno-por-ciento:e2e') === '1') (window as unknown as { __inv?: unknown }).__inv = game;
    } catch {
      /* no storage */
    }
  }, []);

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
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = game.current;
      const c = canvas.current;
      if (!g || !c) return;
      const running = !pausedRef.current && !cardsRef.current;
      if (running) update(g, dt);
      // Events
      for (const e of g.events) {
        if (e === 'wave' || e === 'boss') {
          snapRef.current(snapshot(g));
          if (e === 'boss') {
            const bossType = g.spawns.find((s) => BOSS_NAMES[s.type])?.type;
            showBanner(`Oleada ${g.wave}`, bossType ? `¡Jefe: ${BOSS_NAMES[bossType]}!` : '¡Jefe!', true);
            haptic('heavy');
          } else showBanner(`Oleada ${g.wave}`);
        } else if (e === 'hit') haptic('error');
        else if (e === 'bosskill') {
          haptic('heavy');
          showBanner('Jefe eliminado', undefined, true);
        } else if (e === 'backup') showBanner('Copia de seguridad', 'El núcleo se ha restaurado');
        else if (e === 'evo') haptic('success');
      }
      g.events.length = 0;
      if (running && g.pending > 0 && !g.over) {
        const o = offer(g, () => rand(g));
        cardsRef.current = o;
        setCards(o);
        haptic('success');
      }
      if (g.over && !finished.current) {
        finished.current = true;
        haptic('heavy');
        window.setTimeout(() => {
          setResult(finishRef.current(g));
          setPhase('over');
        }, motionMs(1300, 300));
      }
      const ctx = c.getContext('2d');
      if (ctx && bg.current) draw(ctx, g, view.current, bg.current, c.width / view.current.w);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.1;
        setHud({ wave: g.wave, hp: g.hp, max: g.maxHp, level: g.level, xp: g.xp, need: xpNeed(g.level), kills: g.kills, threat: g.g.enemyHp, tap: g.tapCd, defenders: g.defenders.length });
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
      const ctx = c?.getContext('2d');
      if (g && ctx && bg.current) draw(ctx, g, view.current, bg.current, c!.width / view.current.w);
    }
  }, [phase]);

  const onPointer = (e: React.PointerEvent) => {
    const g = game.current;
    if (!g || paused || cards || phase !== 'play') return;
    const r = e.currentTarget.getBoundingClientRect();
    const v = view.current;
    if (tap(g, (e.clientX - r.left - v.w / 2) / v.scale, (e.clientY - r.top - v.h / 2) / v.scale)) haptic('tap');
  };

  const pick = (c: Card) => {
    const g = game.current;
    if (!g) return;
    choose(g, c);
    haptic(c.kind === 'evo' ? 'heavy' : 'success');
    if (g.pending > 0) {
      const o = offer(g, () => rand(g));
      cardsRef.current = o;
      setCards(o);
    } else {
      cardsRef.current = null;
      setCards(null);
    }
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
  const endNow = () => {
    const g = game.current;
    if (!g) return;
    g.over = true;
    setPaused(false);
  };

  const g = game.current;
  const evoCards = cards?.[0]?.kind === 'evo';

  return (
    <div className="inv" ref={wrap}>
      <canvas ref={canvas} className="inv-canvas" onPointerDown={onPointer} aria-label="Tablero de la invasión" />

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
              <li>Toca la pantalla para lanzar descargas.</li>
              <li>Cuanto más fuerte eres, más fuertes vienen ellos.</li>
            </ul>
            {record.bestWave > 0 && (
              <p className="inv-best tnum">
                Mejor oleada <b>{record.bestWave}</b> · {fmt(record.totalKills)} virus eliminados
              </p>
            )}
          </div>
          <div className="inv-intro-cta">
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
          {hud.wave <= 1 && <p className="inv-hint">Toca la pantalla para lanzar descargas</p>}
          <div className={`inv-tap${hud.tap > 0 ? '' : ' is-ready'}`} aria-hidden="true" />
          {banner && (
            <div className={`inv-banner${banner.boss ? ' inv-banner--boss' : ''}`} key={banner.key} onAnimationEnd={() => setBanner(null)}>
              <span className="display">{banner.text}</span>
              {banner.sub && <small>{banner.sub}</small>}
            </div>
          )}
        </>
      )}

      {phase === 'play' && cards && g && (
        <div className="inv-sheet" role="dialog" aria-label="Elige una mejora">
          <div className="inv-sheet-card">
            <span className="eyebrow">{evoCards ? '¡Evolución!' : `Nivel ${g.level}`}</span>
            <p className="inv-sheet-title display">{evoCards ? 'Elige un camino' : 'Elige una mejora'}</p>
            <div className={`inv-cards${evoCards ? ' inv-cards--evo' : ''}`}>
              {cards.map((c, i) => (
                <button key={c.key} type="button" className={`inv-card inv-card--${c.kind}`} style={{ ['--c' as string]: c.color, ['--i' as string]: i }} onClick={() => pick(c)}>
                  <span className="inv-card-tag">{c.tag}</span>
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

      {phase === 'play' && paused && g && (
        <div className="inv-sheet" role="dialog" aria-label="Pausa">
          <div className="inv-sheet-card">
            <span className="eyebrow">Pausa · {fmtTime(g.t)}</span>
            <p className="inv-sheet-title display">Tu defensa</p>
            <ul className="inv-build">
              {g.defenders.map((d) => (
                <li key={d.id} style={{ ['--c' as string]: DEF_INFO[d.kind].color }}>
                  <span className="inv-build-dot" />
                  <span className="inv-build-name">{defenderName(d)}</span>
                  <span className="inv-build-meta tnum">
                    nv {d.lvl} · {fmt(d.kills)} virus
                  </span>
                </li>
              ))}
            </ul>
            <p className="inv-build-sum tnum">
              {g.taken.length} mejoras · {new Set(g.taken).size} distintas de {CATALOGUE_SIZE} · ⚡ {fmt(energyFor(g))} si terminas ahora
            </p>
            <div className="inv-pause-cta">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setPaused(false)}>
                Continuar
              </button>
              <button type="button" className="btn btn-ghost btn-lg btn-danger" onClick={endNow}>
                Terminar partida
              </button>
            </div>
          </div>
        </div>
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
            {result.energy > 0 && <span className="energy-pill display tnum inv-over-energy">+{fmt(result.energy)} ⚡ para tu Núcleo</span>}
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
