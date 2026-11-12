import { BANK, getQuestion } from '../data/questions';
import type { Mode, Question } from '../data/types';
export const formatMs = (ms: number) => {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
import type { ActiveRun, CronoStats, ModeStats, SaveData } from '../storage/persistence';
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
  stats: ModeStats | CronoStats;
  /** Contrarreloj run. */
  timed: boolean;
  /** Lost because the clock ran out. */
  timeout?: boolean;
  /** Contrarreloj: total time spent answering (ms). */
  totalMs?: number;
  /** Contrarreloj victory faster than the previous best. */
  newBestTime?: boolean;
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

/**
 * Contrarreloj time limit for a question, in seconds: enough to read it
 * calmly plus thinking time that grows with its difficulty band.
 */
export function timeLimitFor(q: Question): number {
  const optLen = q.options.reduce((n, o) => n + o.replace(/\{[^}]+\}/g, 'xx').length, 0);
  const visualCells = (q.visual ?? []).reduce((n, r) => n + r.trim().split(/\s+/).length, 0);
  const raw = 12 + q.prompt.length / 12 + optLen / 25 + (q.visual ? 8 + visualCells * 0.6 : 0) + q.tier * 2;
  return Math.min(120, Math.max(20, Math.ceil(raw / 5) * 5));
}

export function startRun(prev: SaveData, mode: Mode, rng: Rng, timed = false): SaveData {
  const save = clone(prev);
  const stats = save.stats[mode];
  const ids = selectRun(BANK[mode], stats, rng);
  stats.gamesStarted += 1;
  stats.recentRuns = [ids, ...stats.recentRuns].slice(0, RECENT_KEEP);
  const orders = ids.map((id) => shuffle([...getQuestion(id)!.options.keys()], rng));
  save.run = { mode, ids, orders, index: 0, gameNo: stats.gamesStarted, ...(timed ? { timed: true, usedMs: 0 } : {}) };
  save.lastMode = mode;
  save.lastTimed = timed;
  markSeen(stats, ids[0], stats.gamesStarted);
  return save;
}

function finish(save: SaveData, run: ActiveRun, score: number, won: boolean, abandoned: boolean, extra: Partial<RunResult>): RunResult {
  const timed = !!run.timed;
  const stats: ModeStats | CronoStats = timed ? save.crono[run.mode] : save.stats[run.mode];
  const prevBest = stats.best;
  stats.played += 1;
  if (won) stats.completed += 1;
  stats.best = Math.max(stats.best, score);
  stats.bestReached = Math.max(stats.bestReached, Math.min(RUN_LENGTH, run.index + 1));
  let newBestTime = false;
  if (timed && won) {
    const c = stats as CronoStats;
    const total = run.usedMs ?? 0;
    newBestTime = c.bestTimeMs === null || total < c.bestTimeMs;
    if (newBestTime) c.bestTimeMs = total;
  }
  save.run = null;
  return {
    mode: run.mode,
    score,
    reached: run.index + 1,
    won,
    abandoned,
    newRecord: score > prevBest,
    stats: structuredClone(stats),
    timed,
    ...(timed ? { totalMs: run.usedMs ?? 0, newBestTime } : {}),
    ...extra,
  };
}

/** Contrarreloj: starts the clock of the current question (idempotent). */
export function startTimer(prev: SaveData, now: number): SaveData {
  const run = prev.run;
  if (!run?.timed || run.timer?.index === run.index) return prev;
  const save = clone(prev);
  const r = save.run!;
  const limit = timeLimitFor(currentQuestion(r)) * 1000;
  r.timer = { index: r.index, startedAt: now, deadline: now + limit };
  return save;
}

/** Contrarreloj: the clock of the current question ran out. */
export function timeoutRun(prev: SaveData, now: number): { save: SaveData; result: RunResult } | null {
  const save = clone(prev);
  const run = save.run;
  if (!run?.timed || !run.timer || run.timer.index !== run.index || now < run.timer.deadline) return null;
  run.usedMs = (run.usedMs ?? 0) + (run.timer.deadline - run.timer.startedAt);
  const q = currentQuestion(run);
  const result = finish(save, run, run.index, false, false, { questionId: q.id, timeout: true });
  return { save, result };
}

/** @param displayPos position of the tapped option as shown on screen */
export function submitAnswer(prev: SaveData, displayPos: number, now = Date.now()): AnswerOutcome {
  const save = clone(prev);
  const run = save.run;
  if (!run) throw new Error('No active run');
  const q = currentQuestion(run);
  const chosen = run.orders[run.index][displayPos];
  if (run.timed && run.timer?.index === run.index) {
    if (now >= run.timer.deadline) {
      run.usedMs = (run.usedMs ?? 0) + (run.timer.deadline - run.timer.startedAt);
      const result = finish(save, run, run.index, false, false, { questionId: q.id, timeout: true });
      return { kind: 'wrong', save, result };
    }
    run.usedMs = (run.usedMs ?? 0) + Math.max(0, now - run.timer.startedAt);
    delete run.timer;
  }
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

export function winRate(s: { played: number; completed: number }): number {
  return s.played ? Math.round((s.completed / s.played) * 100) : 0;
}
