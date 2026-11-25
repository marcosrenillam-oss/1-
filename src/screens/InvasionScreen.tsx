import { useCallback, useEffect, useRef, useState } from 'react';
import { CATALOGUE_SIZE, choose, kindsOf, MAX_DEFENDERS, offer, placements, RARITY_LABEL, type Card, type Placement } from '../invasion/cards';
import { LAB, labCost, labLevel, startOpts } from '../invasion/lab';
import { DEF_EL, DEF_INFO, defenderName, ELEMENTS, SYNERGIES, ULTS } from '../invasion/defenders';
import type { InvasionResult } from '../invasion/record';
import { draw, drawBackground, type View } from '../invasion/render';
import { BOSS_NAMES, datosFor, energyFor, newGame, rand, restore, snapshot, update, xpNeed, type InvasionSnapshot } from '../invasion/sim';
import type { DefKind, Game } from '../invasion/types';
import type { InvasionRecord } from '../storage/persistence';
import { IconBack } from '../components/Icons';
import { haptic } from '../haptics';
import { onSoundPrefs, setMusicIntensity, setSoundPrefs, sfx, soundPrefs, startMusic, stopMusic, unlockAudio } from '../audio';
import { CHIPS } from '../invasion/defenders';
import { motionMs } from '../motion';

interface Props {
  record: InvasionRecord;
  color: string;
  onSnapshot: (s: InvasionSnapshot) => void;
  onFinish: (g: Game) => InvasionResult;
  onBuyLab: (id: string) => boolean;
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
const ZOOM = [1, 1.55, 1.6, 1.8, 1.9];

export function InvasionScreen({ record, color, onSnapshot, onFinish, onBuyLab, onHome }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const [hud, setHud] = useState<Hud | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
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
  const dprRef = useRef(1);
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
      const dpr = Math.min(3, window.devicePixelRatio || 1);
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
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = game.current;
      const c = canvas.current;
      if (!g || !c) return;
      const running = !pausedRef.current && !cardsRef.current;
      if (running) update(g, dt);
      // Zoom out smoothly when a chip is added.
      const want = ZOOM[Math.min(ZOOM.length, g.chips) - 1];
      if (Math.abs(want - zoomRef.current) > 0.002) {
        zoomRef.current += (want - zoomRef.current) * Math.min(1, dt * 2.5);
        const v = view.current;
        v.scale = Math.min(v.w, v.h) / (WORLD * zoomRef.current);
        g.arena = v.w / 2 / v.scale;
        g.arenaY = v.h / 2 / v.scale;
        if (bg.current) drawBackground(bg.current, v, dprRef.current);
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
            showBanner(`Oleada ${g.wave}`, bossType ? `¡Jefe: ${BOSS_NAMES[bossType]}!` : '¡Jefe!', true);
            haptic('heavy');
          } else showBanner(`Oleada ${g.wave}`);
          sfx(e);
        } else if (e === 'hit') haptic('error');
        else if (e === 'level') sfx('level');
        else if (e === 'chip') {
          haptic('heavy');
          sfx('chip');
          showBanner(`¡Nuevo chip: ${CHIPS[g.chips - 2]?.name ?? ''}!`, 'Trabaja conectado al núcleo con sus propios defensores');
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
      const ctx = c.getContext('2d');
      if (ctx && bg.current) draw(ctx, g, view.current, bg.current, c.width / view.current.w);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.1;
        setHud({ wave: g.wave, hp: g.hp, max: g.maxHp, level: g.level, xp: g.xp, need: xpNeed(g.level), kills: g.kills, threat: g.g.enemyHp, defenders: g.defenders.length });
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
      <canvas ref={canvas} className="inv-canvas" aria-label="Tablero de la invasión" />

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
            {(['unlock', 'boost'] as const).map((grp) => (
              <section key={grp}>
                <p className="eyebrow inv-lab-group">{grp === 'unlock' ? 'Nuevos defensores' : 'Mejoras para cada partida'}</p>
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

      {phase === 'play' && paused && g && (
        <div className="inv-sheet" role="dialog" aria-label="Pausa">
          <div className="inv-sheet-card">
            <span className="eyebrow">Pausa · {fmtTime(g.t)}</span>
            <p className="inv-sheet-title display">Tu defensa</p>
            <ul className="inv-build">
              {g.defenders.map((d) => (
                <li key={d.id} style={{ ['--c' as string]: DEF_INFO[d.kind].color, ['--c2' as string]: d.fuse ? DEF_INFO[d.fuse.kind].color : DEF_INFO[d.kind].color }} className={d.fuse ? 'is-fused' : ''}>
                  <span className="inv-build-dot" />
                  <span className="inv-build-name">{defenderName(d)}</span>
                  <span className="inv-build-meta tnum">
                    <i style={{ color: ELEMENTS[DEF_EL[d.kind]].color }}>{ELEMENTS[DEF_EL[d.kind]].name}</i> · {ULTS[d.kind].name} · nv {d.lvl} · {fmt(d.kills)}
                  </span>
                </li>
              ))}
            </ul>
            {g.syn.length > 0 && (
              <ul className="inv-syn">
                {g.syn.map((id) => {
                  const sy = SYNERGIES.find((x) => x.id === id)!;
                  return (
                    <li key={id} style={{ ['--c' as string]: DEF_INFO[sy.a].color, ['--c2' as string]: DEF_INFO[sy.b].color }}>
                      <b>{sy.name}</b> {sy.desc}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="inv-build-sum tnum">
              {g.taken.length} mejoras · {new Set(g.taken).size} distintas de {CATALOGUE_SIZE} · ⚡ {fmt(energyFor(g))} y ◆ {fmt(datosFor(g))} si terminas ahora
            </p>
            <div className="inv-sound-row">
              <button type="button" className={`inv-toggle${prefs.sfx ? ' is-on' : ''}`} aria-pressed={prefs.sfx} onClick={() => toggleSound('sfx')}>
                Efectos {prefs.sfx ? 'sí' : 'no'}
              </button>
              <button type="button" className={`inv-toggle${prefs.music ? ' is-on' : ''}`} aria-pressed={prefs.music} onClick={() => toggleSound('music')}>
                Música {prefs.music ? 'sí' : 'no'}
              </button>
            </div>
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
