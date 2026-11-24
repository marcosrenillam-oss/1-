import { useState } from 'react';
import {
  buyOrEquip, CHIP_MAX, CHIP_TIERS, COLORS, coreProgress, evolve, evolveInfo, filledCount, LISTS, MAX_MODULE_LEVEL, moduleInfo, MODULES, ownKey, place,
  placeCost, SPREAD, tierOf, unlocksAt, upgrade, upgradeInfo, type CoreState, type Kind, type ModuleId,
} from '../engine/core';
import { Chip, ModuleArt, stageOf } from '../components/Chip';
import { IconBack } from '../components/Icons';
import { haptic } from '../haptics';

interface Props {
  core: CoreState;
  onChange: (c: CoreState) => void;
  onHome: () => void;
}

type Tab = 'build' | 'chip' | Kind;
const TABS: { id: Tab; label: string }[] = [
  { id: 'build', label: 'Construir' },
  { id: 'chip', label: 'Evolución' },
  { id: 'color', label: 'Color' },
  { id: 'material', label: 'Material' },
  { id: 'anim', label: 'Animación' },
  { id: 'pins', label: 'Pines' },
];
const STAGE_NAME = ['Básico', 'Acero', 'Oro', 'Élite'];

export const fmt = (n: number) => n.toLocaleString('es-ES');

function Art({ m, lvl, color, size = 40 }: { m: ModuleId; lvl: number; color: string; size?: number }) {
  return (
    <svg viewBox="-52 -58 104 110" width={size} height={size} aria-hidden="true" className="core-art">
      <defs>
        <filter id="chipGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <ModuleArt m={m} lvl={lvl} color={color} />
    </svg>
  );
}

/** First empty slot, else the lowest module, so the workshop opens on something to do. */
function firstSlot(core: CoreState): number {
  const empty = core.slots.findIndex((s) => !s);
  if (empty >= 0) return empty;
  let best = 0;
  core.slots.forEach((s, i) => {
    if (s && s.lvl < core.slots[best]!.lvl) best = i;
  });
  return best;
}

export function CoreScreen({ core, onChange, onHome }: Props) {
  const [tab, setTab] = useState<Tab>('build');
  const [sel, setSel] = useState<number>(() => firstSlot(core));
  const [flash, setFlash] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [evolved, setEvolved] = useState<number | null>(null);
  const tier = tierOf(core.chip);
  const color = COLORS.find((c) => c.id === core.color)?.hex ?? '#c8ff2e';
  const ev = evolveInfo(core);

  const apply = (next: CoreState | null) => {
    if (!next) {
      haptic('error');
      return false;
    }
    haptic('success');
    setFlash((f) => f + 1);
    setNote(null);
    onChange(next);
    return true;
  };

  const doEvolve = () => {
    const next = evolve(core);
    if (!next) return haptic('error');
    haptic('heavy');
    onChange(next);
    setEvolved(next.chip);
    setSel(firstSlot(next));
  };

  const slot = core.slots[sel] ?? null;
  const up = upgradeInfo(core, sel);

  return (
    <div className="screen-inner core">
      <header className="map-top">
        <button type="button" className="icon-btn" aria-label="Inicio" onClick={onHome}>
          <IconBack />
        </button>
        <div className="map-title">
          <span className="eyebrow">
            Chip nivel {core.chip} · {tier.name}
          </span>
          <span className="map-name display">Taller del chip</span>
        </div>
        <span className="energy-pill display tnum" key={core.energy}>
          ⚡ {fmt(core.energy)}
        </span>
      </header>

      <div className="core-stage">
        <Chip
          core={core}
          badges
          selected={tab === 'build' ? sel : null}
          onSlot={(i) => {
            haptic('tap');
            setSel(i);
            setTab('build');
            setNote(null);
          }}
          onLocked={() => {
            haptic('tap');
            const next = CHIP_TIERS.findIndex((t) => t.slots > core.slots.length) + 1;
            setNote(next ? `Ese hueco se abre al evolucionar el chip a nivel ${next}.` : null);
          }}
          className={flash ? 'chip--built' : ''}
          key={flash}
        />
      </div>
      <p className="core-sub tnum">
        {filledCount(core)}/{core.slots.length} módulos · nivel máx. {tier.cap} · {coreProgress(core)} % completado
      </p>
      {note && <p className="core-note">{note}</p>}

      {ev?.ready && tab !== 'chip' && (
        <button type="button" className="core-ready" onClick={() => setTab('chip')}>
          <span className="display">¡Tu chip puede evolucionar!</span>
          <span>Ver evolución →</span>
        </button>
      )}

      <nav className="core-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`core-tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'build' && (
        <section className="core-panel">
          {!slot ? (
            <>
              <p className="core-hint">Hueco {sel + 1}: elige qué construir. Toca otro hueco del chip para cambiar.</p>
              <div className="core-grid">
                {MODULES.map((m) => {
                  const locked = m.req > core.chip;
                  const cost = placeCost(m.id);
                  return (
                    <button key={m.id} type="button" className={`core-item core-item--mod${locked ? ' is-locked' : ''}`} disabled={locked || core.energy < cost} onClick={() => apply(place(core, sel, m.id))}>
                      <Art m={m.id} lvl={1} color={locked ? '#4a4f57' : color} />
                      <span className="core-item-name">{m.name}</span>
                      <span className="core-item-cost tnum">{locked ? `🔒 Chip ${m.req}` : `⚡ ${fmt(cost)}`}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="core-upgrade">
              <div className="core-evo">
                <div className="core-evo-side">
                  <Art m={slot.m} lvl={slot.lvl} color={color} size={86} />
                  <span className="tnum">Nivel {slot.lvl}</span>
                </div>
                {slot.lvl < MAX_MODULE_LEVEL && (
                  <>
                    <span className="core-evo-arrow" aria-hidden="true">→</span>
                    <div className="core-evo-side">
                      <Art m={slot.m} lvl={slot.lvl + 1} color={color} size={86} />
                      <span className="tnum">Nivel {slot.lvl + 1}</span>
                    </div>
                  </>
                )}
              </div>
              <p className="core-hint">
                <b>{moduleInfo(slot.m).name}</b> · nivel {slot.lvl}/{MAX_MODULE_LEVEL} · fase {STAGE_NAME[stageOf(slot.lvl)]}
                {slot.lvl < MAX_MODULE_LEVEL && stageOf(slot.lvl + 1) > stageOf(slot.lvl) && <> · ¡el siguiente nivel cambia su forma!</>}
              </p>
              {up?.block?.kind === 'max' && <p className="core-max">Nivel máximo. Este módulo ha completado su evolución.</p>}
              {up?.block?.kind === 'chip' && (
                <p className="core-max">
                  Para pasar a nivel {slot.lvl + 1} necesitas el chip a nivel {up.block.chip}. {ev && !ev.ready ? 'Llena todos los huecos y sube los módulos al máximo para evolucionarlo.' : ''}
                </p>
              )}
              {up?.block?.kind === 'others' && (
                <p className="core-max">
                  Antes sube los demás módulos a nivel {up.block.level}: ninguno puede ir más de {SPREAD} niveles por delante del resto.
                </p>
              )}
              {up && !up.block && (
                <button type="button" className="btn btn-primary btn-lg" disabled={core.energy < up.cost} onClick={() => apply(upgrade(core, sel))}>
                  Mejorar a nivel {slot.lvl + 1} · ⚡ {fmt(up.cost)}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'chip' && (
        <section className="core-panel">
          {ev ? (
            <>
              <p className="core-hint">
                Evolucionar a <b>nivel {ev.next} · {tierOf(ev.next).name}</b>
              </p>
              <ul className="core-reqs">
                <li className={ev.filled === ev.slots ? 'is-ok' : ''}>
                  Todos los huecos llenos <b className="tnum">{ev.filled}/{ev.slots}</b>
                </li>
                <li className={ev.atCap === ev.slots ? 'is-ok' : ''}>
                  Módulos a nivel {ev.cap} <b className="tnum">{ev.atCap}/{ev.slots}</b>
                </li>
                <li className={core.energy >= ev.cost ? 'is-ok' : ''}>
                  Energía <b className="tnum">⚡ {fmt(ev.cost)}</b>
                </li>
              </ul>
              <Unlocks chip={ev.next} />
              <button type="button" className="btn btn-primary btn-lg" disabled={!ev.ready || core.energy < ev.cost} onClick={doEvolve}>
                Evolucionar el chip · ⚡ {fmt(ev.cost)}
              </button>
            </>
          ) : (
            <p className="core-hint">Has llegado a <b>Singularidad</b>, el chip definitivo. Ahora termina de subir todos los módulos a nivel 10.</p>
          )}
          <ol className="core-road">
            {CHIP_TIERS.map((t, i) => (
              <li key={t.name} className={i + 1 < core.chip ? 'is-done' : i + 1 === core.chip ? 'is-current' : ''}>
                <span className="core-road-n display tnum">{i + 1}</span>
                <span className="core-road-name">{t.name}</span>
                <span className="core-road-meta tnum">
                  {t.slots} huecos · máx. {t.cap}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {tab !== 'build' && tab !== 'chip' && (
        <section className="core-panel">
          <div className="core-grid">
            {LISTS[tab].map((it) => {
              const owned = core.owned.includes(ownKey(tab, it.id));
              const active = core[tab] === it.id;
              const locked = !owned && it.req > core.chip;
              const x = it as { hex?: string; body?: string; edge?: string };
              const sw = x.hex ?? x.body;
              const edge = x.edge;
              return (
                <button key={it.id} type="button" className={`core-item${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}`} disabled={locked || (!owned && core.energy < it.cost)} onClick={() => apply(buyOrEquip(core, tab, it.id))}>
                  {sw && <span className={`core-swatch${it.id === 'arcoiris' ? ' core-swatch--rainbow' : ''}`} style={{ background: sw, borderColor: edge }} />}
                  <span className="core-item-name">{it.name}</span>
                  <span className="core-item-cost tnum">{active ? 'En uso' : owned ? 'Usar' : locked ? `🔒 Chip ${it.req}` : `⚡ ${fmt(it.cost)}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <p className="core-foot">
        La energía se gana acertando: más en preguntas difíciles, rachas, fases, aventura y jefes. El chip es solo tuyo: no cambia el juego. Chip {core.chip}/{CHIP_MAX} · ⚡ {fmt(core.earned)} ganada en total.
      </p>

      {evolved && (
        <div className="core-evolved" role="dialog" aria-label="Chip evolucionado" onClick={() => setEvolved(null)}>
          <div className="core-evolved-card">
            <span className="eyebrow">¡Evolución!</span>
            <Chip core={core} className="core-evolved-chip" />
            <p className="core-evolved-title display">
              Nivel {evolved} · {tierOf(evolved).name}
            </p>
            <Unlocks chip={evolved} />
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setEvolved(null)}>
              Seguir construyendo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Unlocks({ chip }: { chip: number }) {
  const u = unlocksAt(chip);
  const prev = tierOf(chip - 1);
  return (
    <ul className="core-unlocks">
      {u.slots > 0 && (
        <li>
          +{u.slots} huecos{u.board > prev.board ? ` · placa ${u.board}×${u.board}` : ''}
        </li>
      )}
      {u.cap > prev.cap && <li>Módulos hasta nivel {u.cap}</li>}
      {u.modules.length > 0 && <li>Nuevos módulos: {u.modules.join(', ')}</li>}
      {u.cosmetics.length > 0 && <li>Personalización: {u.cosmetics.join(', ')}</li>}
      <li>Nuevo aspecto del chip</li>
    </ul>
  );
}
