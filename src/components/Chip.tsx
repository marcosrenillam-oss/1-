import type { ReactNode } from 'react';
import { COLORS, MATERIALS, tierOf, type CoreState, type ModuleId } from '../engine/core';

const S = 320; // viewBox
const BODY = 40; // body inset
const INNER = 60; // board inset

/** Slot → board cell, in unlock order (centre first, corners last). */
const ORDER: Record<number, number[]> = {
  3: [4, 1, 3, 5, 7, 0, 2, 6, 8],
  4: [5, 6, 9, 10, 1, 2, 4, 7, 8, 11, 13, 14, 0, 3, 12, 15],
  5: [6, 7, 8, 11, 12, 13, 16, 17, 18, 1, 2, 3, 5, 9, 10, 14, 15, 19, 21, 22, 23, 0, 4, 20, 24],
};

/** Module evolution stage: 1-3 → 0, 4-6 → 1, 7-9 → 2, 10 → 3. */
export const stageOf = (lvl: number) => Math.min(3, Math.floor((lvl - 1) / 3));

const PLATE = [
  { fill: '#1a1d22', edge: 'rgba(255,255,255,0.2)', bolt: '#5b616b' },
  { fill: '#1c2128', edge: '#8b95a3', bolt: '#aab3bf' },
  { fill: '#211b0c', edge: '#d4ae45', bolt: '#f5d27a' },
];

const poly = (n: number, r: number, rot = -90, inner?: number) =>
  Array.from({ length: inner ? n * 2 : n }, (_, k) => {
    const a = ((rot + (k * 360) / (inner ? n * 2 : n)) * Math.PI) / 180;
    const rr = inner && k % 2 ? inner : r;
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');

/** Small dots around a radius: the extra detail each level adds within a stage. */
const sats = (n: number, r: number, c: string, rot = -90) =>
  Array.from({ length: n }, (_, k) => {
    const a = ((rot + (k * 360) / Math.max(n, 1)) * Math.PI) / 180;
    return <circle key={`s${k}`} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={3.6} fill={c} />;
  });

/** Module glyphs in a ±50 box. Each stage changes the shape; each level adds detail. */
function glyph(m: ModuleId, lvl: number, c: string): ReactNode {
  const st = stageOf(lvl);
  const sub = lvl === 10 ? 3 : (lvl - 1) % 3; // 0..2 (3 at max)
  const dark = '#0b0c0e';
  switch (m) {
    case 'nucleo':
      return (
        <>
          {st === 3 && <polygon points={poly(8, 44, -90, 22)} fill={c} opacity={0.3} />}
          {st >= 1 && Array.from({ length: st >= 2 ? 8 : 4 }, (_, k) => <line key={k} x1={0} y1={-30} x2={0} y2={-39} stroke={c} strokeWidth={4} strokeLinecap="round" transform={`rotate(${(k * 360) / (st >= 2 ? 8 : 4)})`} />)}
          {(lvl >= 2 || st > 0) && <circle r={25} fill="none" stroke={c} strokeWidth={3.5} />}
          {st >= 2 && <circle r={33} fill="none" stroke={c} strokeWidth={2} strokeDasharray="5 5" />}
          <circle r={14 + st * 2} fill={c} />
          {st >= 2 && <circle r={6} fill={dark} />}
          {sats(sub, 25, c, 45)}
        </>
      );
    case 'memoria': {
      const bars = 2 + st;
      const h = 60 / (bars * 1.6);
      const cols = st >= 2 ? [-15, 15] : [0];
      const w = st >= 2 ? 26 : 56;
      return (
        <>
          {cols.map((cx) =>
            Array.from({ length: bars }, (_, k) => {
              const y = -30 + k * (60 / bars) + (60 / bars - h) / 2;
              return (
                <g key={`${cx}-${k}`}>
                  <rect x={cx - w / 2} y={y} width={w} height={h} rx={3} fill={c} />
                  {st >= 1 && <rect x={cx - w / 2 - 7} y={y + h / 2 - 2} width={5} height={4} fill={c} opacity={0.7} />}
                  {st >= 1 && <rect x={cx + w / 2 + 2} y={y + h / 2 - 2} width={5} height={4} fill={c} opacity={0.7} />}
                </g>
              );
            }),
          )}
          {st === 3 && <rect x={-36} y={-42} width={72} height={6} rx={3} fill={c} opacity={0.6} />}
          {Array.from({ length: sub }, (_, k) => <circle key={k} cx={30 - k * 9} cy={40} r={3} fill={c} />)}
        </>
      );
    }
    case 'antena':
      return (
        <g stroke={c} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d="M-14 38 L0 20 L14 38" />
          <line x1={0} y1={38} x2={0} y2={st >= 2 ? -8 : -24} />
          {st >= 1 && <line x1={-12} y1={6} x2={12} y2={6} />}
          {st >= 2 && <path d="M-24 -16 Q0 4 24 -16" strokeWidth={5} />}
          {st >= 2 && <line x1={0} y1={-8} x2={0} y2={-26} strokeWidth={3} />}
          {Array.from({ length: 1 + Math.min(st, 2) }, (_, k) => (
            <path key={k} d={`M${-14 - k * 9} ${-28 - k * 6} Q0 ${-44 - k * 9} ${14 + k * 9} ${-28 - k * 6}`} opacity={1 - k * 0.22} strokeWidth={3} />
          ))}
          <circle cx={0} cy={st >= 2 ? -28 : -26} r={4.5} fill={c} />
          {st === 3 && <polygon points={poly(4, 12, -90, 4)} transform="translate(30 -34)" fill={c} stroke="none" />}
          {Array.from({ length: sub }, (_, k) => <circle key={`d${k}`} cx={0} cy={28 - k * 10} r={2.5} fill={c} stroke="none" />)}
        </g>
      );
    case 'cristal': {
      const big = 30 + st * 3;
      const side = st >= 2 ? 4 : st >= 1 ? 2 : 0;
      return (
        <>
          {st === 3 && <polygon points={poly(12, 46, -90, 30)} fill={c} opacity={0.2} />}
          {Array.from({ length: side }, (_, k) => {
            const a = (side === 2 ? [180, 0] : [180, 0, 225, -45])[k];
            const x = Math.cos((a * Math.PI) / 180) * 32;
            const y = Math.sin((a * Math.PI) / 180) * 22 + 10;
            return <polygon key={k} points="0,-12 7,0 0,12 -7,0" transform={`translate(${x} ${y})`} fill={c} opacity={0.7} />;
          })}
          <polygon points={`0,${-big} ${big * 0.62},0 0,${big} ${-big * 0.62},0`} fill={c} />
          {st >= 1 && <path d={`M${-big * 0.62} 0 L${big * 0.62} 0 M0 ${-big} L-8 0 L0 ${big} M0 ${-big} L8 0 L0 ${big}`} stroke={dark} strokeWidth={2} opacity={0.5} fill="none" />}
          {sats(sub, 40, c, -60)}
        </>
      );
    }
    case 'bateria': {
      const cells = Math.min(5, Math.ceil(lvl / 2));
      return (
        <>
          <rect x={-20} y={-30} width={40} height={64} rx={6} fill="none" stroke={c} strokeWidth={4} />
          <rect x={-8} y={-38} width={16} height={7} rx={2} fill={c} />
          {Array.from({ length: cells }, (_, k) => <rect key={k} x={-13} y={24 - k * 11.5} width={26} height={8.5} rx={2} fill={c} />)}
          {st >= 1 && <rect x={-30} y={-6} width={6} height={14} rx={2} fill={c} opacity={0.6} />}
          {st >= 1 && <rect x={24} y={-6} width={6} height={14} rx={2} fill={c} opacity={0.6} />}
          {st >= 2 && <polygon points="4,-24 -10,4 0,4 -4,26 10,-4 0,-4" fill={dark} stroke={c} strokeWidth={1.5} />}
          {st === 3 && <circle r={44} fill="none" stroke={c} strokeWidth={2} strokeDasharray="3 6" />}
        </>
      );
    }
    case 'ventilador': {
      const blades = 2 + st + (sub > 0 && st < 3 ? 0 : 0);
      return (
        <>
          <circle r={36} fill="none" stroke={c} strokeWidth={3.5} />
          {st >= 2 && <circle r={43} fill="none" stroke={c} strokeWidth={2} strokeDasharray="2 4" />}
          <g className="chip-spin">
            {Array.from({ length: blades }, (_, k) => (
              <path key={k} d="M0 0 Q26 -10 10 -32 Q0 -18 0 0 Z" fill={c} transform={`rotate(${(k * 360) / blades})`} />
            ))}
            {st === 3 && <circle r={18} fill="none" stroke={dark} strokeWidth={3} />}
          </g>
          {st >= 1 && <circle r={7} fill={dark} stroke={c} strokeWidth={3} />}
          {sats(sub, 36, c, 45)}
        </>
      );
    }
    case 'reactor':
      return (
        <>
          {st === 3 && Array.from({ length: 6 }, (_, k) => <line key={k} x1={0} y1={-36} x2={0} y2={-46} stroke={c} strokeWidth={3} transform={`rotate(${k * 60})`} />)}
          {st >= 2 && Array.from({ length: 3 }, (_, k) => <polygon key={k} points="-8,-34 8,-34 0,-44" fill={c} transform={`rotate(${k * 120 + 60})`} />)}
          <polygon points={poly(6, 32, -90)} fill="none" stroke={c} strokeWidth={4} />
          {st >= 1 && <polygon points={poly(6, 21, 0)} fill="none" stroke={c} strokeWidth={2.5} opacity={0.75} />}
          <circle r={9 + st * 2} fill={c} className="chip-core-pulse" />
          {sats(sub, 32, c, -60)}
        </>
      );
    case 'bobina': {
      const turns = 2 + st;
      return (
        <>
          {st >= 2 && <rect x={-4} y={-40} width={8} height={80} rx={3} fill={c} opacity={0.5} />}
          {Array.from({ length: turns }, (_, k) => {
            const y = -30 + (k * 60) / Math.max(turns - 1, 1);
            return <ellipse key={k} cx={0} cy={y} rx={24} ry={7} fill="none" stroke={c} strokeWidth={4} />;
          })}
          <line x1={-24} y1={-30} x2={-24} y2={30} stroke={c} strokeWidth={2} opacity={0.5} />
          <line x1={24} y1={-30} x2={24} y2={30} stroke={c} strokeWidth={2} opacity={0.5} />
          {st === 3 && <path d="M30 -30 L40 -14 L32 -14 L42 4" stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" />}
          {Array.from({ length: sub }, (_, k) => <circle key={k} cx={-38} cy={-24 + k * 12} r={3} fill={c} />)}
        </>
      );
    }
    case 'prisma': {
      const pts = 4 + st;
      return (
        <g className={st === 3 ? 'chip-spin chip-spin--slow' : undefined}>
          {st >= 2 && <circle r={42} fill="none" stroke={c} strokeWidth={2} />}
          <polygon points={poly(pts, 36 + st * 2, -90, 14)} fill={c} />
          {st >= 1 && <polygon points={poly(pts, 18, -90 + 180 / pts, 7)} fill="#0b0c0e" opacity={0.55} />}
          {sats(sub, 42, c, -90 + 180 / pts)}
        </g>
      );
    }
    case 'condensador': {
      const pairs = st >= 2 ? 2 : 1;
      return (
        <g stroke={c} strokeLinecap="round">
          {Array.from({ length: pairs }, (_, p) => {
            const ox = pairs === 2 ? (p ? 16 : -16) : 0;
            return (
              <g key={p} transform={`translate(${ox} 0)`}>
                <line x1={-7} y1={-26} x2={-7} y2={26} strokeWidth={6} />
                <line x1={7} y1={-26} x2={7} y2={26} strokeWidth={6} />
                {st >= 1 && <line x1={-7} y1={0} x2={-20} y2={0} strokeWidth={3} />}
                {st >= 1 && <line x1={7} y1={0} x2={20} y2={0} strokeWidth={3} />}
              </g>
            );
          })}
          {st === 3 && <path d="M-34 -36 Q0 -50 34 -36 M-34 36 Q0 50 34 36" strokeWidth={2.5} fill="none" />}
          {Array.from({ length: sub }, (_, k) => <circle key={k} cx={-10 + k * 20} cy={-40} r={3} fill={c} stroke="none" />)}
        </g>
      );
    }
    case 'laser': {
      const beams = 1 + st;
      return (
        <>
          <rect x={-40} y={-14} width={28} height={28} rx={5} fill={c} />
          {st >= 2 && <circle cx={-6} cy={0} r={9} fill="none" stroke={c} strokeWidth={3} />}
          {Array.from({ length: beams }, (_, k) => {
            const y = (k - (beams - 1) / 2) * 9;
            return <line key={k} x1={-10} y1={y} x2={38} y2={y * 1.6} stroke={c} strokeWidth={3} strokeLinecap="round" className="chip-beam" />;
          })}
          {st === 3 && <polygon points={poly(6, 12, 0, 5)} transform="translate(38 0)" fill={c} />}
          {Array.from({ length: sub }, (_, k) => <circle key={k} cx={-32 + k * 10} cy={26} r={3} fill={c} />)}
        </>
      );
    }
    case 'torre': {
      const floors = 2 + st;
      return (
        <>
          {Array.from({ length: floors }, (_, k) => {
            const w = 50 - k * (30 / floors);
            const h = 54 / floors;
            const y = 36 - (k + 1) * h;
            return (
              <g key={k}>
                <rect x={-w / 2} y={y + 1} width={w} height={h - 2} rx={2} fill={c} />
                {st >= 1 && <rect x={-w / 2 + 5} y={y + h / 2 - 2} width={w - 10} height={3} fill="#0b0c0e" opacity={0.5} />}
              </g>
            );
          })}
          {st >= 2 && <line x1={0} y1={-18} x2={0} y2={-38} stroke={c} strokeWidth={3} />}
          {st >= 2 && <circle cx={0} cy={-40} r={4} fill={c} className={st === 3 ? 'chip-core-pulse' : undefined} />}
          {Array.from({ length: sub }, (_, k) => <circle key={k} cx={30} cy={30 - k * 10} r={3} fill={c} />)}
        </>
      );
    }
    case 'cuantico': {
      const orbits = 1 + st;
      return (
        <g className={st === 3 ? 'chip-spin chip-spin--slow' : undefined}>
          {Array.from({ length: orbits }, (_, k) => (
            <g key={k} transform={`rotate(${(k * 180) / orbits})`}>
              <ellipse rx={38} ry={13} fill="none" stroke={c} strokeWidth={3} />
              <circle cx={38} cy={0} r={4.5} fill={c} />
            </g>
          ))}
          <circle r={9} fill={c} />
          {sats(sub, 22, c, 0)}
        </g>
      );
    }
    case 'holo': {
      const layers = 1 + st;
      return (
        <>
          <ellipse cx={0} cy={34} rx={30} ry={7} fill="none" stroke={c} strokeWidth={3} />
          {Array.from({ length: layers }, (_, k) => {
            const s = 1 - k * 0.22;
            return <polygon key={k} points={`0,${-34 * s} ${26 * s},${22 * s} ${-26 * s},${22 * s}`} fill="none" stroke={c} strokeWidth={3} opacity={1 - k * 0.15} />;
          })}
          {st >= 1 && [-6, 6, 18].map((y) => <line key={y} x1={-20} y1={y} x2={20} y2={y} stroke={c} strokeWidth={1.5} opacity={0.5} className="chip-scanline" />)}
          {st === 3 && <polygon points="0,-48 6,-40 0,-32 -6,-40" fill={c} className="chip-core-pulse" />}
          {Array.from({ length: sub }, (_, k) => <circle key={k} cx={-36 + k * 9} cy={-38} r={3} fill={c} />)}
        </>
      );
    }
  }
}

/** One module drawn in a ±50 box: a plate whose material evolves, and the evolving glyph. */
export function ModuleArt({ m, lvl, color, badge = false }: { m: ModuleId; lvl: number; color: string; badge?: boolean }) {
  const st = stageOf(lvl);
  const p = st === 3 ? { fill: '#101310', edge: color, bolt: color } : PLATE[st];
  const bolts = st === 0 ? (lvl >= 3 ? 4 : lvl === 2 ? 2 : 0) : 4;
  return (
    <g className="chip-module">
      {st === 3 && <rect x={-50} y={-50} width={100} height={100} rx={18} fill={color} opacity={0.22} filter="url(#chipGlow)" className="chip-aura" />}
      <rect x={-46} y={-46} width={92} height={92} rx={st >= 1 ? 12 : 16} fill={p.fill} stroke={p.edge} strokeWidth={st >= 2 ? 4 : 2.5} />
      {st >= 2 && <rect x={-39} y={-39} width={78} height={78} rx={8} fill="none" stroke={p.edge} strokeWidth={1.2} opacity={0.5} />}
      {[[-37, -37], [37, 37], [37, -37], [-37, 37]].slice(0, bolts).map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={st >= 1 ? 3.6 : 2.8} fill={p.bolt} />
      ))}
      {st === 3 && <polygon points="-10,-46 -5,-54 0,-48 5,-54 10,-46" fill={color} />}
      <g transform="scale(0.82)">{glyph(m, lvl, color)}</g>
      {badge && (
        <g transform="translate(30 30)">
          <circle r={16} fill="#0b0c0e" stroke={st >= 2 ? p.edge : color} strokeWidth={2.5} />
          <text textAnchor="middle" dy="0.36em" fontSize={lvl === 10 ? 15 : 19} fontWeight={700} fill={color} fontFamily="Space Grotesk, Inter, sans-serif">
            {lvl}
          </text>
        </g>
      )}
    </g>
  );
}

interface Props {
  core: CoreState;
  /** Highlighted (selected) slot. */
  selected?: number | null;
  onSlot?: (i: number) => void;
  /** Tap on a slot not yet opened at this chip level. */
  onLocked?: () => void;
  /** Show level badges (the workshop view). */
  badges?: boolean;
  className?: string;
}

const RAINBOW = ['#c8ff2e', '#3d9bff', '#a66bff', '#ff4fa3', '#ff3b3b', '#ffd60a'];

/** The player's chip, drawn from its current configuration. It evolves with the chip level. */
export function Chip({ core, selected = null, onSlot, onLocked, badges = false, className = '' }: Props) {
  const color = COLORS.find((c) => c.id === core.color)?.hex ?? '#c8ff2e';
  const mat = MATERIALS.find((m) => m.id === core.material) ?? MATERIALS[0];
  const lv = core.chip;
  const n = tierOf(lv).board;
  const order = ORDER[n];
  const cell = (S - INNER * 2) / n;
  const pos = (k: number) => ({ x: INNER + (k % n) * cell + cell / 2, y: INNER + Math.floor(k / n) * cell + cell / 2 });
  const slotAt = new Map<number, number>();
  core.slots.forEach((_, i) => slotAt.set(order[i], i));

  const pinsPerSide = 3 + n * 2;
  const pinColor = { dorados: '#d9b44a', cobre: '#c27a45', luz: color, cristal: '#bfe9ff', plasma: color }[core.pins] ?? '#5b616b';
  const pinW = core.pins === 'dobles' ? 3 : 4 + Math.min(2, Math.floor(lv / 3));

  const traces: ReactNode[] = [];
  for (const [k, i] of slotAt) {
    if (!core.slots[i]) continue;
    for (const k2 of [k + 1, k + n]) {
      if (k2 === k + 1 && k2 % n === 0) continue;
      const j = slotAt.get(k2);
      if (j === undefined || !core.slots[j]) continue;
      const a = pos(k);
      const b = pos(k2);
      traces.push(<line key={`${k}-${k2}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="chip-trace" stroke={color} />);
    }
  }

  // Chip body: from a plain square (1) to a chamfered, finned, crowned die (7).
  const b0 = BODY;
  const b1 = S - BODY;
  const ch = lv >= 3 ? 18 : 0;
  const bodyPath = ch
    ? `M${b0 + ch} ${b0} H${b1 - ch} L${b1} ${b0 + ch} V${b1 - ch} L${b1 - ch} ${b1} H${b0 + ch} L${b0} ${b1 - ch} V${b0 + ch} Z`
    : `M${b0 + 22} ${b0} H${b1 - 22} Q${b1} ${b0} ${b1} ${b0 + 22} V${b1 - 22} Q${b1} ${b1} ${b1 - 22} ${b1} H${b0 + 22} Q${b0} ${b1} ${b0} ${b1 - 22} V${b0 + 22} Q${b0} ${b0} ${b0 + 22} ${b0} Z`;
  const edgeColor = lv >= 6 ? '#d4ae45' : mat.edge;

  return (
    <svg
      className={`chip chip--${core.anim} chip--lv${lv}${core.color === 'arcoiris' ? ' chip--rainbow' : ''} ${className}`}
      viewBox={`0 0 ${S} ${S}`}
      role="img"
      aria-label={`Tu chip nivel ${lv}: ${core.slots.filter(Boolean).length} módulos`}
    >
      <defs>
        <filter id="chipGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="chipShine" cx="30%" cy="25%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="chipScan" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.5" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <clipPath id="chipClip">
          <path d={bodyPath} />
        </clipPath>
      </defs>

      {/* Halo from level 6, rotating ring at the top level */}
      {lv >= 6 && <circle cx={160} cy={160} r={150} fill={color} opacity={0.07} filter="url(#chipGlow)" />}
      {lv >= 7 && (
        <g className="chip-orbit" style={{ transformOrigin: '160px 160px' }}>
          <circle cx={160} cy={160} r={152} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="2 10" opacity={0.7} />
        </g>
      )}

      {/* Pins */}
      <g stroke={pinColor} strokeWidth={pinW} strokeLinecap="round" className={`chip-pins chip-pins--${core.pins}`}>
        {Array.from({ length: pinsPerSide }, (_, k) => {
          const p = BODY + 24 + (k * (S - 2 * BODY - 48)) / (pinsPerSide - 1);
          const len = 18 + Math.min(lv, 5);
          const lines = [
            [p, BODY, p, BODY - len], [p, S - BODY, p, S - BODY + len],
            [BODY, p, BODY - len, p], [S - BODY, p, S - BODY + len, p],
          ];
          return lines.map(([x1, y1, x2, y2], q) => (
            <g key={`${k}-${q}`} stroke={core.pins === 'arcoiris' ? RAINBOW[(k + q) % RAINBOW.length] : undefined}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              {core.pins === 'dobles' && <line x1={x1 + (q < 2 ? 5 : 0)} y1={y1 + (q >= 2 ? 5 : 0)} x2={x2 + (q < 2 ? 5 : 0)} y2={y2 + (q >= 2 ? 5 : 0)} opacity={0.5} />}
              {lv >= 4 && <circle cx={x2} cy={y2} r={pinW * 0.55} fill={core.pins === 'arcoiris' ? RAINBOW[(k + q) % RAINBOW.length] : pinColor} stroke="none" />}
            </g>
          ));
        })}
      </g>

      {/* Body */}
      <g className="chip-body">
        <path d={bodyPath} fill={mat.body} stroke={edgeColor} strokeWidth={lv >= 4 ? 3.5 : 2.5} />
        <path d={bodyPath} fill="url(#chipShine)" />
        {lv >= 2 && <rect x={BODY + 9} y={BODY + 9} width={S - BODY * 2 - 18} height={S - BODY * 2 - 18} rx={lv >= 3 ? 6 : 14} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={1.2} />}
        {/* Corner brackets (3+) */}
        {lv >= 3 &&
          [[0, 0], [1, 0], [0, 1], [1, 1]].map(([sx, sy], k) => {
            const x = sx ? b1 - 12 : b0 + 12;
            const y = sy ? b1 - 12 : b0 + 12;
            const dx = sx ? -14 : 14;
            const dy = sy ? -14 : 14;
            return <path key={k} d={`M${x} ${y + dy} V${y} H${x + dx}`} fill="none" stroke={lv >= 6 ? '#d4ae45' : color} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />;
          })}
        {/* Heat-sink fins (4+) */}
        {lv >= 4 &&
          Array.from({ length: 5 }, (_, k) => {
            const p = 130 + k * 15;
            return (
              <g key={k} stroke={edgeColor} strokeWidth={2} opacity={0.55}>
                <line x1={p} y1={b0 + 3} x2={p} y2={b0 + 7} />
                <line x1={p} y1={b1 - 3} x2={p} y2={b1 - 7} />
              </g>
            );
          })}
        {/* Engraved circuit lines (5+) */}
        {lv >= 5 && (
          <g stroke={color} strokeOpacity={0.18} strokeWidth={1.2} fill="none">
            <path d={`M${b0 + 4} 110 H${b0 + 12} V140`} />
            <path d={`M${b1 - 4} 210 H${b1 - 12} V180`} />
            <path d={`M110 ${b1 - 4} V${b1 - 12} H140`} />
            <path d={`M210 ${b0 + 4} V${b0 + 12} H180`} />
          </g>
        )}
        {/* Gems on the corners (6+) */}
        {lv >= 6 &&
          [[b0 + 8, b0 + 8], [b1 - 8, b0 + 8], [b0 + 8, b1 - 8], [b1 - 8, b1 - 8]].map(([x, y], k) => (
            <polygon key={k} points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`} fill={color} />
          ))}
        {/* Crown (7) */}
        {lv >= 7 && <polygon points="146,34 152,22 160,30 168,22 174,34" fill={color} stroke="#0b0c0e" strokeWidth={1.5} />}
        <circle cx={BODY + 20} cy={BODY + 20} r={lv >= 3 ? 3 : 4} fill={color} opacity={0.6} />
        {core.anim === 'escaneo' && (
          <g clipPath="url(#chipClip)">
            <rect x={BODY} y={BODY} width={S - BODY * 2} height={40} fill="url(#chipScan)" className="chip-scan" />
          </g>
        )}
      </g>

      {/* Traces between neighbouring modules */}
      <g strokeWidth={3} strokeLinecap="round" opacity={0.7}>{traces}</g>

      {/* Sockets, locked cells and modules */}
      {Array.from({ length: n * n }, (_, k) => {
        const { x, y } = pos(k);
        const i = slotAt.get(k);
        const half = cell * 0.44;
        if (i === undefined) {
          return (
            <g key={k} onClick={onLocked} className={onLocked ? 'chip-slot chip-slot--locked' : 'chip-slot--locked'}>
              <rect x={x - half} y={y - half} width={half * 2} height={half * 2} rx={cell * 0.14} fill="rgba(0,0,0,0.25)" />
              <g transform={`translate(${x} ${y}) scale(${cell / 120})`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={5}>
                <rect x={-14} y={-4} width={28} height={22} rx={4} />
                <path d="M-8 -4 V-12 A8 8 0 0 1 8 -12 V-4" />
              </g>
            </g>
          );
        }
        const s = core.slots[i];
        return (
          <g key={k} onClick={onSlot ? () => onSlot(i) : undefined} className={onSlot ? 'chip-slot' : undefined}>
            {!s && <rect x={x - half} y={y - half} width={half * 2} height={half * 2} rx={cell * 0.14} fill="transparent" stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} strokeDasharray="4 4" />}
            {s && (
              <g transform={`translate(${x} ${y}) scale(${(cell * 0.88) / 92})`}>
                <ModuleArt m={s.m} lvl={s.lvl} color={color} badge={badges} />
              </g>
            )}
            {i === selected && <rect x={x - half - 2} y={y - half - 2} width={half * 2 + 4} height={half * 2 + 4} rx={cell * 0.16} fill="none" stroke={color} strokeWidth={2.5} className="chip-selected" />}
          </g>
        );
      })}

      {core.anim === 'orbita' && (
        <g className="chip-orbit" style={{ transformOrigin: '160px 160px' }}>
          <circle cx={160} cy={14} r={6} fill={color} />
          <circle cx={160} cy={14} r={12} fill={color} opacity={0.25} />
        </g>
      )}
      {core.anim === 'chispas' && (
        <g fill={color}>
          {[[70, 90], [250, 70], [240, 250], [80, 240], [160, 50], [270, 160]].map(([x, y], k) => (
            <polygon key={k} points={poly(4, 6, -90, 2)} transform={`translate(${x} ${y})`} className="chip-spark" style={{ animationDelay: `${k * 0.4}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}
