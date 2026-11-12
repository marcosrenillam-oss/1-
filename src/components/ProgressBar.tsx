import { RUN_LENGTH } from '../engine/difficulty';

interface Props {
  /** Number of questions already answered correctly. */
  done: number;
  /** 0-based index of the question on screen. */
  current: number;
  failed?: boolean;
}

export function ProgressBar({ done, current, failed }: Props) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={RUN_LENGTH} aria-valuenow={done}>
      {Array.from({ length: RUN_LENGTH }, (_, i) => {
        const state = i < done ? 'done' : i === current ? (failed ? 'fail' : 'current') : 'todo';
        const milestone = i === 3 || i === 7 || i === 11 || i === 15 || i === 18;
        return (
          <span key={i} className={`seg seg--${state}${milestone ? ' seg--gap' : ''}${i === RUN_LENGTH - 1 ? ' seg--final' : ''}`}>
            <span className="seg-fill" />
          </span>
        );
      })}
    </div>
  );
}
