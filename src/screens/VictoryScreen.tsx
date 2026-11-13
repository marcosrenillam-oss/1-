import { useEffect, useState } from 'react';
import { MAX_RUN, MODE_INFO, STAGE_THEME, WORLDS } from '../engine/difficulty';
import { formatMs, winRate, type RunResult } from '../engine/game';
import { Celebration } from '../components/Celebration';
import { IconArrow } from '../components/Icons';
import { prefersReducedMotion } from '../motion';
import { themeVars } from './GameScreen';

interface Props {
  result: RunResult;
  onRetry: () => void;
  onHome: () => void;
}

function useCountUp(target: number, ms: number, delay: number) {
  const [v, setV] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setV(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

/** Full 100/100 victory, or a world boss defeated in the adventure. */
export function VictoryScreen({ result, onRetry, onHome }: Props) {
  const adventure = result.type === 'adventure';
  const world = result.world ?? 0;
  const theme = adventure ? (result.finished ? 4 : Math.min(4, world + 1)) : 4;
  const n = useCountUp(adventure ? world + 1 : MAX_RUN, 900, 250);
  const s = result.stats;

  return (
    <div className="screen-inner victory" style={themeVars(theme)}>
      <div className="victory-stage">
        <Celebration />
        <div className="victory-score display tnum">
          {adventure ? (
            <>
              <span className="victory-num">{n}</span>
              <span className="victory-of">/{WORLDS.length}</span>
            </>
          ) : (
            <>
              <span className="victory-num">{String(n).padStart(2, '0')}</span>
              <span className="victory-of">/{MAX_RUN}</span>
            </>
          )}
        </div>
      </div>

      <div className="victory-copy">
        <span className="eyebrow victory-eyebrow reveal" style={{ ['--d' as string]: '900ms' }}>
          {adventure ? `Mundo ${world + 1} · ${WORLDS[world].name}` : `Modo ${MODE_INFO[result.mode].label}${result.timed ? ' · Contrarreloj' : ''}`}
        </span>
        <h1 className="victory-title display reveal" style={{ ['--d' as string]: '1000ms' }}>
          {adventure ? (result.finished ? 'Aventura completada' : 'Jefe derrotado') : 'Cien de cien'}
        </h1>
        <p className="victory-sub reveal" style={{ ['--d' as string]: '1100ms' }}>
          {adventure
            ? result.finished
              ? 'Has vencido a los cinco jefes. Literalmente, eres del 1 %.'
              : `Se abre el mundo ${world + 2}: ${WORLDS[world + 1].name}. ${WORLDS[world + 1].tagline}`
            : 'Has superado las cinco fases sin un solo fallo. Pocas personas llegan hasta aquí.'}
        </p>
        {!adventure && result.timed && result.totalMs !== undefined && (
          <p className="victory-time reveal display tnum" style={{ ['--d' as string]: '1140ms' }}>
            Tiempo total <b>{formatMs(result.totalMs)}</b>
          </p>
        )}
        {!adventure && result.newRecord && (
          <span className="badge badge--lime reveal" style={{ ['--d' as string]: '1180ms' }}>
            Nuevo récord · 100/100
          </span>
        )}
      </div>

      {!adventure && s && (
        <section className="mini-stats reveal" style={{ ['--d' as string]: '1260ms' }}>
          <div>
            <span className="stat-value display tnum">{s.completed}</span>
            <span className="stat-label">Victorias</span>
          </div>
          <div>
            <span className="stat-value display tnum">{s.played}</span>
            <span className="stat-label">Partidas</span>
          </div>
          <div>
            <span className="stat-value display tnum">
              {winRate(s)}
              <small>%</small>
            </span>
            <span className="stat-label">Ratio</span>
          </div>
        </section>
      )}
      {adventure && (
        <div className="stage-track stage-track--result reveal" style={{ ['--d' as string]: '1260ms' }} aria-hidden="true">
          {STAGE_THEME.map((t, i) => (
            <span key={i} className={`stage-seg${i <= world ? ' is-done' : ''}`} style={{ ['--seg' as string]: t.accent }} />
          ))}
        </div>
      )}

      <div className="result-actions reveal" style={{ ['--d' as string]: '1340ms' }}>
        <button type="button" className="btn btn-primary btn-xl" onClick={onRetry}>
          <span>{adventure ? (result.finished ? 'Ver el mapa' : 'Al siguiente mundo') : 'Nueva partida'}</span>
          <IconArrow className="btn-icon" />
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={onHome}>
          Inicio
        </button>
      </div>
    </div>
  );
}
