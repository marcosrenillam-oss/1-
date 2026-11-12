import { BANK } from '../data/questions';
import type { Mode } from '../data/types';
import { MODE_INFO, RUN_LENGTH } from '../engine/difficulty';
import { formatMs, winRate } from '../engine/game';
import type { SaveData } from '../storage/persistence';
import { DifficultySelector } from '../components/DifficultySelector';
import { IconArrow, IconClock, IconInfinity } from '../components/Icons';
import { Logo } from '../components/Logo';

interface Props {
  save: SaveData;
  mode: Mode;
  timed: boolean;
  onMode: (m: Mode) => void;
  onTimed: (t: boolean) => void;
  onStart: () => void;
}

export function HomeScreen({ save, mode, timed, onMode, onTimed, onStart }: Props) {
  const hist = save.stats[mode];
  const s = timed ? save.crono[mode] : save.stats[mode];
  const bestTime = timed ? save.crono[mode].bestTimeMs : null;
  const total = BANK[mode].length;
  const seen = BANK[mode].reduce((n, q) => n + (hist.seen[q.id] ? 1 : 0), 0);
  const seenPct = Math.round((seen / total) * 100);
  const info = MODE_INFO[mode];

  return (
    <div className="screen-inner home">
      <header className="home-top reveal" style={{ ['--d' as string]: '0ms' }}>
        <span className="eyebrow">Desafío de lógica</span>
        <span className="eyebrow home-count tnum">{RUN_LENGTH} preguntas</span>
      </header>

      <section className="home-hero">
        <Logo size={128} />
        <p className="home-tagline reveal" style={{ ['--d' as string]: '520ms' }}>
          20 preguntas. Un solo fallo.
          <br />
          <span>Solo el 1 % llega al final.</span>
        </p>
      </section>

      <section className="home-controls">
        <div className="reveal" style={{ ['--d' as string]: '600ms' }}>
          <div className="gtype" role="radiogroup" aria-label="Tipo de partida">
            <span className="gtype-indicator" style={{ transform: `translateX(${timed ? 100 : 0}%)` }} aria-hidden="true" />
            <button type="button" role="radio" aria-checked={!timed} className={`gtype-opt${!timed ? ' is-active' : ''}`} onClick={() => onTimed(false)}>
              <IconInfinity className="gtype-icon" />
              Clásico
            </button>
            <button type="button" role="radio" aria-checked={timed} className={`gtype-opt${timed ? ' is-active' : ''}`} onClick={() => onTimed(true)}>
              <IconClock className="gtype-icon" />
              Contrarreloj
            </button>
          </div>
        </div>

        <div className="reveal" style={{ ['--d' as string]: '660ms' }}>
          <div className="section-label">
            <span className="eyebrow">Dificultad</span>
          </div>
          <DifficultySelector value={mode} onChange={onMode} />
          <p className="mode-tagline swap" key={`t-${mode}-${timed}`}>
            {timed ? 'Cada pregunta tiene su tiempo. Si se agota, pierdes.' : info.tagline}
          </p>
        </div>

        <div className="reveal" style={{ ['--d' as string]: '740ms' }}>
          <div className="stats swap" key={`s-${mode}-${timed}`}>
            <div className="stat-record">
              <span className="eyebrow">
                Récord · {info.label}
                {timed ? ' · Contrarreloj' : ''}
              </span>
              <div className="record-value display tnum">
                <span className={s.best === RUN_LENGTH ? 'is-max' : ''}>{String(s.best).padStart(2, '0')}</span>
                <span className="record-of">/{RUN_LENGTH}</span>
              </div>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-value display tnum">{s.played}</span>
                <span className="stat-label">Partidas</span>
              </div>
              <div className="stat">
                <span className="stat-value display tnum">{s.completed}</span>
                <span className="stat-label">Completadas</span>
              </div>
              <div className="stat">
                <span className="stat-value display tnum">
                  {winRate(s)}
                  <small>%</small>
                </span>
                <span className="stat-label">Victorias</span>
              </div>
            </div>
            <div className="stat-progress">
              <div className="stat-progress-row">
                {timed ? (
                  <span>
                    Mejor tiempo <b className="tnum">{bestTime ? formatMs(bestTime) : '—'}</b>
                  </span>
                ) : (
                  <span>
                    Mejor pregunta <b className="tnum">{s.bestReached ? `${s.bestReached}/${RUN_LENGTH}` : '—'}</b>
                  </span>
                )}
                <span className="tnum">
                  Vistas <b>{seen}</b>/{total}
                </span>
              </div>
              <div className="seen-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${seenPct / 100})` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-cta reveal" style={{ ['--d' as string]: '840ms' }}>
        <button type="button" className="btn btn-primary btn-xl" onClick={onStart}>
          <span>{timed ? 'Empezar contrarreloj' : 'Empezar'}</span>
          <IconArrow className="btn-icon" />
        </button>
      </div>
    </div>
  );
}
