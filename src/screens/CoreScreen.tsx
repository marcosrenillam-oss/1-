import { useState } from 'react';
import {
  ANIMS, BOARD_COST, buyOrEquip, COLORS, coreLevel, expand, MATERIALS, MODULES, nextBoard, PINS, place, placeCost, upgrade, upgradeCost,
  type CoreState, type Kind,
} from '../engine/core';
import { Chip } from '../components/Chip';
import { IconBack } from '../components/Icons';
import { haptic } from '../haptics';

interface Props {
  core: CoreState;
  onChange: (c: CoreState) => void;
  onHome: () => void;
}

const TABS: { id: 'build' | Kind; label: string }[] = [
  { id: 'build', label: 'Construir' },
  { id: 'color', label: 'Color' },
  { id: 'material', label: 'Material' },
  { id: 'anim', label: 'Animación' },
  { id: 'pins', label: 'Pines' },
];

export const fmt = (n: number) => n.toLocaleString('es-ES');

export function CoreScreen({ core, onChange, onHome }: Props) {
  const [tab, setTab] = useState<'build' | Kind>('build');
  const [sel, setSel] = useState<number | null>(() => {
    const i = core.slots.findIndex((s) => !s);
    return i >= 0 ? i : 0;
  });
  const [flash, setFlash] = useState(0);
  const filled = core.slots.filter(Boolean).length;
  const full = filled === core.slots.length;
  const lvl = coreLevel(core);

  const apply = (next: CoreState | null) => {
    if (!next) {
      haptic('error');
      return;
    }
    haptic('success');
    setFlash((f) => f + 1);
    onChange(next);
  };

  const slot = sel !== null ? core.slots[sel] : null;
  const upCost = sel !== null ? upgradeCost(core, sel) : null;
  const nb = nextBoard(core);

  const lists: Record<Kind, { id: string; name: string; cost: number; hex?: string; body?: string }[]> = { color: COLORS, material: MATERIALS, anim: ANIMS, pins: PINS };

  return (
    <div className="screen-inner core">
      <header className="map-top">
        <button type="button" className="icon-btn" aria-label="Inicio" onClick={onHome}>
          <IconBack />
        </button>
        <div className="map-title">
          <span className="eyebrow">Tu Núcleo · Nivel {lvl}</span>
          <span className="map-name display">Taller del chip</span>
        </div>
        <span className="energy-pill display tnum" key={core.energy}>
          ⚡ {fmt(core.energy)}
        </span>
      </header>

      <div className="core-stage">
        <Chip core={core} selected={tab === 'build' ? sel : null} onSlot={tab === 'build' ? (i) => { haptic('tap'); setSel(i); } : undefined} className={flash ? 'chip--built' : ''} key={flash} />
      </div>
      <p className="core-sub">
        {filled}/{core.slots.length} módulos · placa {core.board}×{core.board} · ⚡ {fmt(core.earned)} ganada en total
      </p>

      <nav className="core-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`core-tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'build' ? (
        <section className="core-panel">
          {sel !== null && !slot && (
            <>
              <p className="core-hint">Hueco {sel + 1}: elige qué módulo construir. Toca otro hueco del chip para cambiar.</p>
              <div className="core-grid">
                {MODULES.map((m) => {
                  const cost = placeCost(core, m.id);
                  return (
                    <button key={m.id} type="button" className="core-item" disabled={core.energy < cost} onClick={() => apply(place(core, sel, m.id))}>
                      <span className="core-item-name">{m.name}</span>
                      <span className="core-item-cost tnum">⚡ {fmt(cost)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {sel !== null && slot && (
            <div className="core-upgrade">
              <p className="core-hint">
                {MODULES.find((m) => m.id === slot.m)!.name} · nivel {slot.lvl}/3
              </p>
              {upCost !== null ? (
                <button type="button" className="btn btn-primary btn-lg" disabled={core.energy < upCost} onClick={() => apply(upgrade(core, sel))}>
                  Mejorar a nivel {slot.lvl + 1} · ⚡ {fmt(upCost)}
                </button>
              ) : (
                <p className="core-max">Nivel máximo. Toca un hueco vacío para seguir construyendo.</p>
              )}
            </div>
          )}
          {full && nb && (
            <button type="button" className="btn btn-ghost btn-lg core-expand" disabled={core.energy < BOARD_COST[nb]} onClick={() => apply(expand(core))}>
              Ampliar la placa a {nb}×{nb} · ⚡ {fmt(BOARD_COST[nb])}
            </button>
          )}
          {!full && nb && <p className="core-max">Llena todos los huecos para poder ampliar la placa a {nb}×{nb}.</p>}
        </section>
      ) : (
        <section className="core-panel">
          <div className="core-grid">
            {lists[tab].map((it) => {
              const owned = core.owned.includes(it.id);
              const active = core[tab] === it.id;
              return (
                <button key={it.id} type="button" className={`core-item${active ? ' is-active' : ''}`} disabled={!owned && core.energy < it.cost} onClick={() => apply(buyOrEquip(core, tab, it.id))}>
                  {(it.hex || it.body) && <span className={`core-swatch${it.id === 'arcoiris' ? ' core-swatch--rainbow' : ''}`} style={{ background: it.hex ?? it.body, borderColor: (it as { edge?: string }).edge }} />}
                  <span className="core-item-name">{it.name}</span>
                  <span className="core-item-cost tnum">{active ? 'En uso' : owned ? 'Usar' : `⚡ ${fmt(it.cost)}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <p className="core-foot">La energía se gana acertando: más en preguntas difíciles, rachas, fases, aventura y jefes. El chip es solo tuyo: no cambia el juego.</p>
    </div>
  );
}
