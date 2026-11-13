import { MODES, type GameMode } from '../engine/difficulty';
import type { SeenInfo } from '../engine/selector';

export type Play = 'classic' | 'crono' | 'adventure';

export interface ActiveRun {
  type: 'run' | 'adventure';
  mode: GameMode;
  ids: string[];
  /** orders[i] = display permutation of options (choice) or items (order). */
  orders: number[][];
  /** Index of the current (unanswered) question. */
  index: number;
  gameNo: number;
  /** Contrarreloj: every question has a time limit. */
  timed?: boolean;
  /** Clock of the current question. Absolute times survive app restarts. */
  timer?: { index: number; startedAt: number; deadline: number };
  /** Contrarreloj: time spent on answered questions. */
  usedMs?: number;
  /** Contrarreloj: time it took to clear the first phase (20). */
  phase1Ms?: number;
  /** Adventure: world (0-4), level (1-100) and whether it is the boss. */
  world?: number;
  level?: number;
  boss?: boolean;
}

export interface PlayStats {
  played: number;
  /** Runs that reached at least 20 correct answers (a victory). */
  completed: number;
  /** Best score (0-100). */
  best: number;
  /** Phases cleared in the best run (0-5). */
  bestStage: number;
  /** Contrarreloj: fastest first phase (20 correct), in ms. */
  bestTimeMs: number | null;
}

export interface History {
  seen: Record<string, SeenInfo>;
  gamesStarted: number;
  recentRuns: string[][];
  /** Last questions shown in any mode (variety across games and modes). */
  last?: string[];
}

export interface AdventureState {
  /** Current world 0-4. */
  world: number;
  /** Next level to play, 1-100; 101 = the world boss. */
  level: number;
  finished: boolean;
  /** Recent adventure question ids (variety). */
  recent: string[];
  answered: number;
  failed: number;
}

export interface SaveData {
  version: 2;
  lastMode: GameMode;
  lastPlay: Play;
  history: History;
  records: Record<GameMode, { classic: PlayStats; crono: PlayStats }>;
  adventure: AdventureState;
  run: ActiveRun | null;
}

const KEY = 'uno-por-ciento:v1';

export const emptyPlayStats = (): PlayStats => ({ played: 0, completed: 0, best: 0, bestStage: 0, bestTimeMs: null });
export const emptyAdventure = (): AdventureState => ({ world: 0, level: 1, finished: false, recent: [], answered: 0, failed: 0 });

export function emptySave(): SaveData {
  return {
    version: 2,
    lastMode: 'normal',
    lastPlay: 'classic',
    history: { seen: {}, gamesStarted: 0, recentRuns: [] },
    records: {
      normal: { classic: emptyPlayStats(), crono: emptyPlayStats() },
      dificil: { classic: emptyPlayStats(), crono: emptyPlayStats() },
    },
    adventure: emptyAdventure(),
    run: null,
  };
}

const num = (v: unknown, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function playStats(v: unknown): PlayStats {
  const s = obj(v);
  return {
    played: num(s.played),
    completed: num(s.completed),
    best: num(s.best, 100),
    bestStage: num(s.bestStage, 5),
    bestTimeMs: typeof s.bestTimeMs === 'number' && s.bestTimeMs > 0 ? s.bestTimeMs : null,
  };
}

function seenMap(v: unknown): Record<string, SeenInfo> {
  const out: Record<string, SeenInfo> = {};
  for (const [id, info] of Object.entries(obj(v))) {
    const i = obj(info);
    if (typeof i.count === 'number' && typeof i.last === 'number') out[id] = { count: i.count, last: i.last };
  }
  return out;
}

/** Converts the first save format (four 20-question modes) to v2. */
function migrateV1(r: Record<string, unknown>): SaveData {
  const base = emptySave();
  const stats = obj(r.stats);
  const crono = obj(r.crono);
  let games = 0;
  for (const m of ['facil', 'normal', 'dificil', 'experto']) {
    const s = obj(stats[m]);
    games += num(s.gamesStarted);
    for (const [id, info] of Object.entries(seenMap(s.seen))) {
      const prev = base.history.seen[id];
      base.history.seen[id] = prev ? { count: prev.count + info.count, last: Math.max(prev.last, info.last) } : info;
    }
  }
  base.history.gamesStarted = games;
  const carry = (from: unknown): PlayStats => {
    const p = playStats(from);
    return { ...p, bestStage: p.best >= 20 ? 1 : 0 };
  };
  base.records.normal.classic = carry(stats.normal);
  base.records.dificil.classic = carry(stats.dificil);
  base.records.normal.crono = carry(crono.normal);
  base.records.dificil.crono = carry(crono.dificil);
  return base;
}

/** Defensive merge so a corrupted or older save never breaks the app. */
export function normalize(raw: unknown): SaveData {
  const r = obj(raw);
  if (!raw || typeof raw !== 'object') return emptySave();
  if (r.version !== 2) return migrateV1(r);
  const base = emptySave();
  if (MODES.includes(r.lastMode as GameMode)) base.lastMode = r.lastMode as GameMode;
  if (['classic', 'crono', 'adventure'].includes(r.lastPlay as string)) base.lastPlay = r.lastPlay as Play;
  const h = obj(r.history);
  base.history = {
    seen: seenMap(h.seen),
    gamesStarted: num(h.gamesStarted),
    recentRuns: Array.isArray(h.recentRuns) ? (h.recentRuns as unknown[]).filter(Array.isArray).slice(0, 10) as string[][] : [],
    last: Array.isArray(h.last) ? (h.last as unknown[]).filter((x): x is string => typeof x === 'string').slice(-20) : [],
  };
  const rec = obj(r.records);
  for (const m of MODES) {
    const x = obj(rec[m]);
    base.records[m] = { classic: playStats(x.classic), crono: playStats(x.crono) };
  }
  const a = obj(r.adventure);
  base.adventure = {
    world: Math.min(4, num(a.world)),
    level: Math.max(1, Math.min(101, num(a.level) || 1)),
    finished: a.finished === true,
    recent: Array.isArray(a.recent) ? (a.recent as unknown[]).filter((x): x is string => typeof x === 'string').slice(-30) : [],
    answered: num(a.answered),
    failed: num(a.failed),
  };
  const run = obj(r.run);
  if (
    (run.type === 'run' || run.type === 'adventure') && MODES.includes(run.mode as GameMode) &&
    Array.isArray(run.ids) && Array.isArray(run.orders) && run.orders.length === run.ids.length &&
    typeof run.index === 'number' && run.index >= 0 && run.index < run.ids.length
  ) {
    base.run = run as unknown as ActiveRun;
  }
  return base;
}

export function loadSave(): SaveData {
  try {
    const txt = localStorage.getItem(KEY);
    return txt ? normalize(JSON.parse(txt)) : emptySave();
  } catch {
    return emptySave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable: the game keeps working in memory */
  }
}

/** Ask the browser not to evict our data under storage pressure. */
export function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}
