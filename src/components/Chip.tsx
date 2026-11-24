import type { ReactNode } from 'react';
import { COLORS, MATERIALS, type CoreState, type ModuleId } from '../engine/core';

const S = 320; // viewBox
const BODY = 40; // body inset
const INNER = 62; // board inset

function Module({ m, lvl, x, y, r, color }: { m: ModuleId; lvl: number; x: number; y: number; r: number; color: string }) {
  let shape: ReactNode;
  const sw = Math.max(1.5, r * 0.12);
  switch (m) {
    case 'nucleo':
      shape = <circle cx={x} cy={y} r={r * 0.55} fill={color} />;
      break;
    case 'memoria':
      shape = (
        <g fill={color}>
          {[-1, 0, 1].map((k) => (
            <rect key={k} x={x - r * 0.6} y={y + k * r * 0.4 - r * 0.13} width={r * 1.2} height={r * 0.26} rx={r * 0.08} />
          ))}
        </g>
      );
      break;
    case 'antena':
      shape = (
        <g stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none">
          <path d={`M${x} ${y + r * 0.6} L${x} ${y - r * 0.55}`} />
          <path d={`M${x - r * 0.45} ${y - r * 0.15} Q${x} ${y - r * 0.75} ${x + r * 0.45} ${y - r * 0.15}`} />
          <circle cx={x} cy={y - r * 0.6} r={r * 0.12} fill={color} />
        </g>
      );
      break;
    case 'cristal':
      shape = <path d={`M${x} ${y - r * 0.65} L${x + r * 0.5} ${y} L${x} ${y + r * 0.65} L${x - r * 0.5} ${y} Z`} fill={color} />;
      break;
    case 'ventilador':
      shape = (
        <g className="chip-spin" style={{ transformOrigin: `${x}px ${y}px` }}>
          <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke={color} strokeWidth={sw} />
          {[0, 120, 240].map((a) => (
            <path key={a} d={`M${x} ${y} Q${x + r * 0.45} ${y - r * 0.2} ${x + r * 0.1} ${y - r * 0.55} Z`} fill={color} transform={`rotate(${a} ${x} ${y})`} />
          ))}
        </g>
      );
      break;
    case 'reactor': {
      const pts = Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        return `${x + Math.cos(a) * r * 0.6},${y + Math.sin(a) * r * 0.6}`;
      }).join(' ');
      shape = (
        <g>
          <polygon points={pts} fill="none" stroke={color} strokeWidth={sw} />
          <circle cx={x} cy={y} r={r * 0.25} fill={color} />
        </g>
      );
      break;
    }
    case 'prisma': {
      const pts = Array.from({ length: 10 }, (_, k) => {
        const a = (Math.PI / 5) * k - Math.PI / 2;
        const rr = k % 2 ? r * 0.27 : r * 0.65;
        return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
      }).join(' ');
      shape = <polygon points={pts} fill={color} />;
      break;
    }
  }
  return (
    <g className="chip-module">
      {lvl >= 3 && <circle cx={x} cy={y} r={r * 0.95} fill={color} opacity={0.14} filter="url(#chipGlow)" />}
      {lvl >= 2 && <circle cx={x} cy={y} r={r * 0.85} fill="none" stroke={color} strokeWidth={sw * 0.6} opacity={0.55} />}
      {lvl >= 3 && <circle cx={x} cy={y} r={r * 0.98} fill="none" stroke={color} strokeWidth={sw * 0.4} strokeDasharray={`${r * 0.2} ${r * 0.15}`} opacity={0.7} />}
      {shape}
    </g>
  );
}

interface Props {
  core: CoreState;
  /** Highlighted (selected) slot. */
  selected?: number | null;
  onSlot?: (i: number) => void;
  className?: string;
}

/** The player's chip, drawn from its current configuration. */
export function Chip({ core, selected = null, onSlot, className = '' }: Props) {
  const color = COLORS.find((c) => c.id === core.color)?.hex ?? '#c8ff2e';
  const mat = MATERIALS.find((m) => m.id === core.material) ?? MATERIALS[0];
  const n = core.board;
  const cell = (S - INNER * 2) / n;
  const center = (i: number) => ({ x: INNER + (i % n) * cell + cell / 2, y: INNER + Math.floor(i / n) * cell + cell / 2 });
  const pinsPerSide = 4 + n * 2;
  const pinColor = core.pins === 'dorados' ? '#d9b44a' : core.pins === 'luz' ? color : '#5b616b';
  const traces: ReactNode[] = [];
  core.slots.forEach((s, i) => {
    if (!s) return;
    const a = center(i);
    for (const j of [i + 1, i + n]) {
      if (j >= core.slots.length || !core.slots[j] || (j === i + 1 && j % n === 0)) continue;
      const b = center(j);
      traces.push(<line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="chip-trace" stroke={color} />);
    }
  });

  return (
    <svg
      className={`chip chip--${core.anim}${core.color === 'arcoiris' ? ' chip--rainbow' : ''} ${className}`}
      viewBox={`0 0 ${S} ${S}`}
      role="img"
      aria-label={`Tu chip: ${core.slots.filter(Boolean).length} módulos`}
    >
      <defs>
        <filter id="chipGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="chipShine" cx="30%" cy="25%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Pins */}
      <g stroke={pinColor} strokeWidth={core.pins === 'dobles' ? 3 : 4} strokeLinecap="round" className={core.pins === 'luz' ? 'chip-pins-glow' : ''}>
        {Array.from({ length: pinsPerSide }, (_, k) => {
          const p = BODY + 20 + (k * (S - 2 * BODY - 40)) / (pinsPerSide - 1);
          const len = 22;
          const lines = [
            [p, BODY, p, BODY - len], [p, S - BODY, p, S - BODY + len],
            [BODY, p, BODY - len, p], [S - BODY, p, S - BODY + len, p],
          ];
          return lines.map(([x1, y1, x2, y2], q) => (
            <g key={`${k}-${q}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              {core.pins === 'dobles' && <line x1={x1 + (q < 2 ? 5 : 0)} y1={y1 + (q >= 2 ? 5 : 0)} x2={x2 + (q < 2 ? 5 : 0)} y2={y2 + (q >= 2 ? 5 : 0)} opacity={0.5} />}
            </g>
          ));
        })}
      </g>

      {/* Body */}
      <g className="chip-body">
        <rect x={BODY} y={BODY} width={S - BODY * 2} height={S - BODY * 2} rx={22} fill={mat.body} stroke={mat.edge} strokeWidth={2.5} />
        <rect x={BODY} y={BODY} width={S - BODY * 2} height={S - BODY * 2} rx={22} fill="url(#chipShine)" />
        <rect x={BODY + 10} y={BODY + 10} width={S - BODY * 2 - 20} height={S - BODY * 2 - 20} rx={14} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={1.2} />
        <circle cx={BODY + 18} cy={BODY + 18} r={4} fill={color} opacity={0.6} />
      </g>

      {/* Traces between neighbouring modules */}
      <g strokeWidth={3} strokeLinecap="round" opacity={0.7}>{traces}</g>

      {/* Sockets and modules */}
      {core.slots.map((s, i) => {
        const { x, y } = center(i);
        const r = cell * 0.4;
        return (
          <g key={i} onClick={onSlot ? () => onSlot(i) : undefined} className={onSlot ? 'chip-slot' : undefined}>
            <rect x={x - cell * 0.44} y={y - cell * 0.44} width={cell * 0.88} height={cell * 0.88} rx={cell * 0.14} fill={s ? 'rgba(255,255,255,0.03)' : 'transparent'} stroke={i === selected ? color : 'rgba(255,255,255,0.14)'} strokeWidth={i === selected ? 2.5 : 1.2} strokeDasharray={s ? undefined : '4 4'} />
            {s && <Module m={s.m} lvl={s.lvl} x={x} y={y} r={r} color={color} />}
          </g>
        );
      })}

      {core.anim === 'orbita' && (
        <g className="chip-orbit" style={{ transformOrigin: '160px 160px' }}>
          <circle cx={160} cy={18} r={6} fill={color} />
          <circle cx={160} cy={18} r={12} fill={color} opacity={0.25} />
        </g>
      )}
    </svg>
  );
}
