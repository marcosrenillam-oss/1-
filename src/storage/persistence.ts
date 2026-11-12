import type { Mode } from '../data/types';
import { MODES } from '../engine/difficulty';
import type { SeenInfo } from '../engine/selector';

export interface ActiveRun {
  mode: Mode;
  ids: string[];
  /** orders[i][displayPos] = authored option index shown at that position. */
  orders: number[][];
  /** Index of the current (unanswered) question. */
  index: number;
  gameNo: number;
}

export interface ModeStats {
  played: number;
  completed: number;
  /** Best score: most consecutive correct answers in a run (0-20). */
  best: number;
  /** Furthest question number reached (1-20). */
  bestReached: number;
  gamesStarted: number;
  seen: Record<string, SeenInfo>;
  recentRuns: string[][];
}

export interface SaveData {
  version: 1;
  lastMode: Mode;
  stats: Record<Mode, ModeStats>;
  run: ActiveRun | null;
}

const KEY = 'uno-por-ciento:v1';

export function emptyStats(): ModeStats {
  return { played: 0, completed: 0, best: 0, bestReached: 0, gamesStarted: 0, seen: {}, recentRuns: [] };
}

export function emptySave(): SaveData {
  return {
    version: 1,
    lastMode: 'facil',
    stats: { facil: emptyStats(), normal: emptyStats(), dificil: emptyStats(), experto: emptyStats() },
    run: null,
  };
}

function isMode(v: unknown): v is Mode {
  return typeof v === 'string' && (MODES as string[]).includes(v);
}

/** Defensive merge so a corrupted or older save never breaks the app. */
export function normalize(raw: unknown): SaveData {
  const base = emptySave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  if (isMode(r.lastMode)) base.lastMode = r.lastMode;
  if (r.stats && typeof r.stats === 'object') {
    for (const m of MODES) {
      const s = (r.stats as Record<string, Partial<ModeStats>>)[m];
      if (!s || typeof s !== 'object') continue;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
      base.stats[m] = {
        played: num(s.played),
        completed: num(s.completed),
        best: Math.min(20, num(s.best)),
        bestReached: Math.min(20, num(s.bestReached)),
        gamesStarted: num(s.gamesStarted),
        seen: s.seen && typeof s.seen === 'object' ? s.seen : {},
        recentRuns: Array.isArray(s.recentRuns) ? s.recentRuns.filter(Array.isArray).slice(0, 10) : [],
      };
    }
  }
  const run = r.run;
  if (
    run && isMode(run.mode) && Array.isArray(run.ids) && Array.isArray(run.orders) &&
    typeof run.index === 'number' && run.index >= 0 && run.index < run.ids.length &&
    run.orders.length === run.ids.length
  ) {
    base.run = run;
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
