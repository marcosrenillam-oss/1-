import { BANK, getQuestion } from '../data/questions';
import type { Question } from '../data/types';
import type { ActiveRun, PlayStats, SaveData } from '../storage/persistence';
import { adventureSlot, BOSS_LEVEL, MAX_RUN, runSlot, STAGE_LEN, WORLD_LEVELS, WORLDS, type GameMode } from './difficulty';
import { shuffle, type Rng } from './rng';
import { selectSlots } from './selector';

export const formatMs = (ms: number) => {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** What the player answered: a display position (choice) or an encoded string. */
export type Response = number | string;

export interface RunResult {
  type: 'run' | 'adventure';
  mode: GameMode;
  /** Correct answers in this run (0-100). */
  score: number;
  /** Question number where the run ended (1-100). */
  reached: number;
  /** Run: at least one phase cleared (20). Adventure: level passed. */
  won: boolean;
  /** Run: all 100 answered correctly. */
  complete: boolean;
  /** Phases cleared (0-5). */
  stages: number;
  abandoned: boolean;
  questionId?: string;
  /** What the player answered on the failed question. */
  response?: Response;
  /** Display order used for that question. */
  order?: number[];
  newRecord: boolean;
  stats?: PlayStats;
  timed: boolean;
  timeout?: boolean;
  totalMs?: number;
  newBestTime?: boolean;
  // Adventure
  world?: number;
  level?: number;
  boss?: boolean;
  worldCleared?: boolean;
  finished?: boolean;
}

export type AnswerOutcome =
  | { kind: 'correct'; save: SaveData; stageCleared?: number }
  | { kind: 'victory'; save: SaveData; result: RunResult }
  | { kind: 'wrong'; save: SaveData; result: RunResult };

const RECENT_KEEP = 10;
const clone = (s: SaveData): SaveData => structuredClone(s);

function markSeen(save: SaveData, id: string, gameNo: number) {
  const prev = save.history.seen[id];
  save.history.seen[id] = { count: (prev?.count ?? 0) + 1, last: gameNo };
}

export function currentQuestion(run: ActiveRun): Question {
  const q = getQuestion(run.ids[run.index]);
  if (!q) throw new Error(`Unknown question ${run.ids[run.index]}`);
  return q;
}

function displayOrder(q: Question, rng: Rng): number[] {
  const kind = q.kind ?? 'choice';
  if (kind === 'choice') return shuffle([...q.options.keys()], rng);
  if (kind === 'order') {
    const items = q.items ?? [];
    let o = shuffle([...items.keys()], rng);
    if (o.every((v, i) => v === i)) o = [...o.slice(1), o[0]]; // never pre-solved
    return o;
  }
  return [];
}

function expectedLen(q: Question): number {
  const kind = q.kind ?? 'choice';
  return kind === 'choice' ? q.options.length : kind === 'order' ? (q.items ?? []).length : 0;
}

/** Drops a persisted run that no longer matches the bank (e.g. after an update). */
export function sanitizeRun(save: SaveData): SaveData {
  const run = save.run;
  if (!run) return save;
  const ok = run.ids.length > 0 && run.ids.every((id, i) => {
    const q = getQuestion(id);
    const order = run.orders[i];
    return !!q && Array.isArray(order) && order.length === expectedLen(q) && [...order].sort((a, b) => a - b).every((v, k) => v === k);
  });
  return ok ? save : { ...save, run: null };
}

/** Is `response` the right answer to `q` shown with `order`? */
export function checkResponse(q: Question, order: number[], response: Response): boolean {
  switch (q.kind ?? 'choice') {
    case 'choice':
      return typeof response === 'number' && order[response] === q.answer;
    case 'order':
      return response === (q.items ?? []).join('|');
    case 'tap':
      return response === String(q.cell);
    case 'memory': {
      const seq = q.seq ?? [];
      if (q.ordered) return response === seq.join(',');
      const got = String(response).split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
      return got.join(',') === [...seq].sort((a, b) => a - b).join(',');
    }
    case 'paint':
      return response === q.target;
  }
}

/** Human-readable correct answer (for reviews). */
export function answerText(q: Question): string {
  switch (q.kind ?? 'choice') {
    case 'choice':
      return q.options[q.answer];
    case 'order':
      return (q.items ?? []).join(' → ');
    case 'tap': {
      const cols = (q.visual?.[0] ?? '').trim().split(/\s+/).length || 1;
      return `Fila ${Math.floor((q.cell ?? 0) / cols) + 1}, columna ${((q.cell ?? 0) % cols) + 1}`;
    }
    case 'memory':
      return `${(q.seq ?? []).length} casillas${q.ordered ? ' en orden' : ''}`;
    case 'paint':
      return `{g-${q.target}}`;
  }
}

/**
 * Contrarreloj time limit for a question, in seconds: enough to read it
 * calmly plus thinking time that grows with its difficulty.
 */
export function timeLimitFor(q: Question): number {
  const optLen = q.options.reduce((n, o) => n + o.replace(/\{[^}]+\}/g, 'xx').length, 0);
  const visualCells = (q.visual ?? []).reduce((n, r) => n + r.trim().split(/\s+/).length, 0);
  let raw = 12 + q.prompt.length / 12 + optLen / 25 + (q.visual ? 8 + visualCells * 0.6 : 0) + q.tier * 2 + (q.level - 1) * 1.5;
  if (q.kind === 'order') raw += (q.items ?? []).length * 3;
  if (q.kind === 'memory') raw += (q.seq ?? []).length * 2 + 6;
  if (q.kind === 'paint') raw += 12;
  return Math.min(120, Math.max(20, Math.ceil(raw / 5) * 5));
}

// ─────────────────────────────────────────────────────────────────────────
// Runs (Normal / Difícil, up to 100 questions)
// ─────────────────────────────────────────────────────────────────────────
export function startRun(prev: SaveData, mode: GameMode, rng: Rng, timed = false): SaveData {
  const save = clone(prev);
  const slots = Array.from({ length: MAX_RUN }, (_, i) => runSlot(mode, i));
  const ids = selectSlots(slots, save.history, rng);
  save.history.gamesStarted += 1;
  save.history.recentRuns = [ids.slice(0, STAGE_LEN * 2), ...save.history.recentRuns].slice(0, RECENT_KEEP);
  const orders = ids.map((id) => displayOrder(getQuestion(id)!, rng));
  save.run = { type: 'run', mode, ids, orders, index: 0, gameNo: save.history.gamesStarted, ...(timed ? { timed: true, usedMs: 0 } : {}) };
  save.lastMode = mode;
  save.lastPlay = timed ? 'crono' : 'classic';
  markSeen(save, ids[0], save.history.gamesStarted);
  return save;
}

function finishRun(save: SaveData, run: ActiveRun, score: number, abandoned: boolean, extra: Partial<RunResult>): RunResult {
  const timed = !!run.timed;
  const stats = save.records[run.mode][timed ? 'crono' : 'classic'];
  const prevBest = stats.best;
  const stages = Math.floor(score / STAGE_LEN);
  stats.played += 1;
  if (stages >= 1) stats.completed += 1;
  stats.best = Math.max(stats.best, score);
  stats.bestStage = Math.max(stats.bestStage, stages);
  let newBestTime = false;
  if (timed && run.phase1Ms !== undefined) {
    newBestTime = stats.bestTimeMs === null || run.phase1Ms < stats.bestTimeMs;
    if (newBestTime) stats.bestTimeMs = run.phase1Ms;
  }
  save.run = null;
  return {
    type: 'run',
    mode: run.mode,
    score,
    reached: Math.min(MAX_RUN, run.index + 1),
    won: stages >= 1,
    complete: score === MAX_RUN,
    stages,
    abandoned,
    newRecord: score > prevBest,
    stats: structuredClone(stats),
    timed,
    ...(timed ? { totalMs: run.usedMs ?? 0, newBestTime } : {}),
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Adventure (5 worlds × 100 levels + boss)
// ─────────────────────────────────────────────────────────────────────────
export function bossPool(world: number): Question[] {
  const lvl = BOSS_LEVEL[world];
  const pool = BANK[lvl].filter((q) => q.tier >= 5 && (q.kind ?? 'choice') === 'choice');
  return world >= 3 ? [...BANK[7].filter((q) => q.boss), ...pool] : pool;
}

export function startAdventure(prev: SaveData, rng: Rng): SaveData | null {
  const a = prev.adventure;
  if (a.finished) return null;
  const save = clone(prev);
  const boss = a.level > WORLD_LEVELS;
  const slot = boss ? { level: BOSS_LEVEL[a.world], tier: 6 as const } : adventureSlot(a.world, a.level);
  const [id] = selectSlots([slot], save.history, rng, {
    previous: a.recent.slice(-19),
    exclude: a.recent,
    ...(boss ? { pool: () => bossPool(a.world) } : {}),
  });
  if (!id) return null;
  save.history.gamesStarted += 1;
  const q = getQuestion(id)!;
  save.run = {
    type: 'adventure',
    mode: save.lastMode,
    ids: [id],
    orders: [displayOrder(q, rng)],
    index: 0,
    gameNo: save.history.gamesStarted,
    world: a.world,
    level: a.level,
    boss,
  };
  save.lastPlay = 'adventure';
  markSeen(save, id, save.history.gamesStarted);
  return save;
}

function finishAdventure(save: SaveData, run: ActiveRun, passed: boolean, extra: Partial<RunResult>): RunResult {
  const a = save.adventure;
  const q = currentQuestion(run);
  a.recent = [...a.recent, q.id].slice(-30);
  a.answered += 1;
  let worldCleared = false;
  if (passed) {
    if (run.boss) {
      worldCleared = true;
      if (a.world >= WORLDS.length - 1) a.finished = true;
      else {
        a.world += 1;
        a.level = 1;
      }
    } else a.level += 1;
  } else a.failed += 1;
  save.run = null;
  return {
    type: 'adventure',
    mode: run.mode,
    score: passed ? 1 : 0,
    reached: 1,
    won: passed,
    complete: false,
    stages: 0,
    abandoned: false,
    newRecord: false,
    timed: false,
    world: run.world,
    level: run.level,
    boss: run.boss,
    worldCleared,
    finished: a.finished,
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Answers, clock and abandon
// ─────────────────────────────────────────────────────────────────────────
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
  const result = finishRun(save, run, run.index, false, { questionId: q.id, order: run.orders[run.index], timeout: true });
  return { save, result };
}

export function submitAnswer(prev: SaveData, response: Response, now = Date.now()): AnswerOutcome {
  const save = clone(prev);
  const run = save.run;
  if (!run) throw new Error('No active run');
  const q = currentQuestion(run);
  const order = run.orders[run.index];
  const correct = checkResponse(q, order, response);

  if (run.type === 'adventure') {
    const result = finishAdventure(save, run, correct, { questionId: q.id, response, order });
    return correct ? { kind: 'victory', save, result } : { kind: 'wrong', save, result };
  }

  if (run.timed && run.timer?.index === run.index) {
    if (now >= run.timer.deadline) {
      run.usedMs = (run.usedMs ?? 0) + (run.timer.deadline - run.timer.startedAt);
      const result = finishRun(save, run, run.index, false, { questionId: q.id, order, timeout: true });
      return { kind: 'wrong', save, result };
    }
    run.usedMs = (run.usedMs ?? 0) + Math.max(0, now - run.timer.startedAt);
    delete run.timer;
  }
  if (!correct) {
    const result = finishRun(save, run, run.index, false, { questionId: q.id, response, order });
    return { kind: 'wrong', save, result };
  }
  if (run.index === MAX_RUN - 1) {
    const result = finishRun(save, run, MAX_RUN, false, {});
    return { kind: 'victory', save, result };
  }
  run.index += 1;
  if (run.timed && run.index === STAGE_LEN) run.phase1Ms = run.usedMs ?? 0;
  markSeen(save, run.ids[run.index], run.gameNo);
  const stageCleared = run.index % STAGE_LEN === 0 ? run.index / STAGE_LEN : undefined;
  return { kind: 'correct', save, ...(stageCleared ? { stageCleared } : {}) };
}

/** Leaves the current run. In a run it counts as finished with the current score. */
export function abandonRun(prev: SaveData): { save: SaveData; result: RunResult | null } | null {
  const save = clone(prev);
  const run = save.run;
  if (!run) return null;
  if (run.type === 'adventure') {
    save.run = null;
    return { save, result: null };
  }
  return { save, result: finishRun(save, run, run.index, true, {}) };
}

export function winRate(s: { played: number; completed: number }): number {
  return s.played ? Math.round((s.completed / s.played) * 100) : 0;
}

/** Overall adventure progress 0-100 (%). */
export function adventureProgress(save: SaveData): number {
  const a = save.adventure;
  if (a.finished) return 100;
  return Math.round(((a.world * (WORLD_LEVELS + 1) + (a.level - 1)) / (WORLDS.length * (WORLD_LEVELS + 1))) * 100);
}
