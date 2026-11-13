/**
 * Light haptic feedback.
 * - Android / browsers with the Vibration API: navigator.vibrate.
 * - iPhone (iOS 18+): toggling a native <input type="checkbox" switch>
 *   produces the system haptic tick. Elsewhere it silently does nothing.
 */
let label: HTMLLabelElement | null = null;

function iosTick() {
  if (!label) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.id = 'haptic-switch';
    label = document.createElement('label');
    label.htmlFor = 'haptic-switch';
    for (const el of [input, label]) {
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
      Object.assign(el.style, { position: 'fixed', left: '-100px', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
    }
    document.body.append(input, label);
  }
  label.click();
}

export type HapticKind = 'tap' | 'success' | 'error' | 'heavy';

export function haptic(kind: HapticKind = 'tap') {
  try {
    // Browsers reject haptics before the first user gesture (and log an error).
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'error' ? [30, 50, 30] : kind === 'success' ? [12, 40, 12] : kind === 'heavy' ? 45 : 8);
      return;
    }
    const n = kind === 'success' ? 2 : kind === 'error' ? 3 : kind === 'heavy' ? 2 : 1;
    for (let i = 0; i < n; i++) window.setTimeout(iosTick, i * 80);
  } catch {
    /* haptics are optional */
  }
}
