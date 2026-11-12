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
