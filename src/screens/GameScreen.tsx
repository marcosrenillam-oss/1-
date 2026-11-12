import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getQuestion } from '../data/questions';
import { CATEGORY_LABEL, type Question } from '../data/types';
import { MODE_INFO, RUN_LENGTH, TIER_LABEL } from '../engine/difficulty';
import type { AnswerOutcome, RunResult } from '../engine/game';
import type { ActiveRun } from '../storage/persistence';
import { glyphCount, hasGlyph, RichText } from '../components/Glyph';
import { IconArrow, IconCheck, IconClose, IconCross } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { VisualBlock } from '../components/VisualBlock';
import { motionMs } from '../motion';

interface Props {
  run: ActiveRun;
  onSubmit: (displayPos: number) => AnswerOutcome;
  onFinish: (result: RunResult) => void;
  onAbandon: () => void;
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

export function GameScreen({ run, onSubmit, onFinish, onAbandon }: Props) {
  const [shown, setShown] = useState<Shown>(() => fromRun(run));
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [victory, setVictory] = useState<RunResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
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
        <span className="game-mode">{info.label}</span>
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
              <span className="feedback-title display">Incorrecto</span>
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
