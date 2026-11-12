import type { Question, Tier } from '../data/types';
import { RUN_LENGTH, SLOT_TIERS } from './difficulty';
import { weightedPick, type Rng } from './rng';

export interface SeenInfo {
  /** Times the question has been shown. */
  count: number;
  /** Game number (gamesStarted counter) in which it was last shown. */
  last: number;
}

export interface SelectionHistory {
  seen: Record<string, SeenInfo>;
  gamesStarted: number;
  /** Question id lists of the most recent runs, newest first. */
  recentRuns: string[][];
}

const UNSEEN_WEIGHT = 12;
const MAX_ATTEMPTS = 14;
/** A new run may share at most this many questions with any recent run. */
const MAX_OVERLAP = 12;
const RECENT_COMPARE = 8;

function tierOrder(t: Tier): Tier[] {
  // Exact tier first, then the nearest ones (lower first: never jump the
  // difficulty up unexpectedly when a tier runs dry).
  const order: Tier[] = [t];
  for (let d = 1; d <= 5; d++) {
    const lo = t - d;
    const hi = t + d;
    if (lo >= 1) order.push(lo as Tier);
    if (hi <= 6) order.push(hi as Tier);
  }
  return order;
}

function questionWeight(q: Question, h: SelectionHistory, picked: Question[]): number {
  const seen = h.seen[q.id];
  let w: number;
  if (!seen) {
    w = UNSEEN_WEIGHT;
  } else {
    w = 1 / (1 + seen.count);
    const gamesAgo = h.gamesStarted - seen.last;
    if (gamesAgo <= 1) w *= 0.08;
    else if (gamesAgo <= 3) w *= 0.3;
  }
  // Category balance: penalise categories already present in this run, and
  // strongly avoid two consecutive questions of the same category.
  const sameCat = picked.reduce((n, p) => n + (p.category === q.category ? 1 : 0), 0);
  w *= Math.pow(0.2, sameCat);
  const prev = picked[picked.length - 1];
  if (prev && prev.category === q.category) w *= 0.15;
  return Math.max(w, 1e-6);
}

function buildOnce(pool: Question[], h: SelectionHistory, rng: Rng): Question[] {
  const picked: Question[] = [];
  const used = new Set<string>();
  for (let slot = 0; slot < RUN_LENGTH; slot++) {
    let candidates: Question[] = [];
    for (const t of tierOrder(SLOT_TIERS[slot])) {
      candidates = pool.filter((q) => q.tier === t && !used.has(q.id));
      if (candidates.length) break;
    }
    if (!candidates.length) break; // bank too small (guarded by tests)
    const weights = candidates.map((q) => questionWeight(q, h, picked));
    const choice = weightedPick(candidates, weights, rng);
    picked.push(choice);
    used.add(choice.id);
  }
  return picked;
}

function maxOverlap(ids: string[], recent: string[][]): number {
  let max = 0;
  for (const r of recent.slice(0, RECENT_COMPARE)) {
    const set = new Set(r);
    let n = 0;
    for (const id of ids) if (set.has(id)) n++;
    if (n > max) max = n;
  }
  return max;
}

function sameSequence(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Builds a 20-question run for one mode:
 * - no repeats inside a run,
 * - tier progression per slot (with nearest-tier fallback),
 * - unseen questions strongly preferred, recently seen ones de-prioritised,
 * - balanced categories and no back-to-back category,
 * - rejects runs too similar to recent runs (never an identical sequence).
 */
export function selectRun(pool: Question[], h: SelectionHistory, rng: Rng): string[] {
  let best: string[] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ids = buildOnce(pool, h, rng).map((q) => q.id);
    if (h.recentRuns.some((r) => sameSequence(r, ids))) continue;
    const overlap = maxOverlap(ids, h.recentRuns);
    if (overlap <= MAX_OVERLAP) return ids;
    if (overlap < bestScore) {
      best = ids;
      bestScore = overlap;
    }
  }
  return best ?? buildOnce(pool, h, rng).map((q) => q.id);
}
