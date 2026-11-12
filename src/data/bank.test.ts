import { describe, expect, it } from 'vitest';
import { BANK, TOTAL_QUESTIONS } from './questions';
import { CATEGORY_LABEL, type Category, type Tier } from './types';
import { MODES, SLOT_TIERS } from '../engine/difficulty';

const TOKEN = /\{([a-z0-9-]+)\}/g;
const SHAPES = new Set([
  'sq', 'sqo', 'ci', 'cio', 'tr', 'tro', 'trd', 'trdo', 'di', 'dio', 'st', 'sto',
  'ar-u', 'ar-ur', 'ar-r', 'ar-dr', 'ar-d', 'ar-dl', 'ar-l', 'ar-ul',
  'hc-t', 'hc-r', 'hc-b', 'hc-l',
]);
function tokensValid(text: string) {
  for (const m of text.matchAll(TOKEN)) {
    const t = m[1];
    if (SHAPES.has(t)) continue;
    if (/^g-[01]{9}$/.test(t)) continue;
    return false;
  }
  return true;
}

describe('question bank', () => {
  it('has at least 200 questions', () => {
    expect(TOTAL_QUESTIONS).toBeGreaterThanOrEqual(200);
  });

  it('has unique ids across all modes', () => {
    const ids = MODES.flatMap((m) => BANK[m].map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const mode of MODES) {
    describe(mode, () => {
      const list = BANK[mode];

      it('every question belongs to its mode and is well formed', () => {
        for (const q of list) {
          expect(q.mode).toBe(mode);
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options).size, `${q.id} duplicated options`).toBe(4);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(4);
          expect(q.prompt.trim().length).toBeGreaterThan(5);
          expect(q.explanation.trim().length).toBeGreaterThan(5);
          expect(Object.keys(CATEGORY_LABEL)).toContain(q.category);
          const texts = [q.prompt, ...q.options, ...(q.visual ?? [])];
          for (const t of texts) expect(tokensValid(t), `${q.id}: bad token in "${t}"`).toBe(true);
        }
      });

      it('has no duplicated prompts+visuals', () => {
        const keys = list.map((q) => q.prompt + '|' + (q.visual ?? []).join('/'));
        expect(new Set(keys).size).toBe(keys.length);
      });

      it('has enough questions in every tier for several distinct runs', () => {
        const need: Record<number, number> = {};
        for (const t of SLOT_TIERS) need[t] = (need[t] ?? 0) + 1;
        for (const [tier, n] of Object.entries(need)) {
          const have = list.filter((q) => q.tier === (Number(tier) as Tier)).length;
          expect(have, `${mode} tier ${tier}`).toBeGreaterThanOrEqual(n * 2 + 1);
        }
      });

      it('covers all ten categories', () => {
        const cats = new Set<Category>(list.map((q) => q.category));
        expect(cats.size).toBe(10);
      });
    });
  }
});
