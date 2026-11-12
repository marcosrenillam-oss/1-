import { BANK } from '../data/questions';
import type { Mode } from '../data/types';
import { MODE_INFO, RUN_LENGTH } from '../engine/difficulty';
import { winRate } from '../engine/game';
import type { SaveData } from '../storage/persistence';
import { DifficultySelector } from '../components/DifficultySelector';
import { IconArrow } from '../components/Icons';
import { Logo } from '../components/Logo';

interface Props {
  save: SaveData;
  mode: Mode;
  onMode: (m: Mode) => void;
  onStart: () => void;
}

export function HomeScreen({ save, mode, onMode, onStart }: Props) {
  const s = save.stats[mode];
  const total = BANK[mode].length;
  const seen = Object.keys(s.seen).length;
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
        <div className="reveal" style={{ ['--d' as string]: '640ms' }}>
          <div className="section-label">
            <span className="eyebrow">Dificultad</span>
          </div>
          <DifficultySelector value={mode} onChange={onMode} />
          <p className="mode-tagline swap" key={`t-${mode}`}>
            {info.tagline}
          </p>
        </div>

        <div className="reveal" style={{ ['--d' as string]: '740ms' }}>
        <div className="stats swap" key={`s-${mode}`}>
          <div className="stat-record">
            <span className="eyebrow">Récord · {info.label}</span>
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
              <span>
                Mejor pregunta alcanzada <b className="tnum">{s.bestReached ? `${s.bestReached}/${RUN_LENGTH}` : '—'}</b>
              </span>
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
          <span>Empezar</span>
          <IconArrow className="btn-icon" />
        </button>
      </div>
    </div>
  );
}
