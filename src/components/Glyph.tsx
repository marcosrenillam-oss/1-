import { Fragment, type ReactNode } from 'react';

const ARROW_ANGLE: Record<string, number> = { u: 0, ur: 45, r: 90, dr: 135, d: 180, dl: 225, l: 270, ul: 315 };
const HALF_ANGLE: Record<string, number> = { t: 0, r: 90, b: 180, l: 270 };
const ARROW_NAME: Record<string, string> = {
  u: 'arriba', ur: 'arriba derecha', r: 'derecha', dr: 'abajo derecha',
  d: 'abajo', dl: 'abajo izquierda', l: 'izquierda', ul: 'arriba izquierda',
};
const SHAPE_NAME: Record<string, string> = {
  sq: 'cuadrado', ci: 'círculo', tr: 'triángulo', trd: 'triángulo invertido', di: 'rombo', st: 'estrella',
};
const STAR = 'M12 2.2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.1l-6.1 3.5 1.5-6.8L2.2 9.2l6.9-.7z';

function label(token: string): string {
  if (token.startsWith('ar-')) return `flecha hacia ${ARROW_NAME[token.slice(3)] ?? ''}`;
  if (token.startsWith('hc-')) return 'círculo medio relleno';
  if (token.startsWith('g-')) return 'cuadrícula';
  const outline = token.endsWith('o') && token !== 'o';
  const base = outline ? token.slice(0, -1) : token;
  return `${SHAPE_NAME[base] ?? token}${outline ? ' hueco' : ''}`;
}

/** Vector shapes for visual-pattern questions. Uses currentColor. */
export function Glyph({ token }: { token: string }) {
  const common = { className: 'glyph', viewBox: '0 0 24 24', role: 'img', 'aria-label': label(token) } as const;

  if (token.startsWith('g-')) {
    const bits = token.slice(2);
    return (
      <svg className="glyph glyph-grid" viewBox="0 0 30 30" role="img" aria-label={label(token)}>
        {bits.split('').map((b, i) => {
          const x = 1 + (i % 3) * 9.5;
          const y = 1 + Math.floor(i / 3) * 9.5;
          return b === '1' ? (
            <rect key={i} x={x} y={y} width={8.5} height={8.5} rx={1.6} fill="currentColor" />
          ) : (
            <rect key={i} x={x + 0.6} y={y + 0.6} width={7.3} height={7.3} rx={1.3} fill="none" stroke="currentColor" strokeOpacity={0.28} strokeWidth={1.2} />
          );
        })}
      </svg>
    );
  }

  if (token.startsWith('ar-')) {
    const a = ARROW_ANGLE[token.slice(3)] ?? 0;
    return (
      <svg {...common}>
        <g transform={`rotate(${a} 12 12)`}>
          <path d="M12 3.2 L19 10.6 H14.4 V20.8 H9.6 V10.6 H5 Z" fill="currentColor" />
        </g>
      </svg>
    );
  }

  if (token.startsWith('hc-')) {
    const a = HALF_ANGLE[token.slice(3)] ?? 0;
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="2" />
        <g transform={`rotate(${a} 12 12)`}>
          <path d="M3.4 12 A8.6 8.6 0 0 1 20.6 12 Z" fill="currentColor" />
        </g>
      </svg>
    );
  }

  const outline = token.length > 2 && token.endsWith('o');
  const base = outline ? token.slice(0, -1) : token;
  const paint = outline
    ? { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinejoin: 'round' as const }
    : { fill: 'currentColor' };

  let shape: ReactNode = null;
  switch (base) {
    case 'sq':
      shape = <rect x={outline ? 4.1 : 3} y={outline ? 4.1 : 3} width={outline ? 15.8 : 18} height={outline ? 15.8 : 18} rx="2.4" {...paint} />;
      break;
    case 'ci':
      shape = <circle cx="12" cy="12" r={outline ? 8.4 : 9.4} {...paint} />;
      break;
    case 'tr':
      shape = <path d={outline ? 'M12 4.4 L20 19.2 H4 Z' : 'M12 2.8 L21.4 20.4 H2.6 Z'} {...paint} />;
      break;
    case 'trd':
      shape = <path d={outline ? 'M4 4.8 H20 L12 19.6 Z' : 'M2.6 3.6 H21.4 L12 21.2 Z'} {...paint} />;
      break;
    case 'di':
      shape = <path d={outline ? 'M12 3.4 L20.6 12 L12 20.6 L3.4 12 Z' : 'M12 1.8 L22.2 12 L12 22.2 L1.8 12 Z'} {...paint} />;
      break;
    case 'st':
      shape = <path d={STAR} {...paint} />;
      break;
    default:
      return <span>{`{${token}}`}</span>;
  }
  return <svg {...common}>{shape}</svg>;
}

const TOKEN_RE = /\{([a-z0-9-]+)\}/g;

export function hasGlyph(text: string): boolean {
  return /\{[a-z0-9-]+\}/.test(text);
}

export function glyphCount(text: string): number {
  return (text.match(TOKEN_RE) ?? []).length;
}

/** Renders text, replacing {token} markers with vector glyphs. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(<Glyph key={idx} token={m[1]} />);
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
