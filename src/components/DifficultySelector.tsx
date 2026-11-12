import type { Mode } from '../data/types';
import { MODE_INFO, MODES } from '../engine/difficulty';
import { LevelBars } from './LevelBars';

interface Props {
  value: Mode;
  onChange: (m: Mode) => void;
}

export function DifficultySelector({ value, onChange }: Props) {
  const idx = MODES.indexOf(value);
  return (
    <div className="diff" role="radiogroup" aria-label="Dificultad">
      <span className="diff-indicator" style={{ transform: `translateX(${idx * 100}%)` }} aria-hidden="true" />
      {MODES.map((m) => {
        const info = MODE_INFO[m];
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            className={`diff-opt${active ? ' is-active' : ''}`}
            onClick={() => onChange(m)}
          >
            <LevelBars level={info.level} />
            <span className="diff-label">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}
