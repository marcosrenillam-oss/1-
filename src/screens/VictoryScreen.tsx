import { useEffect, useState } from 'react';
import { MODE_INFO, RUN_LENGTH } from '../engine/difficulty';
import { formatMs, winRate, type RunResult } from '../engine/game';
import { Celebration } from '../components/Celebration';
import { IconArrow } from '../components/Icons';
import { prefersReducedMotion } from '../motion';

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
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

export function VictoryScreen({ result, onRetry, onHome }: Props) {
  const info = MODE_INFO[result.mode];
  const s = result.stats;
  const n = useCountUp(RUN_LENGTH, 900, 250);
  const first = s.completed === 1;

  return (
    <div className="screen-inner victory">
      <div className="victory-stage">
        <Celebration />
        <div className="victory-score display tnum" aria-label="20 de 20">
          <span className="victory-num">{String(n).padStart(2, '0')}</span>
          <span className="victory-of">/{RUN_LENGTH}</span>
        </div>
      </div>

      <div className="victory-copy">
        <span className="eyebrow victory-eyebrow reveal" style={{ ['--d' as string]: '900ms' }}>
          Modo {info.label}{result.timed ? ' · Contrarreloj' : ''} completado
        </span>
        <h1 className="victory-title display reveal" style={{ ['--d' as string]: '1000ms' }}>
          Desafío superado
        </h1>
        <p className="victory-sub reveal" style={{ ['--d' as string]: '1100ms' }}>
          {first
            ? 'Tu primera victoria en este modo. Ahora formas parte del 1 %.'
            : `Victoria número ${s.completed} en este modo. Sigues en el 1 %.`}
        </p>
        {result.timed && result.totalMs !== undefined && (
          <p className="victory-time reveal display tnum" style={{ ['--d' as string]: '1140ms' }}>
            Tiempo total <b>{formatMs(result.totalMs)}</b>
          </p>
        )}
        {(result.newRecord || result.newBestTime) && (
          <span className="badge badge--lime reveal" style={{ ['--d' as string]: '1180ms' }}>
            {result.newRecord ? 'Nuevo récord · 20/20' : 'Nuevo mejor tiempo'}
          </span>
        )}
      </div>

      <section className="mini-stats reveal" style={{ ['--d' as string]: '1260ms' }}>
        <div>
          <span className="stat-value display tnum">{s.completed}</span>
          <span className="stat-label">Completadas</span>
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
          <span className="stat-label">Victorias</span>
        </div>
      </section>

      <div className="result-actions reveal" style={{ ['--d' as string]: '1340ms' }}>
        <button type="button" className="btn btn-primary btn-xl" onClick={onRetry}>
          <span>Nueva partida</span>
          <IconArrow className="btn-icon" />
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={onHome}>
          Inicio
        </button>
      </div>
    </div>
  );
}
