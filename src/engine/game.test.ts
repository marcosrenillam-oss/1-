import { describe, expect, it } from 'vitest';
import { BANK, getQuestion } from '../data/questions';
import { MODES, RUN_LENGTH, SLOT_TIERS } from './difficulty';
import { abandonRun, startRun, startTimer, submitAnswer, sanitizeRun, timeLimitFor, timeoutRun } from './game';
import { seededRng } from './rng';
import { emptySave, normalize, type SaveData } from '../storage/persistence';

function correctPos(save: SaveData): number {
  const run = save.run!;
  const q = getQuestion(run.ids[run.index])!;
  return run.orders[run.index].indexOf(q.answer);
}
function wrongPos(save: SaveData): number {
  const run = save.run!;
  const q = getQuestion(run.ids[run.index])!;
  return run.orders[run.index].findIndex((i) => i !== q.answer);
}

describe('run generation', () => {
  for (const mode of MODES) {
    it(`${mode}: 20 unique questions, right mode, non-decreasing tiers`, () => {
      const rng = seededRng(42);
      let save = emptySave();
      for (let g = 0; g < 30; g++) {
        save = startRun(save, mode, rng);
        const ids = save.run!.ids;
        expect(ids).toHaveLength(RUN_LENGTH);
        expect(new Set(ids).size).toBe(RUN_LENGTH);
        const tiers = ids.map((id) => getQuestion(id)!.tier);
        tiers.forEach((t, i) => expect(t).toBe(SLOT_TIERS[i]));
        ids.forEach((id) => expect(getQuestion(id)!.mode).toBe(mode));
        save = abandonRun(save)!.save;
      }
    });
  }

  it('consecutive runs differ and never repeat a recent sequence', () => {
    const rng = seededRng(7);
    let save = emptySave();
    const runs: string[][] = [];
    for (let g = 0; g < 40; g++) {
      save = startRun(save, 'normal', rng);
      runs.push(save.run!.ids);
      save = abandonRun(save)!.save;
    }
    for (let i = 1; i < runs.length; i++) {
      for (let j = Math.max(0, i - 8); j < i; j++) {
        expect(runs[i].join()).not.toBe(runs[j].join());
      }
      const prev = new Set(runs[i - 1]);
      const shared = runs[i].filter((id) => prev.has(id)).length;
      expect(shared).toBeLessThanOrEqual(12);
    }
  });

  it('prioritises unseen questions', () => {
    const rng = seededRng(3);
    let save = emptySave();
    // Two full winning runs → 40 distinct questions shown when possible.
    const shown = new Set<string>();
    for (let g = 0; g < 2; g++) {
      save = startRun(save, 'dificil', rng);
      while (save.run) {
        shown.add(save.run.ids[save.run.index]);
        const out = submitAnswer(save, correctPos(save));
        save = out.save;
      }
    }
    // Tier 6 only has 5 questions and tier 5 has 8, so the two runs can share
    // at most a few; most of the 40 must be distinct.
    expect(shown.size).toBeGreaterThanOrEqual(36);
  });

  it('balances categories (no category more than 4 times, no back-to-back)', () => {
    const rng = seededRng(99);
    let save = emptySave();
    let backToBack = 0;
    for (let g = 0; g < 50; g++) {
      save = startRun(save, 'experto', rng);
      const cats = save.run!.ids.map((id) => getQuestion(id)!.category);
      const counts = new Map<string, number>();
      cats.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(4);
      for (let i = 1; i < cats.length; i++) if (cats[i] === cats[i - 1]) backToBack++;
      save = abandonRun(save)!.save;
    }
    expect(backToBack / 50).toBeLessThan(1); // rare, on average < 1 per run
  });
});

describe('variety', () => {
  it('never repeats a puzzle style inside a run (and rarely repeats a category back to back)', () => {
    for (const mode of MODES) {
      const rng = seededRng(77);
      let save = emptySave();
      let repeats = 0;
      for (let g = 0; g < 40; g++) {
        save = startRun(save, mode, rng);
        const qs = save.run!.ids.map((id) => getQuestion(id)!);
        const styles = qs.map((q) => q.style ?? q.category);
        repeats += styles.length - new Set(styles).size;
        save = abandonRun(save)!.save;
      }
      expect(repeats, mode).toBe(0);
    }
  });
});

describe('contrarreloj', () => {
  it('time limits are sensible', () => {
    for (const m of MODES) for (const q of BANK[m]) {
      const t = timeLimitFor(q);
      expect(t).toBeGreaterThanOrEqual(20);
      expect(t).toBeLessThanOrEqual(120);
    }
  });

  it('answering in time continues and accumulates time; winning records the best time', () => {
    let save = startRun(emptySave(), 'facil', seededRng(30), true);
    let now = 1_000_000;
    for (let i = 0; i < RUN_LENGTH; i++) {
      save = startTimer(save, now);
      expect(save.run!.timer!.index).toBe(i);
      expect(startTimer(save, now + 5)).toBe(save); // idempotent
      now += 3000;
      const out = submitAnswer(save, correctPos(save), now);
      save = out.save;
      if (i < RUN_LENGTH - 1) expect(out.kind).toBe('correct');
      else {
        expect(out.kind).toBe('victory');
        if (out.kind === 'victory') {
          expect(out.result.timed).toBe(true);
          expect(out.result.totalMs).toBe(60_000);
          expect(out.result.newBestTime).toBe(true);
        }
      }
    }
    expect(save.crono.facil).toMatchObject({ played: 1, completed: 1, best: 20, bestTimeMs: 60_000 });
    expect(save.stats.facil.played).toBe(0); // classic records untouched
  });

  it('running out of time ends the run', () => {
    let save = startRun(emptySave(), 'experto', seededRng(31), true);
    save = startTimer(save, 0);
    save = submitAnswer(save, correctPos(save), 1000).save;
    save = startTimer(save, 2000);
    const deadline = save.run!.timer!.deadline;
    expect(timeoutRun(save, deadline - 1)).toBeNull();
    const out = timeoutRun(save, deadline + 1)!;
    expect(out.result.timeout).toBe(true);
    expect(out.result.score).toBe(1);
    expect(out.save.run).toBeNull();
    expect(out.save.crono.experto).toMatchObject({ played: 1, best: 1 });
  });

  it('answering after the deadline counts as a timeout', () => {
    let save = startRun(emptySave(), 'normal', seededRng(32), true);
    save = startTimer(save, 0);
    const late = save.run!.timer!.deadline + 10;
    const out = submitAnswer(save, correctPos(save), late);
    expect(out.kind).toBe('wrong');
    if (out.kind === 'wrong') expect(out.result.timeout).toBe(true);
  });
});

describe('game flow', () => {
  it('correct answers advance; 20 correct answers is a victory', () => {
    let save = startRun(emptySave(), 'facil', seededRng(1));
    for (let i = 0; i < RUN_LENGTH - 1; i++) {
      const out = submitAnswer(save, correctPos(save));
      expect(out.kind).toBe('correct');
      save = out.save;
      expect(save.run!.index).toBe(i + 1);
    }
    const last = submitAnswer(save, correctPos(save));
    expect(last.kind).toBe('victory');
    if (last.kind !== 'victory') return;
    expect(last.save.run).toBeNull();
    expect(last.result.score).toBe(20);
    expect(last.result.newRecord).toBe(true);
    const s = last.save.stats.facil;
    expect(s).toMatchObject({ played: 1, completed: 1, best: 20, bestReached: 20 });
  });

  it('a wrong answer ends the run and records the score', () => {
    let save = startRun(emptySave(), 'normal', seededRng(5));
    for (let i = 0; i < 6; i++) save = submitAnswer(save, correctPos(save)).save;
    const out = submitAnswer(save, wrongPos(save));
    expect(out.kind).toBe('wrong');
    if (out.kind !== 'wrong') return;
    expect(out.save.run).toBeNull();
    expect(out.result.score).toBe(6);
    expect(out.result.reached).toBe(7);
    expect(out.result.newRecord).toBe(true);
    expect(out.save.stats.normal).toMatchObject({ played: 1, completed: 0, best: 6, bestReached: 7 });
    // Next run starts again from question 1.
    const again = startRun(out.save, 'normal', seededRng(6));
    expect(again.run!.index).toBe(0);
  });

  it('records are kept per difficulty', () => {
    let save = startRun(emptySave(), 'experto', seededRng(8));
    for (let i = 0; i < 3; i++) save = submitAnswer(save, correctPos(save)).save;
    save = submitAnswer(save, wrongPos(save)).save;
    expect(save.stats.experto.best).toBe(3);
    expect(save.stats.facil.best).toBe(0);
    expect(save.stats.normal.played).toBe(0);
    expect(save.lastMode).toBe('experto');
  });

  it('a lower score never lowers the record', () => {
    let save = startRun(emptySave(), 'facil', seededRng(10));
    for (let i = 0; i < 5; i++) save = submitAnswer(save, correctPos(save)).save;
    save = submitAnswer(save, wrongPos(save)).save;
    save = startRun(save, 'facil', seededRng(11));
    const out = submitAnswer(save, wrongPos(save));
    expect(out.kind).toBe('wrong');
    if (out.kind === 'wrong') expect(out.result.newRecord).toBe(false);
    expect(out.save.stats.facil.best).toBe(5);
    expect(out.save.stats.facil.played).toBe(2);
  });

  it('survives a save/load round trip (persistence)', () => {
    let save = startRun(emptySave(), 'dificil', seededRng(12));
    save = submitAnswer(save, correctPos(save)).save;
    const restored = sanitizeRun(normalize(JSON.parse(JSON.stringify(save))));
    expect(restored.run).toEqual(save.run);
    expect(restored.stats).toEqual(save.stats);
  });

  it('normalize tolerates garbage', () => {
    expect(normalize(null).stats.facil.played).toBe(0);
    expect(normalize({ lastMode: 'x', stats: 5, run: { mode: 'facil' } }).run).toBeNull();
  });

  it('option order is shuffled per question', () => {
    const save = startRun(emptySave(), 'normal', seededRng(13));
    const firstCorrect = save.run!.ids.map((id, i) => save.run!.orders[i].indexOf(getQuestion(id)!.answer));
    expect(new Set(firstCorrect).size).toBeGreaterThan(1);
  });

  it('every bank has enough material for the selector', () => {
    for (const m of MODES) expect(BANK[m].length).toBeGreaterThanOrEqual(50);
  });
});
