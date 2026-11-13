import { useEffect, useRef, useState } from 'react';
import type { Question } from '../data/types';
import type { Response } from '../engine/game';
import { haptic } from '../haptics';
import { prefersReducedMotion } from '../motion';
import { glyphCount, hasGlyph, RichText } from './Glyph';
import { IconCheck, IconCross } from './Icons';

export type AnswerPhase = 'answering' | 'correct' | 'wrong' | 'leaving';

interface Props {
  q: Question;
  order: number[];
  phase: AnswerPhase;
  /** The response being built / submitted. */
  value: Response | null;
  onChange: (v: Response | null) => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

function optionKind(text: string): string {
  if (!hasGlyph(text)) return text.length > 60 ? 'opt--long' : '';
  if (text.includes('{g-')) return 'opt--grid';
  return glyphCount(text) > 3 ? 'opt--glyphs-many' : 'opt--glyphs';
}

/** Multiple choice (4 options). */
function Choice({ q, order, phase, value, onChange }: Props) {
  const correctPos = order.indexOf(q.answer);
  const reviewed = phase === 'correct' || phase === 'leaving';
  return (
    <div className="options" role="radiogroup" aria-label="Respuestas">
      {order.map((authored, pos) => {
        const text = q.options[authored];
        const isSel = value === pos;
        let state = '';
        if (reviewed) state = pos === correctPos ? 'is-correct' : 'is-dim';
        else if (phase === 'wrong') state = isSel ? 'is-wrong' : pos === correctPos ? 'is-answer' : 'is-dim';
        else if (isSel) state = 'is-selected';
        return (
          <span className="opt-slot" key={pos} style={{ ['--i' as string]: pos }}>
            <button
              type="button"
              role="radio"
              aria-checked={isSel}
              className={`opt ${optionKind(text)} ${state}`}
              disabled={phase !== 'answering'}
              onClick={() => {
                haptic('tap');
                onChange(pos);
              }}
            >
              <span className="opt-letter display">
                {state === 'is-correct' || state === 'is-answer' ? <IconCheck className="opt-icon" /> : state === 'is-wrong' ? <IconCross className="opt-icon" /> : LETTERS[pos]}
              </span>
              <span className="opt-text">
                <RichText text={text} />
              </span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

/** Tap the items in the right order. */
function Order({ q, order, phase, onChange }: Props) {
  const items = q.items ?? [];
  const [picked, setPicked] = useState<number[]>([]); // display positions
  const done = phase !== 'answering';
  const update = (next: number[]) => {
    setPicked(next);
    onChange(next.length === items.length ? next.map((p) => items[order[p]]).join('|') : null);
  };
  const correct = items.join('|') === picked.map((p) => items[order[p]]).join('|');
  return (
    <div className="ord">
      <div className={`ord-chain${done ? (correct ? ' is-good' : ' is-bad') : ''}`} aria-live="polite">
        {items.map((_, i) => {
          const p = picked[i];
          return (
            <button
              type="button"
              key={i}
              className={`ord-slot${p !== undefined ? ' is-filled' : ''}`}
              disabled={done || p === undefined}
              onClick={() => {
                haptic('tap');
                update(picked.slice(0, i));
              }}
            >
              <span className="ord-n display">{i + 1}</span>
              <span className="ord-label">{p !== undefined ? <RichText text={items[order[p]]} /> : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="ord-pool">
        {order.map((authored, pos) => {
          const used = picked.includes(pos);
          return (
            <span className="opt-slot" key={pos} style={{ ['--i' as string]: pos }}>
              <button
                type="button"
                className={`ord-item${used ? ' is-used' : ''}`}
                disabled={done || used}
                onClick={() => {
                  haptic('tap');
                  update([...picked, pos]);
                }}
              >
                <RichText text={items[authored]} />
              </button>
            </span>
          );
        })}
      </div>
      {!done && picked.length > 0 && (
        <button type="button" className="ord-reset" onClick={() => update([])}>
          Borrar orden
        </button>
      )}
      {phase === 'wrong' && <p className="ord-solution">Orden correcto: {items.join(' → ')}</p>}
    </div>
  );
}

function cellClass(text: string): string {
  if (text.includes('{g-')) return 'tcell--grid';
  return hasGlyph(text) ? 'tcell--glyph' : 'tcell--text';
}

/** Tap the right cell of the visual grid. */
function Tap({ q, phase, value, onChange }: Props) {
  const rows = (q.visual ?? []).map((r) => r.trim().split(/\s+/));
  const cols = rows[0]?.length ?? 1;
  const done = phase !== 'answering';
  return (
    <div className="tgrid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {rows.flat().map((c, i) => {
        const sel = value === String(i);
        let state = '';
        if (done) state = i === q.cell ? 'is-answer' : sel ? 'is-wrong' : '';
        else if (sel) state = 'is-selected';
        return (
          <button
            type="button"
            key={i}
            className={`tcell ${cellClass(c)} ${state}`}
            disabled={done}
            aria-label={`Casilla ${i + 1}`}
            onClick={() => {
              haptic('tap');
              onChange(String(i));
            }}
          >
            <RichText text={c} />
          </button>
        );
      })}
    </div>
  );
}

/** Watch the cells light up, then tap them back. */
function Memory({ q, phase, onChange }: Props) {
  const size = q.size ?? 3;
  const seq = q.seq ?? [];
  const [stage, setStage] = useState<'ready' | 'show' | 'input'>('ready');
  const [lit, setLit] = useState<number[]>([]);
  const [taps, setTaps] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const play = () => {
    setStage('show');
    setTaps([]);
    onChange(null);
    const slow = prefersReducedMotion() ? 1.4 : 1;
    if (q.ordered) {
      seq.forEach((c, i) => {
        timers.current.push(window.setTimeout(() => { setLit([c]); haptic('tap'); }, (400 + i * 750) * slow));
        timers.current.push(window.setTimeout(() => setLit([]), (400 + i * 750 + 520) * slow));
      });
      timers.current.push(window.setTimeout(() => setStage('input'), (400 + seq.length * 750) * slow));
    } else {
      timers.current.push(window.setTimeout(() => setLit(seq), 400));
      timers.current.push(window.setTimeout(() => { setLit([]); setStage('input'); }, (400 + 900 + seq.length * 380) * slow));
    }
  };
  useEffect(() => {
    const t = window.setTimeout(play, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = phase !== 'answering';
  const tap = (c: number) => {
    if (stage !== 'input' || done) return;
    haptic('tap');
    let next: number[];
    if (q.ordered) next = taps.length < seq.length ? [...taps, c] : taps;
    else next = taps.includes(c) ? taps.filter((x) => x !== c) : taps.length < seq.length ? [...taps, c] : taps;
    setTaps(next);
    onChange(next.length === seq.length ? next.join(',') : null);
  };

  return (
    <div className="mem">
      <p className="mem-status display" aria-live="polite">
        {stage === 'ready' ? 'Prepárate…' : stage === 'show' ? 'Observa' : done ? (phase === 'wrong' ? 'Así era' : '¡Bien!') : `Tu turno · ${taps.length}/${seq.length}`}
      </p>
      <div className="pgrid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }, (_, i) => {
          const on = lit.includes(i);
          const n = taps.indexOf(i);
          const solN = seq.indexOf(i);
          const reveal = phase === 'wrong' && solN >= 0;
          return (
            <button
              type="button"
              key={i}
              className={`pcell${on ? ' is-lit' : ''}${n >= 0 ? ' is-on' : ''}${reveal ? ' is-answer' : ''}`}
              disabled={stage !== 'input' || done}
              onClick={() => tap(i)}
              aria-label={`Casilla ${i + 1}`}
            >
              {q.ordered && n >= 0 && <span className="pcell-n display">{n + 1}</span>}
              {q.ordered && reveal && n < 0 && <span className="pcell-n display">{solN + 1}</span>}
            </button>
          );
        })}
      </div>
      {!done && stage === 'input' && taps.length > 0 && (
        <button type="button" className="ord-reset" onClick={() => { setTaps([]); onChange(null); }}>
          Empezar de nuevo
        </button>
      )}
    </div>
  );
}

/** Paint the 3×3 answer. */
function Paint({ q, phase, onChange }: Props) {
  const [mask, setMask] = useState('000000000');
  const done = phase !== 'answering';
  const target = q.target ?? '';
  const toggle = (i: number) => {
    haptic('tap');
    const next = mask.slice(0, i) + (mask[i] === '1' ? '0' : '1') + mask.slice(i + 1);
    setMask(next);
    onChange(next.includes('1') ? next : null);
  };
  return (
    <div className="paint">
      <div className="pgrid pgrid--paint" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {Array.from({ length: 9 }, (_, i) => {
          const on = mask[i] === '1';
          const should = target[i] === '1';
          let state = on ? ' is-on' : '';
          if (phase === 'wrong') state += on !== should ? (should ? ' is-missing' : ' is-extra') : '';
          return <button type="button" key={i} className={`pcell${state}`} disabled={done} onClick={() => toggle(i)} aria-label={`Casilla ${i + 1}`} />;
        })}
      </div>
      {phase === 'wrong' && <p className="ord-solution">Con borde de color, las casillas que faltaban; tachadas, las que sobraban.</p>}
    </div>
  );
}

export function AnswerArea(props: Props) {
  switch (props.q.kind ?? 'choice') {
    case 'order':
      return <Order {...props} />;
    case 'tap':
      return <Tap {...props} />;
    case 'memory':
      return <Memory {...props} />;
    case 'paint':
      return <Paint {...props} />;
    default:
      return <Choice {...props} />;
  }
}

/** Instruction shown above interactive answers. */
export function answerHint(q: Question): string | null {
  switch (q.kind ?? 'choice') {
    case 'order':
      return 'Toca en orden. Toca un hueco para corregir.';
    case 'tap':
      return 'Toca la casilla.';
    case 'paint':
      return 'Toca las casillas para pintarlas.';
    default:
      return null;
  }
}
