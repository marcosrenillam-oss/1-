export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Animation-coupled delay: collapses when the user prefers reduced motion. */
export function motionMs(ms: number, reducedMs = 0): number {
  return prefersReducedMotion() ? reducedMs : ms;
}
