/**
 * Adaptive quality: keeps Invasión fluid however busy the board gets.
 *
 * It watches the real frame interval and how long our own update + draw take.
 * When frames run slow *and* the work is ours (not a 30 Hz low-power cap), it
 * steps down: first «lite» effects, then a lower canvas resolution. When there
 * is headroom again for a while, it steps back up.
 */
export interface QualityStep {
  dpr: number;
  lite: boolean;
}

export function qualitySteps(deviceDpr: number): QualityStep[] {
  // Above 2× the extra pixels are invisible on a phone but cost 2.25× the fill.
  const base = Math.max(1, Math.min(2, deviceDpr || 1));
  const steps: QualityStep[] = [
    { dpr: base, lite: false },
    { dpr: base, lite: true },
  ];
  for (const d of [1.6, 1.3, 1]) if (d < base - 0.05) steps.push({ dpr: d, lite: true });
  return steps;
}

export class Quality {
  steps: QualityStep[];
  i = 0;
  private frame = 16.7;
  private work = 4;
  private bad = 0;
  private good = 0;
  private cool = 0;
  constructor(deviceDpr: number) {
    this.steps = qualitySteps(deviceDpr);
  }
  get step(): QualityStep {
    return this.steps[this.i];
  }
  /**
   * Feed one frame: interval since the last frame and our own busy time (ms).
   * Returns true when the step changed.
   */
  sample(intervalMs: number, workMs: number): boolean {
    if (intervalMs > 120 || intervalMs <= 0) return false; // tab switch, pause, hiccup
    this.frame += (intervalMs - this.frame) * 0.1;
    this.work += (workMs - this.work) * 0.1;
    const sec = intervalMs / 1000;
    this.cool = Math.max(0, this.cool - sec);
    // Slow frames that we cause (work heavy, or frames far below 60 fps).
    const slow = this.frame > 20.5 && (this.work > 6 || this.frame > 40);
    const fast = this.frame < 17.8 && this.work < 7;
    this.bad = slow ? this.bad + sec : Math.max(0, this.bad - sec * 2);
    this.good = fast ? this.good + sec : 0;
    if (this.bad > 0.5 && this.i < this.steps.length - 1) {
      this.i++;
      this.bad = 0;
      this.good = 0;
      this.cool = 8;
      this.frame = 16.7;
      this.work = 4;
      return true;
    }
    if (this.good > 5 && this.cool <= 0 && this.i > 0) {
      this.i--;
      this.good = 0;
      this.cool = 4;
      return true;
    }
    return false;
  }
}
