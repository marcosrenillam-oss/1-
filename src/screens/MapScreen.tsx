import { useEffect, useRef, useState } from 'react';
import { STAGE_THEME, WORLD_LEVELS, WORLDS } from '../engine/difficulty';
import type { SaveData } from '../storage/persistence';
import { IconArrow, IconBack, IconCrown, IconLock } from '../components/Icons';
import { themeVars } from './GameScreen';

interface Props {
  save: SaveData;
  /** Level just passed (animated), if any. */
  justPassed?: { world: number; level: number } | null;
  onPlay: () => void;
  onHome: () => void;
}

const STEP = 78; // px between levels
const TOP = 70;

/** Horizontal position (%) of level n along the winding path. */
const xOf = (n: number) => 50 + 30 * Math.sin(n * 0.55) + 6 * Math.sin(n * 0.17);

export function MapScreen({ save, justPassed, onPlay, onHome }: Props) {
  const a = save.adventure;
  const [view, setView] = useState(a.finished ? WORLDS.length - 1 : a.world);
  const current = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => current.current?.scrollIntoView({ block: 'center', behavior: justPassed ? 'smooth' : 'auto' }), justPassed ? 650 : 50);
    return () => clearTimeout(t);
  }, [view, justPassed]);

  const status = (n: number) => {
    if (a.finished || view < a.world) return 'done';
    if (view > a.world) return 'locked';
    return n < a.level ? 'done' : n === a.level ? 'current' : 'locked';
  };
  const total = WORLD_LEVELS + 1; // + boss
  const height = TOP + total * STEP + 60;
  const points = Array.from({ length: total }, (_, i) => `${xOf(i + 1)},${TOP + i * STEP}`).join(' ');
  const doneUpTo = a.finished || view < a.world ? total : view === a.world ? a.level - 1 : 0;
  const donePoints = Array.from({ length: Math.max(0, Math.min(total, doneUpTo + 1)) }, (_, i) => `${xOf(i + 1)},${TOP + i * STEP}`).join(' ');
  const playable = !a.finished && view === a.world;

  return (
    <div className="screen-inner map" style={themeVars(view)}>
      <header className="map-top">
        <button type="button" className="icon-btn" aria-label="Inicio" onClick={onHome}>
          <IconBack />
        </button>
        <div className="map-title">
          <span className="eyebrow">Mundo {view + 1} de {WORLDS.length}</span>
          <span className="map-name display">{WORLDS[view].name}</span>
        </div>
        <span className="map-pct display tnum">{a.finished || view < a.world ? '1' : view === a.world ? Math.min(100, WORLD_LEVELS + 1 - a.level) || 1 : 100}%</span>
      </header>

      <nav className="map-worlds" aria-label="Mundos">
        {WORLDS.map((w, i) => {
          const locked = !a.finished && i > a.world;
          return (
            <button
              key={i}
              type="button"
              className={`map-world${i === view ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
              style={{ ['--seg' as string]: STAGE_THEME[i].accent }}
              disabled={locked}
              onClick={() => setView(i)}
              aria-label={`Mundo ${i + 1}: ${w.name}${locked ? ' (bloqueado)' : ''}`}
            >
              {locked ? <IconLock className="map-world-icon" /> : i + 1}
            </button>
          );
        })}
      </nav>
      <p className="map-tag">{WORLDS[view].tagline} Baja del 100 % al 1 % y vence al jefe.</p>

      <div className="map-path" style={{ height }}>
        <svg className="map-line" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} className="map-line-bg" vectorEffect="non-scaling-stroke" />
          {donePoints && <polyline points={donePoints} className="map-line-done" vectorEffect="non-scaling-stroke" />}
        </svg>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const boss = n === total;
          const st = boss ? (a.finished || view < a.world ? 'done' : view === a.world && a.level === total ? 'current' : 'locked') : status(n);
          const milestone = !boss && (WORLD_LEVELS + 1 - n) % 10 === 0;
          const just = justPassed && justPassed.world === view && justPassed.level === n;
          return (
            <button
              key={n}
              ref={st === 'current' ? current : undefined}
              type="button"
              className={`node node--${st}${boss ? ' node--boss' : ''}${milestone ? ' node--mile' : ''}${just ? ' node--just' : ''}`}
              style={{ left: `${xOf(n)}%`, top: TOP + i * STEP }}
              disabled={st !== 'current'}
              onClick={onPlay}
              aria-label={boss ? 'Jefe final' : `Nivel ${WORLD_LEVELS + 1 - n} %`}
            >
              {boss ? (
                <>
                  <IconCrown className="node-crown" />
                  <span className="node-boss-label display">Jefe</span>
                </>
              ) : st === 'locked' && !milestone ? (
                <span className="node-dot" />
              ) : (
                <span className="node-label display tnum">{WORLD_LEVELS + 1 - n}%</span>
              )}
            </button>
          );
        })}
      </div>

      {playable && (
        <div className="map-cta">
          <button type="button" className="btn btn-primary btn-xl" onClick={onPlay}>
            <span>{a.level > WORLD_LEVELS ? 'Enfrentarse al jefe' : `Jugar nivel ${WORLD_LEVELS + 1 - a.level} %`}</span>
            <IconArrow className="btn-icon" />
          </button>
        </div>
      )}
    </div>
  );
}
