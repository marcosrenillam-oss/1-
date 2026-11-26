import { describe, expect, it } from 'vitest';
import { Quality, qualitySteps } from './quality';

const run = (q: Quality, secs: number, interval: number, work: number) => {
  for (let t = 0; t < secs * 1000; t += interval) q.sample(interval, work);
};

describe('adaptive quality', () => {
  it('never renders above 2× and ends at 1×', () => {
    const s = qualitySteps(3);
    expect(s[0]).toEqual({ dpr: 2, lite: false });
    expect(s[s.length - 1].dpr).toBe(1);
    expect(qualitySteps(1)).toEqual([{ dpr: 1, lite: false }, { dpr: 1, lite: true }]);
  });
  it('steps down when our frames are slow, and back up when there is headroom', () => {
    const q = new Quality(3);
    run(q, 2, 33, 20);
    expect(q.i).toBeGreaterThan(0);
    const low = q.i;
    run(q, 40, 16.7, 3);
    expect(q.i).toBeLessThan(low);
  });
  it('does not lose quality on a 30 Hz low-power cap when the work is light', () => {
    const q = new Quality(3);
    run(q, 10, 33.3, 2);
    expect(q.i).toBe(0);
  });
  it('120 Hz screens stay at full quality', () => {
    const q = new Quality(3);
    run(q, 10, 8.3, 4);
    expect(q.i).toBe(0);
  });
});
