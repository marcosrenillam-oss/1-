import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { getQuestion } from '../data/questions';
import { CATEGORY_LABEL, type Question } from '../data/types';
import { MAX_RUN, MODE_INFO, STAGE_LEN, STAGE_THEME, STAGES, TIER_LABEL, WORLD_LEVELS, WORLDS } from '../engine/difficulty';
import { answerText, type AnswerOutcome, type Response, type RunResult } from '../engine/game';
import type { ActiveRun } from '../storage/persistence';
import { AnswerArea, answerHint } from '../components/Answers';
import { RichText } from '../components/Glyph';
import { IconArrow, IconCheck, IconClock, IconClose, IconCross } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { VisualBlock } from '../components/VisualBlock';
import { haptic } from '../haptics';
import { motionMs } from '../motion';

interface Props {
  run: ActiveRun;
  onSubmit: (r: Response) => AnswerOutcome;
  onFinish: (result: RunResult) => void;
  onAbandon: () => void;
  /** Contrarreloj: start the clock of the question on screen. */
  onStartTimer: () => void;
  /** Contrarreloj: the clock ran out. */
  onTimeout: () => RunResult | null;
}

interface Shown {
  q: Question;
  order: number[];
  index: number;
}

type Phase = 'answering' | 'correct' | 'wrong' | 'leaving';

const fromRun = (run: ActiveRun): Shown => ({ q: getQuestion(run.ids[run.index])!, order: run.orders[run.index], index: run.index });

function promptSize(text: string): string {
  if (text.length > 260) return 'prompt--xs';
  if (text.length > 170) return 'prompt--sm';
  if (text.length > 90) return 'prompt--md';
  return 'prompt--lg';
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** CSS variables that recolour the whole question screen. */
export function themeVars(stage: number): CSSProperties {
  const t = STAGE_THEME[Math.max(0, Math.min(STAGE_THEME.length - 1, stage))];
  return { ['--lime' as string]: t.accent, ['--lime-ink' as string]: t.ink, ['--lime-dim' as string]: rgba(t.accent, 0.12), ['--lime-glow' as string]: rgba(t.accent, 0.42) };
}

function useRemaining(deadline: number | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || deadline === undefined) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [active, deadline]);
  return deadline === undefined ? null : Math.max(0, deadline - now);
}

export function GameScreen({ run, onSubmit, onFinish, onAbandon, onStartTimer, onTimeout }: Props) {
  const [shown, setShown] = useState<Shown>(() => fromRun(run));
  const [response, setResponse] = useState<Response | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [final, setFinal] = useState<RunResult | null>(null);
  const [pendingStage, setPendingStage] = useState<number | null>(null);
  const [stageOverlay, setStageOverlay] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const latestRun = useRef(run);
  latestRun.current = run;
  const timers = useRef<number[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const answeredAt = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const adventure = run.type === 'adventure';
  const { q, order, index } = shown;
  const stage = adventure ? run.world ?? 0 : Math.floor(index / STAGE_LEN);
  const vars = themeVars(stage);

  const confirm = useCallback(() => {
    if (response === null || phase !== 'answering' || locked.current) return;
    locked.current = true;
    const out = onSubmit(response);
    if (out.kind === 'wrong') {
      haptic('error');
      if (out.result.timeout) setTimedOut(true);
      setPhase('wrong');
      setFlash('bad');
      if (adventure) {
        setFinal(out.result);
        answeredAt.current = performance.now();
        later(() => scroller.current?.closest('.screen')?.scrollTo({ top: 99999, behavior: 'smooth' }), 300);
      } else later(() => onFinish(out.result), motionMs(1600, 900));
      return;
    }
    haptic(out.kind === 'correct' && out.stageCleared ? 'heavy' : 'success');
    if (out.kind === 'victory') setFinal(out.result);
    if (out.kind === 'correct' && out.stageCleared) setPendingStage(out.stageCleared);
    answeredAt.current = performance.now();
    setPhase('correct');
    setFlash('good');
    later(() => setFlash(null), 900);
    later(() => scroller.current?.closest('.screen')?.scrollTo({ top: 99999, behavior: 'smooth' }), 260);
  }, [response, phase, onSubmit, onFinish, adventure]);

  const advance = useCallback(() => {
    setPhase('leaving');
    later(() => {
      setShown(fromRun(latestRun.current));
      setResponse(null);
      setPhase('answering');
      setFlash(null);
      locked.current = false;
      scroller.current?.closest('.screen')?.scrollTo({ top: 0 });
    }, motionMs(260, 0));
  }, []);

  const next = useCallback(() => {
    if (phase === 'answering' || phase === 'leaving') return;
    if (performance.now() - answeredAt.current < 320) return;
    if (final) {
      onFinish(final);
      return;
    }
    if (phase !== 'correct') return;
    if (pendingStage) {
      haptic('heavy');
      setStageOverlay(pendingStage);
      setPendingStage(null);
      return;
    }
    advance();
  }, [phase, final, pendingStage, onFinish, advance]);

  const closeStage = () => {
    setStageOverlay(null);
    advance();
  };

  // ── Contrarreloj ────────────────────────────────────────────────────
  const timed = !!run.timed;
  const timer = run.timer && run.timer.index === index ? run.timer : undefined;
  const remaining = useRemaining(timer?.deadline, timed && phase === 'answering');
  useEffect(() => {
    if (timed && phase === 'answering') onStartTimer();
  }, [timed, phase, index, onStartTimer]);
  useEffect(() => {
    if (!timed || phase !== 'answering' || remaining === null || remaining > 0 || locked.current) return;
    locked.current = true;
    const result = onTimeout();
    if (!result) return;
    haptic('error');
    setTimedOut(true);
    setPhase('wrong');
    setFlash('bad');
    later(() => onFinish(result), motionMs(1700, 1000));
  }, [timed, phase, remaining, onTimeout, onFinish]);
  const limitMs = timer ? Math.max(1, timer.deadline - timer.startedAt) : 1;
  const secs = remaining === null ? null : Math.ceil(remaining / 1000);

  const kind = q.kind ?? 'choice';
  const hint = answerHint(q);
  const inStage = index % STAGE_LEN;
  const done = inStage + (phase === 'correct' || phase === 'leaving' ? 1 : 0);
  const percent = adventure ? WORLD_LEVELS + 1 - (run.level ?? 1) : 0;
  const lastOfRun = !adventure && index === MAX_RUN - 1;

  let goodTitle = 'Correcto';
  if (adventure) goodTitle = run.boss ? '¡Jefe derrotado!' : '¡Nivel superado!';
  else if (pendingStage) goodTitle = pendingStage === 1 ? '¡Victoria! Fase 1 superada' : `¡Fase ${pendingStage} superada!`;
  else if (lastOfRun && final) goodTitle = '¡100 de 100!';
  const goodButton = adventure ? 'Continuar' : final ? 'Ver resultado' : pendingStage ? 'Siguiente fase' : 'Siguiente';

  return (
    <div className={`screen-inner game${phase === 'wrong' ? ' game--impact' : ''}${run.boss ? ' game--boss' : ''}`} ref={scroller} style={vars} data-stage={stage}>
      {flash && createPortal(<div className={`flash flash--${flash}`} style={vars} key={`${flash}-${index}`} aria-hidden="true" />, document.body)}

      <header className="game-top">
        <button
          type="button"
          className="icon-btn"
          aria-label={adventure ? 'Salir al mapa' : 'Abandonar partida'}
          onClick={() => (adventure ? onAbandon() : setConfirmExit(true))}
          disabled={phase !== 'answering'}
        >
          <IconClose />
        </button>
        <span className={`game-mode${timed ? ' game-mode--timed' : ''}`}>
          {timed && <IconClock className="game-mode-icon" />}
          {adventure ? `Mundo ${(run.world ?? 0) + 1} · ${WORLDS[run.world ?? 0].name}` : MODE_INFO[run.mode].label}
        </span>
      </header>

      <div className="game-counter">
        {adventure ? (
          <div className="counter display tnum" aria-label={run.boss ? 'Jefe final' : `Nivel ${percent} %`}>
            <span className="counter-now" key={run.level}>{run.boss ? 'Jefe' : percent}</span>
            {!run.boss && <span className="counter-of">%</span>}
          </div>
        ) : (
          <div className="counter display tnum" aria-label={`Pregunta ${index + 1} de ${MAX_RUN}`}>
            <span className="counter-now" key={index}>{String(index + 1).padStart(2, '0')}</span>
            <span className="counter-of">/{MAX_RUN}</span>
          </div>
        )}
        <span className={`tier-label${q.tier >= 5 || run.boss ? ' tier-label--hot' : ''}`} key={`tier-${q.tier}-${stage}`}>
          {adventure ? (run.boss ? 'Desafío final' : `Nivel ${run.level}/${WORLD_LEVELS}`) : `Fase ${stage + 1} · ${TIER_LABEL[q.tier]}`}
        </span>
      </div>

      {adventure ? (
        <div className="world-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${run.boss ? 1 : ((run.level ?? 1) - 1) / WORLD_LEVELS})` }} />
        </div>
      ) : (
        <>
          <div className="phase-pips" aria-label={`Fase ${stage + 1} de ${STAGES}`}>
            {STAGE_THEME.map((t, i) => (
              <span key={i} className={`pip${i < stage ? ' is-done' : i === stage ? ' is-current' : ''}`} style={{ ['--pip' as string]: t.accent }} />
            ))}
          </div>
          <ProgressBar done={done} current={inStage} failed={phase === 'wrong'} />
        </>
      )}

      {timed && (
        <div
          className={`clock${secs !== null && remaining! <= limitMs * 0.25 ? ' clock--low' : ''}${secs !== null && secs <= 5 && phase === 'answering' ? ' clock--urgent' : ''}`}
          role="timer"
          aria-label={secs === null ? 'Tiempo' : `Quedan ${secs} segundos`}
        >
          <IconClock className="clock-icon" />
          <span className="clock-num display tnum">{secs === null ? '—' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</span>
          <span className="clock-bar">
            <span className="clock-fill" style={{ transform: `scaleX(${remaining === null ? 1 : remaining / limitMs})` }} />
          </span>
        </div>
      )}

      <main className={`qwrap${phase === 'leaving' ? ' q-exit' : ' q-enter'}`} key={`${q.id}-${index}`}>
        <span className="q-cat">{run.boss ? 'Jefe final' : CATEGORY_LABEL[q.category]}</span>
        <h1 className={`prompt display ${promptSize(q.prompt)}`}>
          <RichText text={q.prompt} />
        </h1>
        {q.visual && kind !== 'tap' && (
          <div className="q-visual">
            <VisualBlock rows={q.visual} />
          </div>
        )}
        {hint && phase === 'answering' && <p className="q-hint">{hint}</p>}
        <AnswerArea q={q} order={order} phase={phase} value={response} onChange={setResponse} />
      </main>

      <div className="game-actions">
        {phase === 'answering' && (
          <button type="button" className="btn btn-primary btn-lg btn-confirm" disabled={response === null} onClick={confirm}>
            Confirmar
          </button>
        )}
        {(phase === 'correct' || (phase === 'leaving' && !final)) && (
          <div className={`feedback feedback--good${phase === 'leaving' ? ' is-leaving' : ''}`} role="status">
            <div className="feedback-head">
              <span className="feedback-badge">
                <IconCheck />
              </span>
              <span className="feedback-title display">{goodTitle}</span>
              {!adventure && <span className="feedback-streak display tnum">+1</span>}
            </div>
            <p className="feedback-text">{q.explanation}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={next} autoFocus>
              <span>{goodButton}</span>
              <IconArrow className="btn-icon" />
            </button>
          </div>
        )}
        {phase === 'wrong' && (
          <div className="feedback feedback--bad" role="alert">
            <div className="feedback-head">
              <span className="feedback-badge">
                <IconCross />
              </span>
              <span className="feedback-title display">{timedOut ? 'Se acabó el tiempo' : adventure ? 'Casi… inténtalo otra vez' : 'Incorrecto'}</span>
            </div>
            {adventure && (
              <>
                {kind === 'choice' && (
                  <p className="feedback-answer">
                    Respuesta: <b><RichText text={answerText(q)} /></b>
                  </p>
                )}
                <p className="feedback-text">{q.explanation}</p>
                <button type="button" className="btn btn-ghost btn-lg" onClick={next} autoFocus>
                  Volver al mapa
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {stageOverlay !== null &&
        createPortal(
          <div className="stage-clear" style={themeVars(stageOverlay)} role="dialog" aria-modal="true" aria-labelledby="stage-title">
            <div className="stage-clear-sweep" aria-hidden="true" />
            <div className="stage-clear-body">
              <span className="eyebrow stage-clear-eyebrow">Fase {stageOverlay + 1} de {STAGES} · {STAGE_THEME[stageOverlay].name}</span>
              <p id="stage-title" className="stage-clear-num display tnum">
                {stageOverlay * STAGE_LEN}
                <small>/{MAX_RUN}</small>
              </p>
              <p className="stage-clear-title display">{stageOverlay === 1 ? '¡Victoria!' : `¡${stageOverlay * STAGE_LEN} seguidas!`}</p>
              <p className="stage-clear-sub">
                {stageOverlay === 1
                  ? 'Ya has superado el desafío. Ahora sigue hasta 100: la dificultad sube muchísimo a partir de aquí.'
                  : 'La dificultad sube muchísimo a partir de aquí. Nuevo color, nueva fase.'}
              </p>
              <button type="button" className="btn btn-primary btn-xl" onClick={closeStage} autoFocus>
                <span>Continuar</span>
                <IconArrow className="btn-icon" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      {confirmExit &&
        createPortal(
          <div className="modal" style={vars} role="dialog" aria-modal="true" aria-labelledby="exit-title" onClick={() => setConfirmExit(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h2 id="exit-title" className="display">¿Terminar la partida?</h2>
              <p>
                Se guardará con <b className="tnum">{index}</b> {index === 1 ? 'acierto' : 'aciertos'}
                {index >= STAGE_LEN ? ' (ya cuenta como victoria).' : '.'}
              </p>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setConfirmExit(false)} autoFocus>
                Seguir jugando
              </button>
              <button type="button" className="btn btn-ghost btn-lg btn-danger" onClick={onAbandon}>
                Terminar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
