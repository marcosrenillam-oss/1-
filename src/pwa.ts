import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker that precaches the whole app (HTML, JS, CSS,
 * fonts, icons). After the first full load, the game works fully offline.
 */
export function setupPWA() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
