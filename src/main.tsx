import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupPWA } from './pwa';
import './styles/base.css';
import './styles/animations.css';
import './styles/home.css';
import './styles/game.css';
import './styles/result.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setupPWA();

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
