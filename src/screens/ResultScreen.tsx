import { getQuestion } from '../data/questions';
import { MAX_RUN, MODE_INFO, STAGE_LEN, STAGE_THEME } from '../engine/difficulty';
import { answerText, winRate, type RunResult } from '../engine/game';
import { RichText } from '../components/Glyph';
import { IconCheck, IconCross, IconRetry } from '../components/Icons';
import { VisualBlock } from '../components/VisualBlock';

interface Props {
  result: RunResult;
  onRetry: () => void;
  onHome: () => void;
}

export function ResultScreen({ result, onRetry, onHome }: Props) {
  const q = result.questionId ? getQuestion(result.questionId) : undefined;
  const info = MODE_INFO[result.mode];
  const s = result.stats;
  const stage = Math.min(4, Math.floor(result.score / STAGE_LEN));
  const accent = STAGE_THEME[stage].accent;
  const kind = q?.kind ?? 'choice';
  const chosen = kind === 'choice' && typeof result.response === 'number' && result.order ? q!.options[result.order[result.response]] : undefined;

  return (
    <div className="screen-inner result">
      <header className="result-head">
        <span className={`eyebrow result-eyebrow${result.won ? ' is-win' : ''} reveal`} style={{ ['--d' as string]: '0ms', ...(result.won ? { color: accent } : {}) }}>
          {result.won ? `¡Victoria! ${result.stages} ${result.stages === 1 ? 'fase superada' : 'fases superadas'}` : result.abandoned ? 'Partida terminada' : result.timeout ? 'Se acabó el tiempo' : 'Fin de la partida'}
        </span>
        <div className="result-score display tnum reveal" style={{ ['--d' as string]: '80ms' }}>
          <span className="result-num" style={result.won ? { color: accent } : undefined}>{String(result.score).padStart(2, '0')}</span>
          <span className="result-of">/{MAX_RUN}</span>
        </div>
        <div className="stage-track stage-track--result reveal" style={{ ['--d' as string]: '140ms' }} aria-hidden="true">
          {STAGE_THEME.map((t, i) => (
            <span key={i} className={`stage-seg${i < result.stages ? ' is-done' : ''}`} style={{ ['--seg' as string]: t.accent }} />
          ))}
        </div>
        <p className="result-sub reveal" style={{ ['--d' as string]: '180ms' }}>
          {result.score === 1 ? 'acierto' : 'aciertos'} · {info.label}
          {result.timed ? ' · Contrarreloj' : ''}
          {!result.abandoned && <> · Caíste en la {result.reached}</>}
        </p>
        {(result.newRecord || result.newBestTime) && (
          <span className="badge badge--lime reveal" style={{ ['--d' as string]: '260ms' }}>
            {result.newRecord ? 'Nuevo récord' : 'Nuevo mejor tiempo'}
          </span>
        )}
      </header>

      {q && !result.abandoned && (
        <section className="review reveal" style={{ ['--d' as string]: '300ms' }}>
          <span className="eyebrow">Pregunta {result.reached}</span>
          <p className="review-prompt display">
            <RichText text={q.prompt} />
          </p>
          {q.visual && kind !== 'tap' && (
            <div className="q-visual q-visual--compact">
              <VisualBlock rows={q.visual} />
            </div>
          )}
          <div className="review-answer review-answer--bad">
            <IconCross className="review-icon" />
            <div>
              <span className="review-label">{chosen ? 'Tu respuesta' : result.timeout ? 'Sin respuesta' : 'Tu respuesta'}</span>
              <span className="review-value">{chosen ? <RichText text={chosen} /> : result.timeout ? 'El tiempo se agotó' : 'No era correcta'}</span>
            </div>
          </div>
          <div className="review-answer review-answer--good">
            <IconCheck className="review-icon" />
            <div>
              <span className="review-label">Respuesta correcta</span>
              <span className="review-value">
                <RichText text={answerText(q)} />
              </span>
            </div>
          </div>
          <p className="review-expl">{q.explanation}</p>
        </section>
      )}

      {s && (
        <section className="mini-stats reveal" style={{ ['--d' as string]: '380ms' }}>
          <div>
            <span className="stat-value display tnum">
              {s.best}
              <small>/{MAX_RUN}</small>
            </span>
            <span className="stat-label">Récord</span>
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
      )}

      <div className="result-actions reveal" style={{ ['--d' as string]: '460ms' }}>
        <button type="button" className="btn btn-primary btn-xl" onClick={onRetry} autoFocus>
          <IconRetry className="btn-icon" />
          <span>Volver a empezar</span>
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={onHome}>
          Inicio
        </button>
      </div>
    </div>
  );
}
