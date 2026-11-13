import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS, BANK, TOTAL_QUESTIONS } from './questions';
import { CATEGORY_LABEL, LEVELS, type Question } from './types';
import { SLOT_TIERS } from '../engine/difficulty';
import { bossPool } from '../engine/game';
import { generateAll } from './gen';
import GENERATED from './questions/generated.json';

const TOKEN = /\{([a-z0-9-]+)\}/g;
const SHAPES = new Set([
  'sq', 'sqo', 'ci', 'cio', 'tr', 'tro', 'trd', 'trdo', 'di', 'dio', 'st', 'sto',
  'ar-u', 'ar-ur', 'ar-r', 'ar-dr', 'ar-d', 'ar-dl', 'ar-l', 'ar-ul',
  'hc-t', 'hc-r', 'hc-b', 'hc-l',
]);
const tokensValid = (text: string) => [...text.matchAll(TOKEN)].every((m) => SHAPES.has(m[1]) || /^g-[01]{9}$/.test(m[1]));

function wellFormed(q: Question) {
  expect(q.prompt.trim().length, q.id).toBeGreaterThan(5);
  expect(q.explanation.trim().length, q.id).toBeGreaterThan(5);
  expect(Object.keys(CATEGORY_LABEL), q.id).toContain(q.category);
  for (const t of [q.prompt, ...q.options, ...(q.visual ?? [])]) expect(tokensValid(t), `${q.id}: ${t}`).toBe(true);
  switch (q.kind ?? 'choice') {
    case 'choice':
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(q.answer).toBe(0);
      break;
    case 'order':
      expect(q.items!.length, q.id).toBeGreaterThanOrEqual(3);
      expect(new Set(q.items).size, q.id).toBe(q.items!.length);
      break;
    case 'tap': {
      const cells = (q.visual ?? []).flatMap((r) => r.trim().split(/\s+/));
      expect(q.cell!, q.id).toBeLessThan(cells.length);
      break;
    }
    case 'memory':
      expect(q.seq!.every((c) => c >= 0 && c < q.size! * q.size!), q.id).toBe(true);
      break;
    case 'paint':
      expect(q.target, q.id).toMatch(/^[01]{9}$/);
      break;
  }
}

describe('question bank', () => {
  it('has well over 3000 questions with unique ids', () => {
    expect(TOTAL_QUESTIONS).toBeGreaterThanOrEqual(3500);
    expect(new Set(ALL_QUESTIONS.map((q) => q.id)).size).toBe(ALL_QUESTIONS.length);
  });

  it('every question is well formed', () => {
    for (const q of ALL_QUESTIONS) wellFormed(q);
  });

  it('contains no algebra (no unknowns like «x + 5 = 12»)', () => {
    for (const q of ALL_QUESTIONS) expect(q.prompt, q.id).not.toMatch(/\b[xy]\s*[+\-=²]|\bx²|ecuación/);
  });

  it('generated.json is up to date with the generators', () => {
    expect(generateAll()).toEqual(GENERATED);
  });

  it('has bosses for every world', () => {
    for (let w = 0; w < 5; w++) expect(bossPool(w).length, `world ${w}`).toBeGreaterThanOrEqual(30);
    expect(ALL_QUESTIONS.filter((q) => q.boss).length).toBeGreaterThanOrEqual(10);
  });

  for (const level of LEVELS) {
    describe(`level ${level}`, () => {
      const list = BANK[level];
      it('has no duplicated questions', () => {
        const keys = list.map((q) => `${q.prompt}|${(q.visual ?? []).join('/')}|${[...q.options].sort().join('/')}|${JSON.stringify([q.items, q.cell, q.seq, q.target])}`);
        expect(new Set(keys).size).toBe(keys.length);
      });
      it('has plenty of questions in every tier', () => {
        const need: Record<number, number> = {};
        for (const t of SLOT_TIERS) need[t] = (need[t] ?? 0) + 1;
        for (const [tier, n] of Object.entries(need)) expect(list.filter((q) => q.tier === Number(tier)).length, `tier ${tier}`).toBeGreaterThanOrEqual(n * 8);
      });
      it('offers many puzzle styles and touch games', () => {
        expect(new Set(list.map((q) => q.style ?? q.category)).size).toBeGreaterThanOrEqual(60);
        expect(list.filter((q) => (q.kind ?? 'choice') !== 'choice').length).toBeGreaterThanOrEqual(50);
      });
    });
  }
});
