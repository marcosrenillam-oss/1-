import { registerSW } from 'virtual:pwa-register';

/**
 * Service worker: precaches the whole app so it works offline, and keeps it
 * up to date automatically.
 *
 * - Every time the app is opened or comes back to the foreground, it checks
 *   for a new version (only when online).
 * - A new version is applied with a quick reload, but only on the home
 *   screen: never in the middle of a game or over a result screen.
 */
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let updateReady = false;
let safeToUpdate = true;

function maybeApply() {
  if (updateReady && safeToUpdate && applyUpdate) {
    updateReady = false;
    void applyUpdate(true);
  }
}

/** Called by the app whenever the screen changes. */
export function setSafeToUpdate(safe: boolean) {
  safeToUpdate = safe;
  maybeApply();
}

export function setupPWA() {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      maybeApply();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 30 * 60 * 1000);
    },
  });
}
