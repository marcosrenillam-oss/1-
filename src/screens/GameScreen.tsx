import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getQuestion } from '../data/questions';
import { CATEGORY_LABEL, type Question } from '../data/types';
import { MODE_INFO, RUN_LENGTH, TIER_LABEL } from '../engine/difficulty';
import type { AnswerOutcome, RunResult } from '../engine/game';
import type { ActiveRun } from '../storage/persistence';
import { glyphCount, hasGlyph, RichText } from '../components/Glyph';
import { IconArrow, IconCheck, IconClock, IconClose, IconCross } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { VisualBlock } from '../components/VisualBlock';
import { motionMs } from '../motion';

interface Props {
  run: ActiveRun;
  onSubmit: (displayPos: number) => AnswerOutcome;
  onFinish: (result: RunResult) => void;
  onAbandon: () => void;
  /** Contrarreloj: start the clock of the question on screen. */
  onStartTimer: () => void;
  /** Contrarreloj: the clock ran out. */
  onTimeout: () => RunResult | null;
}

/** Remaining ms until `deadline`, refreshed ~10 times per second while active. */
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

interface Shown {
  q: Question;
  order: number[];
  /** 0-based index in the run */
  index: number;
}

type Phase = 'answering' | 'correct' | 'wrong' | 'leaving';

const LETTERS = ['A', 'B', 'C', 'D'];

function fromRun(run: ActiveRun): Shown {
  return { q: getQuestion(run.ids[run.index])!, order: run.orders[run.index], index: run.index };
}

function promptSize(text: string): string {
  if (text.length > 260) return 'prompt--xs';
  if (text.length > 170) return 'prompt--sm';
  if (text.length > 90) return 'prompt--md';
  return 'prompt--lg';
}

function optionKind(text: string): string {
  if (!hasGlyph(text)) return text.length > 60 ? 'opt--long' : '';
  if (text.includes('{g-')) return 'opt--grid';
  return glyphCount(text) > 3 ? 'opt--glyphs-many' : 'opt--glyphs';
}

export function GameScreen({ run, onSubmit, onFinish, onAbandon, onStartTimer, onTimeout }: Props) {
  const [shown, setShown] = useState<Shown>(() => fromRun(run));
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [victory, setVictory] = useState<RunResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const latestRun = useRef(run);
  latestRun.current = run;
  const timers = useRef<number[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const { q, order, index } = shown;
  const number = index + 1;
  const done = index + (phase === 'correct' || phase === 'leaving' ? 1 : 0);

  // Guards against double taps submitting twice before React re-renders.
  const locked = useRef(false);
  // "Siguiente" appears where "Confirmar" was: ignore the 2nd tap of a double tap.
  const answeredAt = useRef(0);

  const confirm = useCallback(() => {
    if (selected === null || phase !== 'answering' || locked.current) return;
    locked.current = true;
    const out = onSubmit(selected);
    if (out.kind === 'wrong') {
      if (out.result.timeout) setTimedOut(true);
      setPhase('wrong');
      setFlash('bad');
      later(() => onFinish(out.result), motionMs(1500, 900));
      return;
    }
    if (out.kind === 'victory') setVictory(out.result);
    answeredAt.current = performance.now();
    setPhase('correct');
    setFlash('good');
    later(() => setFlash(null), 900);
    // Bring the explanation into view on small screens.
    later(() => scroller.current?.closest('.screen')?.scrollTo({ top: 99999, behavior: 'smooth' }), 260);
  }, [selected, phase, onSubmit, onFinish]);

  const next = useCallback(() => {
    if (phase !== 'correct' || !locked.current) return;
    if (performance.now() - answeredAt.current < 320) return;
    locked.current = false; // only one "next" per answer
    if (victory) {
      onFinish(victory);
      return;
    }
    setPhase('leaving');
    later(() => {
      const r = latestRun.current;
      setShown(fromRun(r));
      setSelected(null);
      setPhase('answering');
      setFlash(null);
      scroller.current?.closest('.screen')?.scrollTo({ top: 0 });
    }, motionMs(260, 0));
  }, [phase, victory, onFinish]);

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
    setTimedOut(true);
    setPhase('wrong');
    setFlash('bad');
    later(() => onFinish(result), motionMs(1700, 1000));
  }, [timed, phase, remaining, onTimeout, onFinish]);
  const limitMs = timer ? timer.deadline - timer.startedAt : 1;
  const secs = remaining === null ? null : Math.ceil(remaining / 1000);

  const correctPos = order.indexOf(q.answer);
  const info = MODE_INFO[run.mode];
  const tier = TIER_LABEL[q.tier];

  return (
    <div className={`screen-inner game${phase === 'wrong' ? ' game--impact' : ''}`} ref={scroller}>
      {flash && createPortal(<div className={`flash flash--${flash}`} key={`${flash}-${index}`} aria-hidden="true" />, document.body)}

      <header className="game-top">
        <button type="button" className="icon-btn" aria-label="Abandonar partida" onClick={() => setConfirmExit(true)} disabled={phase !== 'answering'}>
          <IconClose />
        </button>
        <span className={`game-mode${timed ? ' game-mode--timed' : ''}`}>
          {timed && <IconClock className="game-mode-icon" />}
          {info.label}
        </span>
      </header>

      <div className="game-counter">
        <div className="counter display tnum" aria-label={`Pregunta ${number} de ${RUN_LENGTH}`}>
          <span className="counter-now" key={number}>
            {String(number).padStart(2, '0')}
          </span>
          <span className="counter-of">/{RUN_LENGTH}</span>
        </div>
        <span className={`tier-label${q.tier >= 5 ? ' tier-label--hot' : ''}`} key={`tier-${q.tier}`}>
          {tier}
        </span>
      </div>

      <ProgressBar done={done} current={index} failed={phase === 'wrong'} />

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

      <main className={`qwrap${phase === 'leaving' ? ' q-exit' : ' q-enter'}`} key={q.id}>
        <span className="q-cat">{CATEGORY_LABEL[q.category]}</span>
        <h1 className={`prompt display ${promptSize(q.prompt)}`}>
          <RichText text={q.prompt} />
        </h1>
        {q.visual && (
          <div className="q-visual">
            <VisualBlock rows={q.visual} />
          </div>
        )}

        <div className="options" role="radiogroup" aria-label="Respuestas">
          {order.map((authored, pos) => {
            const text = q.options[authored];
            const isSel = selected === pos;
            let state = '';
            if (phase === 'correct' || (phase === 'leaving' && !victory)) {
              if (pos === correctPos) state = 'is-correct';
              else state = 'is-dim';
            } else if (phase === 'wrong') {
              if (isSel) state = 'is-wrong';
              else if (pos === correctPos) state = 'is-answer';
              else state = 'is-dim';
            } else if (isSel) state = 'is-selected';
            return (
              <span className="opt-slot" key={pos} style={{ ['--i' as string]: pos }}>
              <button
                type="button"
                role="radio"
                aria-checked={isSel}
                className={`opt ${optionKind(text)} ${state}`}
                disabled={phase !== 'answering'}
                onClick={() => setSelected(pos)}
              >
                <span className="opt-letter display">
                  {state === 'is-correct' || state === 'is-answer' ? (
                    <IconCheck className="opt-icon" />
                  ) : state === 'is-wrong' ? (
                    <IconCross className="opt-icon" />
                  ) : (
                    LETTERS[pos]
                  )}
                </span>
                <span className="opt-text">
                  <RichText text={text} />
                </span>
              </button>
              </span>
            );
          })}
        </div>
      </main>

      <div className="game-actions">
        {phase === 'answering' && (
          <button type="button" className="btn btn-primary btn-lg btn-confirm" disabled={selected === null} onClick={confirm}>
            Confirmar
          </button>
        )}
        {(phase === 'correct' || (phase === 'leaving' && !victory)) && (
          <div className={`feedback feedback--good${phase === 'leaving' ? ' is-leaving' : ''}`} role="status">
            <div className="feedback-head">
              <span className="feedback-badge">
                <IconCheck />
              </span>
              <span className="feedback-title display">{victory ? '¡20 de 20!' : 'Correcto'}</span>
              <span className="feedback-streak display tnum">+1</span>
            </div>
            <p className="feedback-text">{q.explanation}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={next} autoFocus>
              <span>{victory ? 'Ver resultado' : 'Siguiente'}</span>
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
              <span className="feedback-title display">{timedOut ? 'Se acabó el tiempo' : 'Incorrecto'}</span>
            </div>
          </div>
        )}
      </div>

      {confirmExit && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exit-title" onClick={() => setConfirmExit(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 id="exit-title" className="display">¿Abandonar la partida?</h2>
            <p>
              Contará como partida perdida con <b className="tnum">{index}</b> {index === 1 ? 'acierto' : 'aciertos'}.
            </p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setConfirmExit(false)} autoFocus>
              Seguir jugando
            </button>
            <button type="button" className="btn btn-ghost btn-lg btn-danger" onClick={onAbandon}>
              Abandonar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
