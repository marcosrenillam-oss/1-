import { shuffle } from '../../engine/rng';
import { pick, randInt, sample, spread, type Draft, type Family } from './util';

// 3×3 grids as 9-bit masks (bit i = cell i in reading order).
export type Mask = number;
export const tok = (m: Mask) => `{g-${Array.from({ length: 9 }, (_, i) => ((m >> i) & 1 ? '1' : '0')).join('')}}`;
export const cells = (...ids: number[]) => ids.reduce((m, i) => m | (1 << i), 0);
const map = (m: Mask, f: (r: number, c: number) => [number, number]) => {
  let out = 0;
  for (let i = 0; i < 9; i++) if ((m >> i) & 1) {
    const [r, c] = f(Math.floor(i / 3), i % 3);
    out |= 1 << (r * 3 + c);
  }
  return out;
};
export const rotCW = (m: Mask) => map(m, (r, c) => [c, 2 - r]);
export const rotCCW = (m: Mask) => map(m, (r, c) => [2 - c, r]);
export const mirror = (m: Mask) => map(m, (r, c) => [r, 2 - c]);
export const flipV = (m: Mask) => map(m, (r, c) => [2 - r, c]);
export const invert = (m: Mask) => ~m & 0x1ff;
export const bits = (m: Mask) => Array.from({ length: 9 }, (_, i) => (m >> i) & 1).reduce((a, b) => a + b, 0);

export function randomShape(rng: () => number, size: number): Mask {
  // A random asymmetric shape: all 4 rotations and the mirror image distinct.
  for (let t = 0; t < 200; t++) {
    const m = cells(...sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], size));
    const rots = [m, rotCW(m), rotCW(rotCW(m)), rotCCW(m)];
    const variants = new Set([...rots, mirror(m), flipV(m)]);
    if (variants.size === 6) return m;
  }
  return cells(0, 1, 3);
}

const PATHS: { cells: number[]; name: string }[] = [
  { cells: [0, 1, 2, 3, 4, 5, 6, 7, 8], name: 'en orden de lectura' },
  { cells: [0, 1, 2, 5, 8, 7, 6, 3], name: 'por el borde en sentido horario' },
  { cells: [0, 3, 6, 7, 8, 5, 2, 1], name: 'por el borde en sentido antihorario' },
  { cells: [0, 3, 6, 1, 4, 7, 2, 5, 8], name: 'columna a columna, de arriba abajo' },
];

function distinct4(correct: string, cands: string[]): string[] | null {
  const w = [...new Set(cands.filter((c) => c !== correct))];
  return w.length >= 3 ? w.slice(0, 3) : null;
}

// ─────────────────────────────────────────────────────────────────────────
const gridSeq: Family = {
  id: 'grd',
  counts: () => spread(2, 3, 3, 3, 2, 2),
  make: ({ D, rng }) => {
    const kinds = D <= 3 ? ['dot', 'grow'] : D <= 5 ? ['dot', 'grow', 'rot'] : D <= 7 ? ['rot', 'dot2', 'grow', 'mirrorRot'] : ['dot2', 'rotInv', 'mirrorRot', 'rot'];
    const kind = pick(rng, kinds);
    const L = D <= 4 ? 4 : 3;
    let frames: Mask[];
    let answer: Mask;
    let wrongs: Mask[];
    let expl: string;
    if (kind === 'dot' || kind === 'grow') {
      const path = pick(rng, D <= 3 ? PATHS.slice(0, 2) : PATHS);
      const step = D >= 5 && kind === 'dot' ? pick(rng, [1, 2]) : 1;
      const start = randInt(rng, 0, path.cells.length - 1);
      const at = (i: number) => path.cells[(start + i * step) % path.cells.length];
      if (kind === 'dot') {
        frames = Array.from({ length: L }, (_, i) => cells(at(i)));
        answer = cells(at(L));
        wrongs = [cells(at(L + 1)), cells(at(L - 1)), cells(path.cells[(start + L * step + 3) % path.cells.length]), cells(4)];
        expl = `El punto avanza ${step === 2 ? 'de dos en dos casillas' : 'una casilla'} ${path.name}.`;
      } else {
        if (start + L + 1 > path.cells.length) return null;
        const upto = (k: number) => cells(...path.cells.slice(start, start + k));
        frames = Array.from({ length: L }, (_, i) => upto(i + 1));
        answer = upto(L + 1);
        wrongs = [upto(L + 2), upto(L) | cells(path.cells[(start + L + 2) % path.cells.length]), invert(upto(L + 1)), upto(L)];
        expl = `En cada paso se rellena una casilla más, ${path.name}.`;
      }
    } else if (kind === 'rot') {
      const s = randomShape(rng, D <= 6 ? 3 : 4);
      const cw = rng() < 0.5;
      const f = cw ? rotCW : rotCCW;
      frames = [s];
      for (let i = 1; i < L; i++) frames.push(f(frames[i - 1]));
      answer = f(frames[L - 1]);
      wrongs = [(cw ? rotCCW : rotCW)(frames[L - 1]), mirror(answer), frames[L - 1], flipV(answer)];
      expl = `La figura gira un cuarto de vuelta en sentido ${cw ? 'horario' : 'antihorario'} en cada paso.`;
    } else if (kind === 'mirrorRot') {
      const s = randomShape(rng, 4);
      frames = [s];
      for (let i = 1; i < L; i++) frames.push(i % 2 ? mirror(frames[i - 1]) : rotCW(frames[i - 1]));
      const next = (m: Mask, i: number) => (i % 2 ? mirror(m) : rotCW(m));
      answer = next(frames[L - 1], L);
      wrongs = [next(frames[L - 1], L + 1), frames[L - 1], rotCCW(frames[L - 1]), flipV(answer)];
      expl = 'Se alternan dos movimientos: reflejo horizontal y giro de un cuarto de vuelta en sentido horario.';
    } else if (kind === 'rotInv') {
      const s = randomShape(rng, 3);
      const f = (i: number) => (i % 2 ? invert : (x: Mask) => x)(nRot(s, i));
      frames = Array.from({ length: L }, (_, i) => f(i));
      answer = f(L);
      wrongs = [nRot(s, L), invert(f(L)), f(L - 1), invert(nRot(s, L + 1))];
      expl = 'La figura gira un cuarto de vuelta en sentido horario en cada paso y, además, los colores se invierten uno sí y otro no.';
    } else {
      // dot2: one dot clockwise on the border, another anticlockwise.
      const ring = [0, 1, 2, 5, 8, 7, 6, 3];
      const a0 = randInt(rng, 0, 7);
      const b0 = randInt(rng, 0, 7);
      const sa = pick(rng, [1, 2]);
      const fr = (i: number) => cells(ring[(a0 + i * sa) % 8], ring[(b0 - i + 80) % 8]);
      frames = Array.from({ length: L }, (_, i) => fr(i));
      if (frames.some((m) => bits(m) !== 2) || bits(fr(L)) !== 2) return null;
      answer = fr(L);
      wrongs = [cells(ring[(a0 + L * sa) % 8], ring[(b0 + L) % 8]), fr(L + 1), fr(L - 1), cells(ring[(a0 + (L + 1) * sa) % 8], ring[(b0 - L + 80) % 8])];
      expl = `Hay dos puntos sobre el borde: uno avanza ${sa === 2 ? 'dos casillas' : 'una casilla'} en sentido horario y el otro una casilla en sentido antihorario.`;
    }
    if (frames.some((m) => m === 0 || m === 0x1ff)) return null;
    const w = distinct4(tok(answer), wrongs.filter((m) => m !== 0).map(tok));
    if (!w) return null;
    return { cat: 'visual', prompt: '¿Qué cuadrícula sigue?', correct: tok(answer), wrong: w, expl, visual: [frames.map(tok).join(' ') + ' ?'] };
  },
};

function nRot(m: Mask, n: number): Mask {
  let r = m;
  for (let i = 0; i < n % 4; i++) r = rotCW(r);
  return r;
}

// ─────────────────────────────────────────────────────────────────────────
const OPS = {
  or: { f: (a: Mask, b: Mask) => a | b, expl: 'La tercera cuadrícula de cada fila reúne todas las casillas rellenas de las dos primeras.' },
  and: { f: (a: Mask, b: Mask) => a & b, expl: 'La tercera cuadrícula de cada fila conserva solo las casillas que están rellenas en las dos primeras.' },
  xor: { f: (a: Mask, b: Mask) => a ^ b, expl: 'La tercera cuadrícula de cada fila superpone las dos primeras y elimina las casillas que coinciden.' },
  sub: { f: (a: Mask, b: Mask) => a & ~b, expl: 'La tercera cuadrícula de cada fila es la primera menos las casillas rellenas de la segunda.' },
};
type OpKey = keyof typeof OPS;
const matrix: Family = {
  id: 'mtx',
  counts: (m) => (m === 'facil' ? spread(0, 0, 1, 1, 2, 1) : spread(0, 1, 2, 2, 2, 2)),
  make: ({ D, rng }) => {
    const keys: OpKey[] = D <= 5 ? ['or', 'and'] : ['or', 'and', 'xor', 'sub'];
    const op = pick(rng, keys);
    const rows: Mask[][] = [];
    for (let r = 0; r < 3; r++) {
      const a = cells(...sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], randInt(rng, 3, 5)));
      const b = cells(...sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], randInt(rng, 3, 5)));
      rows.push([a, b, OPS[op].f(a, b)]);
    }
    if (rows.some(([, , c]) => c === 0 || c === 0x1ff)) return null;
    // Rows 1-2 must rule out every other operation.
    for (const k of Object.keys(OPS) as OpKey[]) {
      if (k === op) continue;
      if (rows.slice(0, 2).every(([a, b, c]) => OPS[k].f(a, b) === c)) return null;
    }
    const [a, b, c] = rows[2];
    const wrongs = (Object.keys(OPS) as OpKey[]).filter((k) => k !== op).map((k) => OPS[k].f(a, b)).concat([invert(c), b & ~a]);
    const w = distinct4(tok(c), wrongs.filter((m) => m !== 0).map(tok));
    if (!w) return null;
    return {
      cat: 'visual',
      prompt: '¿Qué cuadrícula falta?',
      correct: tok(c),
      wrong: w,
      expl: OPS[op].expl,
      visual: [rows[0].map(tok).join(' '), rows[1].map(tok).join(' '), `${tok(a)} ${tok(b)} ?`],
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
const SHAPES = ['ci', 'sq', 'tr', 'di', 'st'];
const SHAPE_NAME: Record<string, string> = { ci: 'círculo', sq: 'cuadrado', tr: 'triángulo', di: 'rombo', st: 'estrella' };
const shapeSeq: Family = {
  id: 'shp',
  counts: (m) => (m === 'experto' ? spread(2, 2, 2, 1, 1, 0) : spread(3, 3, 2, 2, 1, 1)),
  make: ({ D, rng }) => {
    const p = D <= 2 ? 2 : D <= 5 ? pick(rng, [2, 3]) : pick(rng, [3, 4]);
    const q = D <= 2 ? 1 : D <= 4 ? pick(rng, [1, 2]) : pick(rng, [2, 3]);
    const cyc = sample(rng, SHAPES, p);
    if (p === 4 && rng() < 0.5) cyc[3] = cyc[1]; // patterns like A B C B
    const fill = Array.from({ length: q }, () => rng() < 0.5);
    if (q > 1 && fill.every((f) => f === fill[0])) fill[0] = !fill[0];
    const L = Math.min(8, Math.max(2 * p, 2 * q, 6));
    const item = (i: number) => `{${cyc[i % p]}${fill[i % q] ? '' : 'o'}}`;
    const seq = Array.from({ length: L }, (_, i) => item(i));
    const ans = item(L);
    const shape = cyc[L % p];
    const filled = fill[L % q];
    const other = pick(rng, SHAPES.filter((s) => s !== shape));
    const wrong = shuffle([`{${shape}${filled ? 'o' : ''}}`, `{${other}${filled ? '' : 'o'}}`, `{${other}${filled ? 'o' : ''}}`, item(L + 1), item(L - 1)], rng);
    const w = distinct4(ans, wrong);
    if (!w) return null;
    const fillTxt = q === 1 ? '' : ` El relleno sigue su propio ciclo de ${q}: ${fill.map((f) => (f ? 'lleno' : 'hueco')).join(', ')}.`;
    return {
      cat: 'visual',
      prompt: '¿Qué figura sigue?',
      correct: ans,
      wrong: w,
      expl: `Las formas se repiten en bloques de ${p}: ${cyc.map((s) => SHAPE_NAME[s]).join(', ')}.${fillTxt}`,
      visual: [seq.join(' ') + ' ?'],
    };
  },
};

const DIRS = ['u', 'ur', 'r', 'dr', 'd', 'dl', 'l', 'ul'];
const arrows: Family = {
  id: 'arw',
  counts: () => spread(2, 2, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const step = D <= 2 ? 2 : D <= 5 ? pick(rng, [1, 2, 3]) : pick(rng, [1, 3, 5]);
    const cw = D <= 2 ? true : rng() < 0.5;
    const start = randInt(rng, 0, 7);
    const alt = D >= 6 && rng() < 0.5; // alternating steps
    const steps = alt ? [step, pick(rng, [1, 2, 3].filter((s) => s !== step))] : [step];
    const seq: number[] = [start];
    const L = alt ? 6 : 5;
    for (let i = 1; i <= L; i++) seq.push((seq[i - 1] + (cw ? 1 : -1) * steps[(i - 1) % steps.length] + 80) % 8);
    const shown = seq.slice(0, L).map((d) => `{ar-${DIRS[d]}}`);
    const ans = `{ar-${DIRS[seq[L]]}}`;
    const cands = shuffle(DIRS.map((d) => `{ar-${d}}`), rng);
    const near = [`{ar-${DIRS[(seq[L] + 4) % 8]}}`, `{ar-${DIRS[seq[L - 1]]}}`];
    const w = distinct4(ans, [...near, ...cands]);
    if (!w) return null;
    const deg = (s: number) => `${s * 45}°`;
    return {
      cat: 'visual',
      prompt: '¿Qué flecha sigue?',
      correct: ans,
      wrong: w,
      expl: alt
        ? `La flecha gira alternando ${deg(steps[0])} y ${deg(steps[1])} en sentido ${cw ? 'horario' : 'antihorario'}.`
        : `La flecha gira ${deg(step)} en sentido ${cw ? 'horario' : 'antihorario'} en cada paso.`,
      visual: [shown.join(' ') + ' ?'],
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Observation: spot the different one / the unique one.
// ─────────────────────────────────────────────────────────────────────────
const ODD_PAIRS: [number, string, string][] = [
  [1, 'ci', 'cio'], [1, 'sq', 'ci'], [1, 'tr', 'trd'], [1, 'st', 'sto'], [1, 'di', 'sq'],
  [3, 'ar-u', 'ar-ur'], [3, 'hc-t', 'hc-r'], [3, 'ar-r', 'ar-l'], [3, 'sq', 'di'], [3, 'hc-l', 'hc-r'],
  [5, 'ar-ur', 'ar-ul'], [5, 'hc-b', 'hc-l'], [5, 'ar-dl', 'ar-dr'], [5, 'st', 'sto'],
];
const ROWS = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta'];
const oddCell: Family = {
  id: 'odd',
  counts: () => spread(2, 2, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const useGrid = D >= 7;
    const R = D <= 2 ? 3 : 4;
    const C = D <= 2 ? 4 : useGrid ? 4 : 5;
    let base: string;
    let odd: string;
    if (useGrid) {
      const m = randomShape(rng, 4);
      base = tok(m);
      const flip = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
      odd = tok(m ^ (1 << flip));
    } else {
      const pool = ODD_PAIRS.filter(([lv]) => lv <= D && lv >= D - 4);
      const [, a, b] = pick(rng, pool);
      [base, odd] = rng() < 0.5 ? [`{${a}}`, `{${b}}`] : [`{${b}}`, `{${a}}`];
    }
    const r = randInt(rng, 0, R - 1);
    const c = randInt(rng, 0, C - 1);
    const visual = Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => (i === r && j === c ? odd : base)).join(' '));
    const label = (i: number, j: number) => `Fila ${i + 1}, columna ${j + 1}`;
    const others: string[] = [];
    for (const [dr, dc] of shuffle([[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]], rng)) {
      const i = r + dr;
      const j = c + dc;
      if (i >= 0 && i < R && j >= 0 && j < C) others.push(label(i, j));
    }
    others.push(label(c % R, r % C));
    const w = distinct4(label(r, c), others);
    if (!w) return null;
    return {
      cat: 'observacion',
      prompt: '¿Dónde está la figura distinta?',
      correct: label(r, c),
      wrong: w,
      expl: `Está en la ${ROWS[r]} fila, columna ${c + 1}${useGrid ? ': su cuadrícula tiene una casilla diferente' : ''}.`,
      visual,
    };
  },
};

const UNIQUE_SET = ['ci', 'cio', 'sq', 'sqo', 'tr', 'tro', 'di', 'dio', 'st', 'sto', 'trd', 'trdo'];
const uniqueOne: Family = {
  id: 'unq',
  counts: () => spread(1, 2, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const kinds = D <= 3 ? 4 : D <= 6 ? 5 : 6;
    const set = D >= 5 ? sample(rng, UNIQUE_SET, kinds) : sample(rng, ['ci', 'sq', 'tr', 'di', 'st', 'trd'], kinds);
    const [uniq, ...rest] = set;
    const C = 4;
    const R = D <= 3 ? 3 : 4;
    const total = R * C;
    const items = [uniq];
    rest.forEach((s) => items.push(s, s));
    while (items.length < total) items.push(pick(rng, rest));
    const grid = shuffle(items, rng).map((s) => `{${s}}`);
    const visual = Array.from({ length: R }, (_, i) => grid.slice(i * C, i * C + C).join(' '));
    return {
      cat: 'observacion',
      prompt: '¿Qué figura aparece una sola vez?',
      correct: `{${uniq}}`,
      wrong: sample(rng, rest, 3).map((s) => `{${s}}`),
      expl: 'Todas las demás figuras se repiten al menos dos veces.',
      visual,
    };
  },
};

export const VISUAL_FAMILIES = [gridSeq, matrix, shapeSeq, arrows, oddCell, uniqueOne];
export type { Draft };
