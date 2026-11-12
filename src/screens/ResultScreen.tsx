import { getQuestion } from '../data/questions';
import { MODE_INFO, RUN_LENGTH } from '../engine/difficulty';
import { winRate, type RunResult } from '../engine/game';
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

  return (
    <div className="screen-inner result">
      <header className="result-head">
        <span className="eyebrow result-eyebrow reveal" style={{ ['--d' as string]: '0ms' }}>
          {result.abandoned ? 'Partida abandonada' : 'Fin de la partida'}
        </span>
        <div className="result-score display tnum reveal" style={{ ['--d' as string]: '80ms' }}>
          <span className="result-num">{String(result.score).padStart(2, '0')}</span>
          <span className="result-of">/{RUN_LENGTH}</span>
        </div>
        <p className="result-sub reveal" style={{ ['--d' as string]: '160ms' }}>
          {result.score === 1 ? 'acierto' : 'aciertos'} · Modo {info.label}
          {!result.abandoned && <> · Caíste en la pregunta {result.reached}</>}
        </p>
        {result.newRecord && (
          <span className="badge badge--lime reveal" style={{ ['--d' as string]: '260ms' }}>
            Nuevo récord
          </span>
        )}
      </header>

      {q && result.chosen !== undefined && (
        <section className="review reveal" style={{ ['--d' as string]: '300ms' }}>
          <span className="eyebrow">Pregunta {result.reached}</span>
          <p className="review-prompt display">
            <RichText text={q.prompt} />
          </p>
          {q.visual && (
            <div className="q-visual q-visual--compact">
              <VisualBlock rows={q.visual} />
            </div>
          )}
          <div className="review-answer review-answer--bad">
            <IconCross className="review-icon" />
            <div>
              <span className="review-label">Tu respuesta</span>
              <span className="review-value">
                <RichText text={q.options[result.chosen]} />
              </span>
            </div>
          </div>
          <div className="review-answer review-answer--good">
            <IconCheck className="review-icon" />
            <div>
              <span className="review-label">Respuesta correcta</span>
              <span className="review-value">
                <RichText text={q.options[q.answer]} />
              </span>
            </div>
          </div>
          <p className="review-expl">{q.explanation}</p>
        </section>
      )}

      <section className="mini-stats reveal" style={{ ['--d' as string]: '380ms' }}>
        <div>
          <span className="stat-value display tnum">
            {s.best}
            <small>/{RUN_LENGTH}</small>
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
