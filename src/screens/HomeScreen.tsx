import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { MAX_RUN } from '../engine/difficulty';
import { COLORS, tierOf } from '../engine/core';
import type { SaveData } from '../storage/persistence';
import { Chip } from '../components/Chip';
import { Logo } from '../components/Logo';

export type HubTarget = 'questions' | 'invasion' | 'core';

interface Props {
  save: SaveData;
  onOpen: (t: HubTarget) => void;
}

function Branch({ i, label, title, sub, badge, art, onClick, accent }: { i: number; label: string; title: string; sub: string; badge?: string; art: ReactNode; onClick: () => void; accent?: string }) {
  return (
    <li className="hub-branch reveal" style={{ ['--d' as string]: `${520 + i * 110}ms`, ['--i' as string]: i, ...(accent ? { ['--b' as string]: accent } : {}) }}>
      <span className="hub-node" aria-hidden="true" />
      <button type="button" className="hub-card" onClick={onClick} aria-label={`${title}: ${sub}`}>
        <span className="hub-art" aria-hidden="true">
          {art}
        </span>
        <span className="hub-text">
          <span className="eyebrow">{label}</span>
          <span className="hub-title display">{title}</span>
          <span className="hub-sub tnum">{sub}</span>
        </span>
        {badge && <span className="hub-badge">{badge}</span>}
        <svg className="hub-chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  );
}

const QuestionsArt = () => (
  <svg viewBox="0 0 48 48">
    <rect x="6" y="8" width="36" height="26" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
    <path d="M16 34 L14 42 L24 34" fill="currentColor" />
    <path d="M19.5 17.5a4.5 4.5 0 1 1 6.3 4.1c-1.2.6-1.8 1.4-1.8 2.6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="29" r="1.9" fill="currentColor" />
  </svg>
);

const VirusArt = () => (
  <svg viewBox="0 0 48 48" className="hub-virus">
    <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return (
          <g key={k}>
            <line x1={24 + Math.cos(a) * 11} y1={24 + Math.sin(a) * 11} x2={24 + Math.cos(a) * 18} y2={24 + Math.sin(a) * 18} />
            <circle cx={24 + Math.cos(a) * 19.5} cy={24 + Math.sin(a) * 19.5} r="2.2" fill="currentColor" stroke="none" />
          </g>
        );
      })}
    </g>
    <circle cx="24" cy="24" r="11" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.6" />
    <circle cx="26" cy="22" r="4" fill="currentColor" />
  </svg>
);

/** Home: the 1% and its three branches. */
export function HomeScreen({ save, onOpen }: Props) {
  const rec = Math.max(save.records.normal.classic.best, save.records.dificil.classic.best);
  const inv = save.invasion;
  const core = save.core;
  const color = COLORS.find((c) => c.id === core.color)?.hex ?? '#c8ff2e';
  const tree = useRef<HTMLElement>(null);
  // The trunk runs from under the logo to the last branch's node.
  useLayoutEffect(() => {
    const el = tree.current;
    if (!el) return;
    const fit = () => {
      const nodes = el.querySelectorAll('.hub-node');
      const last = nodes[nodes.length - 1];
      if (!last) return;
      const a = el.getBoundingClientRect();
      const b = last.getBoundingClientRect();
      el.style.setProperty('--trunk-end', `${Math.max(0, a.bottom - (b.top + b.height / 2))}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="screen-inner hub">
      <header className="home-top reveal" style={{ ['--d' as string]: '0ms' }}>
        <span className="eyebrow">Desafío de lógica</span>
        <span className="eyebrow home-count tnum">⚡ {core.energy.toLocaleString('es-ES')}</span>
      </header>

      <section className="hub-hero">
        <Logo size={120} />
        <p className="home-tagline reveal" style={{ ['--d' as string]: '420ms' }}>
          Solo el 1 % llega al final.
        </p>
      </section>

      <nav className="hub-tree" aria-label="Juegos" ref={tree}>
        <span className="hub-trunk" aria-hidden="true">
          <span className="hub-spark" />
        </span>
        <ul className="hub-list">
        <Branch
          i={0}
          label="Lógica"
          title="Preguntas"
          sub={rec ? `Clásico y aventura · récord ${rec}/${MAX_RUN}` : 'Clásico y aventura'}
          art={<QuestionsArt />}
          onClick={() => onOpen('questions')}
        />
        <Branch
          i={1}
          label="Modo infinito"
          title="Invasión"
          sub={inv.run ? `Continuar · oleada ${inv.run.wave + 1}` : inv.bestWave ? `Defiende el núcleo · mejor oleada ${inv.bestWave}` : 'Defiende el núcleo de los virus'}
          badge={inv.played === 0 && !inv.run ? 'Nuevo' : undefined}
          art={<VirusArt />}
          accent="#ff3b5c"
          onClick={() => onOpen('invasion')}
        />
        <Branch
          i={2}
          label={`Chip nivel ${core.chip} · ${tierOf(core.chip).name}`}
          title="Tu Núcleo"
          sub={`Construye y evoluciona · ⚡ ${core.energy.toLocaleString('es-ES')}`}
          art={<Chip core={core} className="hub-chip" />}
          accent={color}
          onClick={() => onOpen('core')}
        />
        </ul>
      </nav>
    </div>
  );
}
