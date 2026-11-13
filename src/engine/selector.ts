import { BANK, getQuestion } from '../data/questions';
import type { Level, Question, Tier } from '../data/types';
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

export interface SlotReq {
  level: Level;
  tier: Tier;
}

const UNSEEN_WEIGHT = 12;
const MAX_ATTEMPTS = 10;
const RECENT_COMPARE = 8;
/** A puzzle style never repeats within this many consecutive questions. */
export const STYLE_WINDOW = 20;

const styleOf = (q: Question) => q.style ?? q.category;

function tierOrder(t: Tier): Tier[] {
  // Exact tier first, then the nearest ones (lower first).
  const order: Tier[] = [t];
  for (let d = 1; d <= 5; d++) {
    if (t - d >= 1) order.push((t - d) as Tier);
    if (t + d <= 6) order.push((t + d) as Tier);
  }
  return order;
}

function weight(q: Question, h: SelectionHistory, recent: Question[]): number {
  const seen = h.seen[q.id];
  let w: number;
  if (!seen) w = UNSEEN_WEIGHT;
  else {
    w = 1 / (1 + seen.count);
    const ago = h.gamesStarted - seen.last;
    if (ago <= 1) w *= 0.08;
    else if (ago <= 3) w *= 0.3;
  }
  const sameCat = recent.reduce((n, p) => n + (p.category === q.category ? 1 : 0), 0);
  w *= Math.pow(0.35, sameCat);
  return Math.max(w, 1e-12);
}

/**
 * Picks one question per slot:
 * - never the same question twice (nor any id in `exclude`),
 * - exact level and tier (nearest tier as fallback),
 * - a style never repeats within STYLE_WINDOW questions, and never two of the
 *   same category in a row (relaxed only if a pool runs dry),
 * - unseen questions strongly preferred, recently seen ones de-prioritised.
 * `previous` are questions already shown just before (they count for variety).
 */
function buildOnce(slots: SlotReq[], h: SelectionHistory, rng: Rng, previous: Question[], exclude: Set<string>, pool?: (s: SlotReq) => Question[]): Question[] {
  const picked: Question[] = [];
  const used = new Set(exclude);
  for (const slot of slots) {
    const levelPool = pool ? pool(slot) : BANK[slot.level];
    let cands: Question[] = [];
    for (const t of tierOrder(slot.tier)) {
      cands = levelPool.filter((q) => q.tier === t && !used.has(q.id));
      if (cands.length) break;
    }
    if (!cands.length) cands = levelPool.filter((q) => !used.has(q.id));
    if (!cands.length) break;
    const recent = [...previous, ...picked].slice(-(STYLE_WINDOW - 1));
    const styles = new Set(recent.map(styleOf));
    const fresh = cands.filter((q) => !styles.has(styleOf(q)));
    if (fresh.length) cands = fresh;
    const prevCat = recent[recent.length - 1]?.category;
    const other = cands.filter((q) => q.category !== prevCat);
    if (other.length) cands = other;
    const choice = weightedPick(cands, cands.map((q) => weight(q, h, recent)), rng);
    picked.push(choice);
    used.add(choice.id);
  }
  return picked;
}

function maxOverlap(ids: string[], recent: string[][]): number {
  let max = 0;
  for (const r of recent.slice(0, RECENT_COMPARE)) {
    const set = new Set(r);
    max = Math.max(max, ids.filter((id) => set.has(id)).length);
  }
  return max;
}

export interface SelectOptions {
  previous?: string[];
  exclude?: string[];
  /** Custom candidate pool per slot (e.g. boss questions). */
  pool?: (s: SlotReq) => Question[];
}

/** Selects question ids for the given slots; avoids near-repeats of recent runs. */
export function selectSlots(slots: SlotReq[], h: SelectionHistory, rng: Rng, opts: SelectOptions = {}): string[] {
  const previous = (opts.previous ?? []).map(getQuestion).filter((q): q is Question => !!q);
  const exclude = new Set(opts.exclude ?? []);
  const limit = Math.max(1, Math.floor(slots.length * 0.6));
  let best: string[] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < (slots.length > 1 ? MAX_ATTEMPTS : 1); attempt++) {
    const ids = buildOnce(slots, h, rng, previous, exclude, opts.pool).map((q) => q.id);
    const overlap = slots.length > 1 ? maxOverlap(ids, h.recentRuns) : 0;
    if (overlap <= limit && !h.recentRuns.some((r) => r.join() === ids.join())) return ids;
    if (overlap < bestScore) {
      best = ids;
      bestScore = overlap;
    }
  }
  return best ?? [];
}
