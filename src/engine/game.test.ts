import { describe, expect, it } from 'vitest';
import { BANK, getQuestion } from '../data/questions';
import type { Question } from '../data/types';
import { MAX_RUN, MODES, runSlot, STAGE_LEN, WORLD_LEVELS } from './difficulty';
import {
  abandonRun, bossPool, checkResponse, sanitizeRun, startAdventure, startRun, startTimer, submitAnswer, timeLimitFor, timeoutRun,
} from './game';
import { seededRng } from './rng';
import { STYLE_WINDOW } from './selector';
import { emptySave, normalize, type SaveData } from '../storage/persistence';

/** The response that answers the current question correctly. */
function rightResponse(save: SaveData): number | string {
  const run = save.run!;
  const q = getQuestion(run.ids[run.index])!;
  const order = run.orders[run.index];
  switch (q.kind ?? 'choice') {
    case 'choice': return order.indexOf(q.answer);
    case 'order': return q.items!.join('|');
    case 'tap': return String(q.cell);
    case 'memory': return q.seq!.join(',');
    case 'paint': return q.target!;
  }
}
function wrongResponse(save: SaveData): number | string {
  const run = save.run!;
  const q = getQuestion(run.ids[run.index])!;
  const order = run.orders[run.index];
  switch (q.kind ?? 'choice') {
    case 'choice': return order.findIndex((i) => i !== q.answer);
    case 'order': return [...q.items!].reverse().join('|');
    case 'tap': return String((q.cell! + 1) % 9);
    case 'memory': return '99';
    case 'paint': return q.target!.replace(/./g, (c) => (c === '1' ? '0' : '1'));
  }
}

describe('runs of 100', () => {
  for (const mode of MODES) {
    it(`${mode}: 100 unique questions following level and tier of each slot`, () => {
      let save = startRun(emptySave(), mode, seededRng(1));
      const ids = save.run!.ids;
      expect(ids).toHaveLength(MAX_RUN);
      expect(new Set(ids).size).toBe(MAX_RUN);
      ids.forEach((id, i) => {
        const q = getQuestion(id)!;
        const s = runSlot(mode, i);
        expect(q.level, `slot ${i}`).toBe(s.level);
        expect(q.tier, `slot ${i}`).toBe(s.tier);
      });
      save = abandonRun(save)!.save;
    });

    it(`${mode}: no style repeats within ${STYLE_WINDOW} questions, no category twice in a row`, () => {
      const rng = seededRng(5);
      let save = emptySave();
      for (let g = 0; g < 8; g++) {
        save = startRun(save, mode, rng);
        const qs = save.run!.ids.map((id) => getQuestion(id)!);
        for (let i = 0; i < qs.length; i++) {
          const win = qs.slice(Math.max(0, i - STYLE_WINDOW + 1), i);
          expect(win.map((q) => q.style ?? q.category)).not.toContain(qs[i].style ?? qs[i].category);
          if (i > 0) expect(qs[i].category).not.toBe(qs[i - 1].category);
        }
        save = abandonRun(save)!.save;
      }
    });
  }

  it('difficulty jumps every 20 questions', () => {
    expect([0, 20, 40, 60, 80].map((i) => runSlot('normal', i).level)).toEqual([1, 2, 3, 4, 5]);
    expect([0, 20, 40, 60, 80].map((i) => runSlot('dificil', i).level)).toEqual([3, 4, 5, 6, 7]);
    expect(runSlot('normal', 19).tier).toBe(6);
    expect(runSlot('normal', 20).tier).toBe(1);
  });

  it('20 correct is a phase clear and the run continues; 100 is a full victory', () => {
    let save = startRun(emptySave(), 'normal', seededRng(2));
    const cleared: number[] = [];
    for (let i = 0; i < MAX_RUN - 1; i++) {
      const out = submitAnswer(save, rightResponse(save));
      expect(out.kind).toBe('correct');
      if (out.kind === 'correct' && out.stageCleared) cleared.push(out.stageCleared);
      save = out.save;
    }
    expect(cleared).toEqual([1, 2, 3, 4]);
    const last = submitAnswer(save, rightResponse(save));
    expect(last.kind).toBe('victory');
    if (last.kind !== 'victory') return;
    expect(last.result).toMatchObject({ score: 100, complete: true, stages: 5, won: true });
    expect(last.save.records.normal.classic).toMatchObject({ played: 1, completed: 1, best: 100, bestStage: 5 });
  });

  it('a mistake after phase 1 ends the run but still counts as a victory', () => {
    let save = startRun(emptySave(), 'dificil', seededRng(3));
    for (let i = 0; i < 27; i++) save = submitAnswer(save, rightResponse(save)).save;
    const out = submitAnswer(save, wrongResponse(save));
    expect(out.kind).toBe('wrong');
    if (out.kind !== 'wrong') return;
    expect(out.result).toMatchObject({ score: 27, reached: 28, won: true, stages: 1 });
    expect(out.save.run).toBeNull();
    expect(out.save.records.dificil.classic).toMatchObject({ played: 1, completed: 1, best: 27, bestStage: 1 });
    expect(out.save.records.normal.classic.played).toBe(0);
  });

  it('a mistake before 20 is a defeat', () => {
    let save = startRun(emptySave(), 'normal', seededRng(4));
    for (let i = 0; i < 5; i++) save = submitAnswer(save, rightResponse(save)).save;
    const out = submitAnswer(save, wrongResponse(save));
    if (out.kind !== 'wrong') throw new Error('expected wrong');
    expect(out.result.won).toBe(false);
    expect(out.save.records.normal.classic).toMatchObject({ played: 1, completed: 0, best: 5 });
  });

  it('abandoning keeps the score reached', () => {
    let save = startRun(emptySave(), 'normal', seededRng(6));
    for (let i = 0; i < 22; i++) save = submitAnswer(save, rightResponse(save)).save;
    const out = abandonRun(save)!;
    expect(out.result).toMatchObject({ score: 22, abandoned: true, won: true });
  });

  it('round-trips through storage', () => {
    let save = startRun(emptySave(), 'dificil', seededRng(7));
    save = submitAnswer(save, rightResponse(save)).save;
    const restored = sanitizeRun(normalize(JSON.parse(JSON.stringify(save))));
    expect(restored.run).toEqual(save.run);
    expect(restored.records).toEqual(save.records);
  });
});

describe('contrarreloj', () => {
  it('time limits are sensible for every question', () => {
    for (const lvl of Object.values(BANK)) for (const q of lvl) {
      const t = timeLimitFor(q);
      expect(t).toBeGreaterThanOrEqual(20);
      expect(t).toBeLessThanOrEqual(120);
    }
  });

  it('records the time of the first phase and keeps separate records', () => {
    let save = startRun(emptySave(), 'normal', seededRng(8), true);
    let now = 1_000_000;
    for (let i = 0; i < STAGE_LEN; i++) {
      save = startTimer(save, now);
      expect(startTimer(save, now + 5)).toBe(save);
      now += 2000;
      save = submitAnswer(save, rightResponse(save), now).save;
    }
    expect(save.run!.phase1Ms).toBe(40_000);
    save = startTimer(save, now);
    const out = timeoutRun(save, save.run!.timer!.deadline + 1)!;
    expect(out.result).toMatchObject({ timeout: true, score: 20, won: true, newBestTime: true });
    expect(out.save.records.normal.crono).toMatchObject({ played: 1, completed: 1, bestTimeMs: 40_000 });
    expect(out.save.records.normal.classic.played).toBe(0);
  });

  it('answering after the deadline counts as a timeout', () => {
    let save = startRun(emptySave(), 'dificil', seededRng(9), true);
    save = startTimer(save, 0);
    const out = submitAnswer(save, rightResponse(save), save.run!.timer!.deadline + 10);
    expect(out.kind).toBe('wrong');
    if (out.kind === 'wrong') expect(out.result.timeout).toBe(true);
  });
});

describe('adventure', () => {
  it('passing a level advances 1 %; failing keeps you on it', () => {
    let save = startAdventure(emptySave(), seededRng(10))!;
    expect(save.run).toMatchObject({ type: 'adventure', world: 0, level: 1, boss: false });
    let out = submitAnswer(save, rightResponse(save));
    expect(out.kind).toBe('victory');
    expect(out.save.adventure.level).toBe(2);
    save = startAdventure(out.save, seededRng(11))!;
    out = submitAnswer(save, wrongResponse(save));
    expect(out.kind).toBe('wrong');
    expect(out.save.adventure.level).toBe(2);
    expect(out.save.run).toBeNull();
  });

  it('100 levels lead to a boss; beating it opens the next world; 5 worlds finish the adventure', () => {
    let save = emptySave();
    const rng = seededRng(12);
    const seen = new Set<string>();
    for (let w = 0; w < 5; w++) {
      save.adventure.level = WORLD_LEVELS; // jump near the end of the world
      save = startAdventure(save, rng)!;
      save = submitAnswer(save, rightResponse(save)).save;
      expect(save.adventure.level).toBe(WORLD_LEVELS + 1);
      save = startAdventure(save, rng)!;
      expect(save.run!.boss).toBe(true);
      const boss = getQuestion(save.run!.ids[0])!;
      expect(bossPool(w).map((q) => q.id)).toContain(boss.id);
      seen.add(boss.id);
      const out = submitAnswer(save, rightResponse(save));
      if (out.kind !== 'victory') throw new Error('boss should be beaten');
      expect(out.result.worldCleared).toBe(true);
      save = out.save;
    }
    expect(save.adventure.finished).toBe(true);
    expect(startAdventure(save, rng)).toBeNull();
  });

  it('consecutive adventure levels vary in style', () => {
    let save = emptySave();
    const rng = seededRng(13);
    const styles: string[] = [];
    for (let i = 0; i < 40; i++) {
      save = startAdventure(save, rng)!;
      const q = getQuestion(save.run!.ids[0])!;
      styles.push(q.style ?? q.category);
      save = submitAnswer(save, rightResponse(save)).save;
    }
    for (let i = 1; i < styles.length; i++) expect(styles.slice(Math.max(0, i - 10), i)).not.toContain(styles[i]);
  });
});

describe('interactive answers', () => {
  const find = (k: Question['kind']) => Object.values(BANK).flat().find((q) => q.kind === k)!;
  it('order / tap / memory / paint are checked exactly', () => {
    const o = find('order');
    expect(checkResponse(o, [], o.items!.join('|'))).toBe(true);
    expect(checkResponse(o, [], [...o.items!].reverse().join('|'))).toBe(false);
    const t = find('tap');
    expect(checkResponse(t, [], String(t.cell))).toBe(true);
    const m = Object.values(BANK).flat().find((q) => q.kind === 'memory' && !q.ordered)!;
    expect(checkResponse(m, [], [...m.seq!].reverse().join(','))).toBe(true);
    const p = find('paint');
    expect(checkResponse(p, [], p.target!)).toBe(true);
    expect(checkResponse(p, [], '000000000')).toBe(false);
  });
});

describe('migration', () => {
  it('keeps seen history and records from the first save format', () => {
    const v1 = {
      version: 1,
      lastMode: 'normal',
      stats: {
        facil: { played: 3, completed: 1, best: 20, bestReached: 20, gamesStarted: 3, seen: { f01: { count: 2, last: 3 } }, recentRuns: [] },
        normal: { played: 2, completed: 0, best: 9, bestReached: 10, gamesStarted: 2, seen: { n01: { count: 1, last: 2 } }, recentRuns: [] },
      },
      run: null,
    };
    const s = normalize(v1);
    expect(s.version).toBe(2);
    expect(s.history.seen.f01.count).toBe(2);
    expect(s.history.seen.n01.count).toBe(1);
    expect(s.records.normal.classic.best).toBe(9);
    expect(normalize(null).run).toBeNull();
  });
});
