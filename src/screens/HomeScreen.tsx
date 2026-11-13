import { TOTAL_QUESTIONS } from '../data/questions';
import { MAX_RUN, MODE_INFO, MODES, STAGE_THEME, WORLD_LEVELS, WORLDS, type GameMode } from '../engine/difficulty';
import { adventureProgress, formatMs, winRate } from '../engine/game';
import type { Play, SaveData } from '../storage/persistence';
import { IconArrow, IconClock, IconInfinity, IconMap } from '../components/Icons';
import { LevelBars } from '../components/LevelBars';
import { Logo } from '../components/Logo';

interface Props {
  save: SaveData;
  mode: GameMode;
  play: Play;
  onMode: (m: GameMode) => void;
  onPlay: (p: Play) => void;
  onStart: () => void;
}

const PLAYS: { id: Play; label: string; Icon: typeof IconClock }[] = [
  { id: 'classic', label: 'Clásico', Icon: IconInfinity },
  { id: 'crono', label: 'Contrarreloj', Icon: IconClock },
  { id: 'adventure', label: 'Aventura', Icon: IconMap },
];

export function HomeScreen({ save, mode, play, onMode, onPlay, onStart }: Props) {
  const adventure = play === 'adventure';
  const s = save.records[mode][play === 'crono' ? 'crono' : 'classic'];
  const seen = Object.keys(save.history.seen).length;
  const a = save.adventure;
  const pIdx = PLAYS.findIndex((p) => p.id === play);
  const mIdx = MODES.indexOf(mode);

  return (
    <div className="screen-inner home">
      <header className="home-top reveal" style={{ ['--d' as string]: '0ms' }}>
        <span className="eyebrow">Desafío de lógica</span>
        <span className="eyebrow home-count tnum">{TOTAL_QUESTIONS.toLocaleString('es-ES')} preguntas</span>
      </header>

      <section className="home-hero">
        <Logo size={120} />
        <p className="home-tagline reveal" style={{ ['--d' as string]: '520ms' }}>
          Un solo fallo y se acabó.
          <br />
          <span>Solo el 1 % llega al final.</span>
        </p>
      </section>

      <section className="home-controls">
        <div className="reveal" style={{ ['--d' as string]: '600ms' }}>
          <div className="gtype gtype--3" role="radiogroup" aria-label="Tipo de partida">
            <span className="gtype-indicator" style={{ transform: `translateX(${pIdx * 100}%)` }} aria-hidden="true" />
            {PLAYS.map(({ id, label, Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={play === id} className={`gtype-opt${play === id ? ' is-active' : ''}`} onClick={() => onPlay(id)}>
                <Icon className="gtype-icon" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="reveal home-play" style={{ ['--d' as string]: '660ms' }}>
        {!adventure ? (
          <>
            <div>
              <div className="diff diff--2" role="radiogroup" aria-label="Dificultad">
                <span className="diff-indicator" style={{ transform: `translateX(${mIdx * 100}%)` }} aria-hidden="true" />
                {MODES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={m === mode} className={`diff-opt${m === mode ? ' is-active' : ''}`} onClick={() => onMode(m)}>
                    <LevelBars level={MODE_INFO[m].level} />
                    <span className="diff-label">{MODE_INFO[m].label}</span>
                  </button>
                ))}
              </div>
              <p className="mode-tagline swap" key={`t-${mode}-${play}`}>
                {play === 'crono' ? 'Cada pregunta tiene su tiempo. Si se agota, pierdes.' : MODE_INFO[mode].tagline} 20 = victoria · hasta 100.
              </p>
            </div>

            <div>
              <div className="stats swap" key={`s-${mode}-${play}`}>
                <div className="stat-record">
                  <span className="eyebrow">
                    Récord · {MODE_INFO[mode].label}
                    {play === 'crono' ? ' · Contrarreloj' : ''}
                  </span>
                  <div className="record-value display tnum">
                    <span className={s.best >= 20 ? 'is-max' : ''} style={s.best >= 20 ? { color: STAGE_THEME[Math.min(4, Math.floor(s.best / 20) - (s.best === MAX_RUN ? 1 : 0))].accent } : undefined}>
                      {String(s.best).padStart(2, '0')}
                    </span>
                    <span className="record-of">/{MAX_RUN}</span>
                  </div>
                </div>
                <div className="stage-track" aria-label={`Fases superadas en tu récord: ${s.bestStage} de 5`}>
                  {STAGE_THEME.map((t, i) => (
                    <span key={i} className={`stage-seg${i < s.bestStage ? ' is-done' : ''}`} style={{ ['--seg' as string]: t.accent }} />
                  ))}
                </div>
                <div className="stat-grid">
                  <div className="stat">
                    <span className="stat-value display tnum">{s.played}</span>
                    <span className="stat-label">Partidas</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value display tnum">{s.completed}</span>
                    <span className="stat-label">Victorias (20+)</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value display tnum">
                      {winRate(s)}
                      <small>%</small>
                    </span>
                    <span className="stat-label">Ratio</span>
                  </div>
                </div>
                <div className="stat-progress-row">
                  {play === 'crono' ? (
                    <span>
                      Mejor tiempo hasta 20 <b className="tnum">{s.bestTimeMs ? formatMs(s.bestTimeMs) : '—'}</b>
                    </span>
                  ) : (
                    <span>
                      Fases superadas <b className="tnum">{s.bestStage}/5</b>
                    </span>
                  )}
                  <span className="tnum">
                    Vistas <b>{seen.toLocaleString('es-ES')}</b>
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="adv-card swap" style={{ ['--w' as string]: STAGE_THEME[a.world].accent }}>
              <div className="adv-card-top">
                <span className="eyebrow">{a.finished ? 'Aventura completada' : `Mundo ${a.world + 1} de ${WORLDS.length}`}</span>
                <span className="adv-total display tnum">{adventureProgress(save)}%</span>
              </div>
              <p className="adv-name display">{a.finished ? 'Eres del 1 %' : WORLDS[a.world].name}</p>
              <p className="adv-tag">{a.finished ? 'Has superado los cinco mundos y sus jefes.' : WORLDS[a.world].tagline}</p>
              <div className="adv-worlds" aria-hidden="true">
                {WORLDS.map((_, i) => (
                  <span key={i} className={`adv-w${i < a.world || a.finished ? ' is-done' : i === a.world ? ' is-current' : ''}`} style={{ ['--seg' as string]: STAGE_THEME[i].accent }}>
                    {i === a.world && !a.finished && <span style={{ transform: `scaleX(${(a.level - 1) / (WORLD_LEVELS + 1)})` }} />}
                  </span>
                ))}
              </div>
              <p className="adv-next tnum">
                {a.finished ? '5 jefes derrotados' : a.level > WORLD_LEVELS ? 'Te espera el jefe final del mundo' : `Siguiente nivel: ${WORLD_LEVELS + 1 - a.level} %`}
              </p>
            </div>
          </div>
        )}
        </div>
      </section>

      <div className="home-cta reveal" style={{ ['--d' as string]: '840ms' }}>
        <button type="button" className="btn btn-primary btn-xl" onClick={onStart}>
          <span>{adventure ? (a.answered ? 'Abrir el mapa' : 'Empezar la aventura') : play === 'crono' ? 'Empezar contrarreloj' : 'Empezar'}</span>
          <IconArrow className="btn-icon" />
        </button>
      </div>
    </div>
  );
}
