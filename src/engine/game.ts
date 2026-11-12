import { BANK, getQuestion } from '../data/questions';
import type { Mode, Question } from '../data/types';
import type { ActiveRun, ModeStats, SaveData } from '../storage/persistence';
import { RUN_LENGTH } from './difficulty';
import { shuffle, type Rng } from './rng';
import { selectRun } from './selector';

export interface RunResult {
  mode: Mode;
  /** Correct answers in this run (0-20). */
  score: number;
  /** Question number where the run ended (1-20). */
  reached: number;
  won: boolean;
  abandoned: boolean;
  /** The failed question (losses only). */
  questionId?: string;
  /** Authored index of the option the player chose (losses only). */
  chosen?: number;
  newRecord: boolean;
  stats: ModeStats;
}

export type AnswerOutcome =
  | { kind: 'correct'; save: SaveData }
  | { kind: 'victory'; save: SaveData; result: RunResult }
  | { kind: 'wrong'; save: SaveData; result: RunResult };

const RECENT_KEEP = 10;

function clone(save: SaveData): SaveData {
  return structuredClone(save);
}

function markSeen(stats: ModeStats, id: string, gameNo: number) {
  const prev = stats.seen[id];
  stats.seen[id] = { count: (prev?.count ?? 0) + 1, last: gameNo };
}

export function currentQuestion(run: ActiveRun): Question {
  const q = getQuestion(run.ids[run.index]);
  if (!q) throw new Error(`Unknown question ${run.ids[run.index]}`);
  return q;
}

/** Drops a persisted run that no longer matches the bank (e.g. after an update). */
export function sanitizeRun(save: SaveData): SaveData {
  const run = save.run;
  if (!run) return save;
  const ok =
    run.ids.length === RUN_LENGTH &&
    run.ids.every((id, i) => {
      const q = getQuestion(id);
      const order = run.orders[i];
      return !!q && q.mode === run.mode && Array.isArray(order) && order.length === q.options.length &&
        [...order].sort((a, b) => a - b).every((v, k) => v === k);
    });
  return ok ? save : { ...save, run: null };
}

export function startRun(prev: SaveData, mode: Mode, rng: Rng): SaveData {
  const save = clone(prev);
  const stats = save.stats[mode];
  const ids = selectRun(BANK[mode], stats, rng);
  stats.gamesStarted += 1;
  stats.recentRuns = [ids, ...stats.recentRuns].slice(0, RECENT_KEEP);
  const orders = ids.map((id) => shuffle([...getQuestion(id)!.options.keys()], rng));
  save.run = { mode, ids, orders, index: 0, gameNo: stats.gamesStarted };
  save.lastMode = mode;
  markSeen(stats, ids[0], stats.gamesStarted);
  return save;
}

function finish(save: SaveData, run: ActiveRun, score: number, won: boolean, abandoned: boolean, extra: Partial<RunResult>): RunResult {
  const stats = save.stats[run.mode];
  const prevBest = stats.best;
  stats.played += 1;
  if (won) stats.completed += 1;
  stats.best = Math.max(stats.best, score);
  stats.bestReached = Math.max(stats.bestReached, Math.min(RUN_LENGTH, run.index + 1));
  save.run = null;
  return {
    mode: run.mode,
    score,
    reached: run.index + 1,
    won,
    abandoned,
    newRecord: score > prevBest,
    stats: structuredClone(stats),
    ...extra,
  };
}

/** @param displayPos position of the tapped option as shown on screen */
export function submitAnswer(prev: SaveData, displayPos: number): AnswerOutcome {
  const save = clone(prev);
  const run = save.run;
  if (!run) throw new Error('No active run');
  const q = currentQuestion(run);
  const chosen = run.orders[run.index][displayPos];
  if (chosen !== q.answer) {
    const result = finish(save, run, run.index, false, false, { questionId: q.id, chosen });
    return { kind: 'wrong', save, result };
  }
  if (run.index === RUN_LENGTH - 1) {
    const result = finish(save, run, RUN_LENGTH, true, false, {});
    return { kind: 'victory', save, result };
  }
  run.index += 1;
  markSeen(save.stats[run.mode], run.ids[run.index], run.gameNo);
  return { kind: 'correct', save };
}

export function abandonRun(prev: SaveData): { save: SaveData; result: RunResult } | null {
  const save = clone(prev);
  const run = save.run;
  if (!run) return null;
  const result = finish(save, run, run.index, false, true, {});
  return { save, result };
}

export function winRate(s: ModeStats): number {
  return s.played ? Math.round((s.completed / s.played) * 100) : 0;
}
