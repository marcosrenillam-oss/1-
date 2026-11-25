import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupPWA } from './pwa';
import './styles/base.css';
import './styles/animations.css';
import './styles/home.css';
import './styles/game.css';
import './styles/result.css';
import './styles/invasion.css';
import './styles/fit.css';
import './styles/landscape.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setupPWA();

// Block every kind of zoom (pinch, Safari gestures, double tap): the app is
// designed to fit the screen exactly, like a native app.
const stop = (e: Event) => e.preventDefault();
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !(e.target instanceof HTMLElement && e.target.closest('button'))) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// iOS home-screen apps with a translucent status bar report a viewport that is
// short by the status bar's height, leaving an empty band at the bottom.
// Measure the real screen and size the app to it.
function fitViewport() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  let h = window.innerHeight;
  if (standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    const portrait = window.innerHeight >= window.innerWidth;
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    h = Math.max(h, full);
  }
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
fitViewport();
window.addEventListener('resize', fitViewport);
window.addEventListener('orientationchange', () => window.setTimeout(fitViewport, 120));

// Test hook (end-to-end tests only): enabled by a flag in local storage.
try {
  if (localStorage.getItem('uno-por-ciento:e2e') === '1') {
    void import('./data/questions').then(({ ALL_QUESTIONS, getQuestion }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__bank = () => ALL_QUESTIONS;
      w.__q = () => {
        const run = JSON.parse(localStorage.getItem('uno-por-ciento:v1') ?? '{}').run;
        return run ? { q: getQuestion(run.ids[run.index]), order: run.orders[run.index] } : null;
      };
    });
  }
} catch {
  /* storage unavailable */
}
