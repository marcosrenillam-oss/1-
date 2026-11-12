import { shuffle } from '../../engine/rng';
import { cap, list, or, permutations, pick, sample, spread, NAMES, type Ctx, type Draft, type Family } from './util';

const ORD_M = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto'];
const ORD_F = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'];
const NUM = ['', '', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

const KK = 'En una isla, los caballeros siempre dicen la verdad y los bribones siempre mienten.';

function withUnknown(correct: string, others: string[]): string[] {
  const w = others.filter((o) => o !== correct).slice(0, 3);
  while (w.length < 3) w.push('No se puede saber');
  return w;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Ordering puzzles (race, queue, building)
// ─────────────────────────────────────────────────────────────────────────
interface OrderCtx {
  intro: (names: string[]) => string;
  before: (a: string, b: string) => string;
  justBefore: (a: string, b: string) => string;
  notExtreme: (a: string) => string;
  at: (a: string, k: number) => string;
  notAt: (a: string, k: number) => string;
  between: (a: string, b: string, c: string) => string;
  notAdj: (a: string, b: string) => string;
  qAt: (k: number, n: number) => string;
  qAfter: (x: string) => string;
  expl: (order: string[]) => string;
}

const ORDER_CTX: OrderCtx[] = [
  {
    intro: (ns) => `${list(ns)} corren una carrera. No hay empates.`,
    before: (a, b) => `${a} llegó antes que ${b}.`,
    justBefore: (a, b) => `${b} llegó justo detrás de ${a}.`,
    notExtreme: (a) => `${a} no llegó ni en primer ni en último lugar.`,
    at: (a, k) => `${a} llegó en ${ORD_M[k]} lugar.`,
    notAt: (a, k) => `${a} no llegó en ${ORD_M[k]} lugar.`,
    between: (a, b, c) => `${a} llegó después que ${b} y antes que ${c}.`,
    notAdj: (a, b) => `${a} y ${b} no llegaron uno justo detrás del otro.`,
    qAt: (k, n) => (k === n - 1 ? '¿Quién llegó en último lugar?' : `¿Quién llegó en ${ORD_M[k]} lugar?`),
    qAfter: (x) => `¿Quién llegó justo detrás de ${x}?`,
    expl: (o) => `El orden de llegada es: ${o.join(', ')}.`,
  },
  {
    intro: (ns) => `${list(ns)} hacen cola para entrar al cine.`,
    before: (a, b) => `${a} está por delante de ${b}.`,
    justBefore: (a, b) => `${b} está justo detrás de ${a}.`,
    notExtreme: (a) => `${a} no ocupa ninguno de los dos extremos de la cola.`,
    at: (a, k) => `${a} ocupa la ${ORD_F[k]} posición.`,
    notAt: (a, k) => `${a} no ocupa la ${ORD_F[k]} posición.`,
    between: (a, b, c) => `${a} está en algún lugar entre ${b} y ${c}.`,
    notAdj: (a, b) => `${a} y ${b} no están uno al lado del otro.`,
    qAt: (k, n) =>
      k === n - 1 ? '¿Quién está al final de la cola?' : k === 0 ? '¿Quién está al principio de la cola?' : `¿Quién ocupa la ${ORD_F[k]} posición?`,
    qAfter: (x) => `¿Quién está justo detrás de ${x}?`,
    expl: (o) => `La cola, de principio a fin, es: ${o.join(', ')}.`,
  },
  {
    intro: (ns) => `${list(ns)} viven en un edificio de ${NUM[ns.length]} plantas, cada uno en una planta distinta.`,
    before: (a, b) => `${a} vive más abajo que ${b}.`,
    justBefore: (a, b) => `${a} vive justo debajo de ${b}.`,
    notExtreme: (a) => `${a} no vive ni en la planta más baja ni en la más alta.`,
    at: (a, k) => `${a} vive en la ${ORD_F[k]} planta.`,
    notAt: (a, k) => `${a} no vive en la ${ORD_F[k]} planta.`,
    between: (a, b, c) => `La planta de ${a} está entre la de ${b} y la de ${c}.`,
    notAdj: (a, b) => `${a} y ${b} no viven en plantas contiguas.`,
    qAt: (k, n) =>
      k === n - 1 ? '¿Quién vive en la planta más alta?' : k === 0 ? '¿Quién vive en la planta más baja?' : `¿Quién vive en la ${ORD_F[k]} planta?`,
    qAfter: (x) => `¿Quién vive justo encima de ${x}?`,
    expl: (o) => `De abajo arriba: ${o.join(', ')}.`,
  },
];

type Pos = Record<string, number>;
interface Clue {
  text: string;
  test: (p: Pos) => boolean;
  atFor?: string;
}

const ordering: Family = {
  id: 'ord',
  counts: (m) => (m === 'facil' ? spread(3, 3, 3, 3, 2, 2) : m === 'normal' ? spread(2, 3, 3, 3, 2, 2) : spread(2, 2, 3, 3, 3, 2)),
  make: ({ D, rng }) => {
    const n = D <= 2 ? 3 : D <= 4 ? 4 : D <= 7 ? 5 : 6;
    const names = sample(rng, NAMES, n);
    const sol = shuffle(names, rng);
    const pos: Pos = Object.fromEntries(sol.map((x, i) => [x, i]));
    const C = pick(rng, ORDER_CTX);
    const types = D <= 2 ? ['at', 'before', 'justBefore'] : D <= 4 ? ['before', 'justBefore', 'notExtreme', 'notAt', 'at'] : ['before', 'justBefore', 'notExtreme', 'between', 'notAdj', 'notAt'];
    const pool: Clue[] = [];
    for (const a of names)
      for (const b of names) {
        if (a === b) continue;
        if (types.includes('before') && pos[a] < pos[b] && pos[b] - pos[a] > 1) pool.push({ text: C.before(a, b), test: (p) => p[a] < p[b] });
        if (types.includes('justBefore') && pos[b] === pos[a] + 1) pool.push({ text: C.justBefore(a, b), test: (p) => p[b] === p[a] + 1 });
        if (types.includes('notAdj') && a < b && Math.abs(pos[a] - pos[b]) > 1) pool.push({ text: C.notAdj(a, b), test: (p) => Math.abs(p[a] - p[b]) > 1 });
        if (types.includes('between'))
          for (const c of names) {
            if (c === a || c === b || !(pos[b] < pos[a] && pos[a] < pos[c])) continue;
            pool.push({ text: C.between(a, b, c), test: (p) => Math.min(p[b], p[c]) < p[a] && p[a] < Math.max(p[b], p[c]) });
          }
      }
    for (const a of names) {
      if (types.includes('notExtreme') && pos[a] > 0 && pos[a] < n - 1) pool.push({ text: C.notExtreme(a), test: (p) => p[a] > 0 && p[a] < n - 1 });
      if (types.includes('at')) pool.push({ text: C.at(a, pos[a]), test: (p) => p[a] === pos[a], atFor: a });
      if (types.includes('notAt'))
        for (let k = 0; k < n; k++) if (k !== pos[a]) pool.push({ text: C.notAt(a, k), test: (p) => p[a] !== k });
    }
    const perms = permutations(names).map((o) => Object.fromEntries(o.map((x, i) => [x, i])) as Pos);
    const count = (cs: Clue[]) => perms.filter((p) => cs.every((c) => c.test(p))).length;
    let clues: Clue[] = [];
    for (const c of shuffle(pool, rng)) {
      clues.push(c);
      if (count(clues) === 1) break;
    }
    if (count(clues) !== 1) return null;
    for (const c of shuffle(clues, rng)) {
      const without = clues.filter((x) => x !== c);
      if (count(without) === 1) clues = without;
    }
    if (D >= 3 && clues.filter((c) => c.atFor).length > 1) return null;
    let prompt: string;
    let answer: string;
    if (rng() < 0.6) {
      const k = Math.floor(rng() * n);
      answer = sol[k];
      prompt = C.qAt(k, n);
    } else {
      const k = Math.floor(rng() * (n - 1));
      answer = sol[k + 1];
      prompt = C.qAfter(sol[k]);
    }
    if (clues.some((c) => c.atFor === answer)) return null;
    return {
      cat: 'deductiva',
      prompt: `${C.intro(shuffle(names, rng))}\n${shuffle(clues, rng).map((c) => `• ${c.text}`).join('\n')}\n${prompt}`,
      correct: answer,
      wrong: withUnknown(answer, shuffle(names, rng)),
      expl: C.expl(sol),
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 2. Who has what (1 or 2 attributes)
// ─────────────────────────────────────────────────────────────────────────
interface Attr {
  verb: string;
  verbPl: string;
  items: string[];
  intro: (ns: string) => string;
  q: (subject: string) => string;
  label: (item: string) => string;
}
const ATTRS: Attr[] = [
  { verb: 'tiene', verbPl: 'tienen', items: ['el perro', 'el gato', 'el pez', 'el loro'], intro: (ns) => `${ns} tienen cada uno una mascota distinta`, q: (s) => `¿Qué mascota tiene ${s}?`, label: cap },
  { verb: 'toca', verbPl: 'tocan', items: ['la guitarra', 'el piano', 'el violín', 'la batería'], intro: (ns) => `${ns} tocan cada uno un instrumento distinto`, q: (s) => `¿Qué instrumento toca ${s}?`, label: cap },
  { verb: 'practica', verbPl: 'practican', items: ['tenis', 'natación', 'ajedrez', 'ciclismo'], intro: (ns) => `${ns} practican cada uno un deporte distinto`, q: (s) => `¿Qué deporte practica ${s}?`, label: cap },
  { verb: 'pide', verbPl: 'piden', items: ['café', 'té', 'zumo', 'agua'], intro: (ns) => `${ns} piden cada uno una bebida distinta`, q: (s) => `¿Qué bebida pide ${s}?`, label: cap },
  { verb: 'lleva', verbPl: 'llevan', items: ['la camiseta roja', 'la camiseta azul', 'la camiseta verde', 'la camiseta amarilla'], intro: (ns) => `${ns} llevan cada uno una camiseta de un color distinto`, q: (s) => `¿Qué camiseta lleva ${s}?`, label: cap },
  { verb: 'viaja a', verbPl: 'viajan a', items: ['Roma', 'Lima', 'Oslo', 'Quito'], intro: (ns) => `${ns} viajan cada uno a una ciudad distinta`, q: (s) => `¿A qué ciudad viaja ${s}?`, label: (x) => x },
  { verb: 'estudia', verbPl: 'estudian', items: ['música', 'química', 'historia', 'dibujo'], intro: (ns) => `${ns} estudian cada uno una asignatura distinta`, q: (s) => `¿Qué estudia ${s}?`, label: cap },
];

const assignment: Family = {
  id: 'asg',
  counts: (m) => (m === 'facil' ? spread(3, 3, 3, 3, 2, 1) : spread(2, 3, 3, 3, 2, 2)),
  make: ({ D, rng }) => {
    const n = D <= 3 ? 3 : 4;
    const two = D >= 6;
    const [A, B] = sample(rng, ATTRS, 2);
    const names = sample(rng, NAMES, n);
    const ia = sample(rng, A.items, n);
    const ib = sample(rng, B.items, n);
    const solA = shuffle(ia, rng);
    const solB = shuffle(ib, rng);
    type Sol = { a: string[]; b: string[] };
    const all: Sol[] = [];
    const pa = permutations(ia);
    const pb = two ? permutations(ib) : [solB];
    for (const a of pa) for (const b of pb) all.push({ a, b });
    const idx = (s: string[], it: string) => s.indexOf(it);
    interface C2 { text: string; test: (s: Sol) => boolean }
    const pool: C2[] = [];
    names.forEach((p, i) => {
      for (const it of ia) {
        if (solA[i] !== it) pool.push({ text: `${p} no ${A.verb} ${it}.`, test: (s) => s.a[i] !== it });
        else if (D <= 2) pool.push({ text: `${p} ${A.verb} ${it}.`, test: (s) => s.a[i] === it });
      }
      if (two)
        for (const it of ib) if (solB[i] !== it) pool.push({ text: `${p} no ${B.verb} ${it}.`, test: (s) => s.b[i] !== it });
    });
    for (const it of ia) {
      const owner = idx(solA, it);
      for (let j = 0; j < n; j++) {
        if (j === owner) continue;
        const [x, y] = rng() < 0.5 ? [owner, j] : [j, owner];
        pool.push({ text: `Quien ${A.verb} ${it} es ${or(names[x], names[y])}.`, test: (s) => s.a[x] === it || s.a[y] === it });
      }
      if (n >= 3) {
        const others = names.map((_, k) => k).filter((k) => k !== owner);
        const [x, y] = sample(rng, others, 2);
        pool.push({ text: `Ni ${names[x]} ni ${names[y]} ${A.verbPl} ${it}.`, test: (s) => s.a[x] !== it && s.a[y] !== it });
      }
    }
    if (two)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const a = ia[i];
          const b = ib[j];
          const linked = idx(solA, a) === idx(solB, b);
          pool.push({
            text: linked ? `Quien ${A.verb} ${a} ${B.verb} ${b}.` : `Quien ${A.verb} ${a} no ${B.verb} ${b}.`,
            test: (s) => (idx(s.a, a) === idx(s.b, b)) === linked,
          });
        }
    const count = (cs: C2[]) => all.filter((s) => cs.every((c) => c.test(s))).length;
    let clues: C2[] = [];
    for (const c of shuffle(pool, rng)) {
      clues.push(c);
      if (count(clues) === 1) break;
    }
    if (count(clues) !== 1) return null;
    for (const c of shuffle(clues, rng)) {
      const w = clues.filter((x) => x !== c);
      if (count(w) === 1) clues = w;
    }
    const intro = two
      ? `${A.intro(list(names))} (${list(ia.map((x) => x.replace(/^(el|la) /, '')))}) y, además, ${B.verbPl.replace(/ a$/, '')} cada uno ${B === ATTRS[5] ? 'a una ciudad' : 'algo'} distinto: ${list(ib)}.`
      : `${A.intro(list(names))}: ${list(ia.map((x) => x.replace(/^(el|la) /, '')))}.`;
    let prompt: string;
    let correct: string;
    let wrong: string[];
    const r = rng();
    if (two && r < 0.5) {
      const i = Math.floor(rng() * n);
      prompt = B.q(`quien ${A.verb} ${solA[i]}`);
      correct = B.label(solB[i]);
      wrong = withUnknown(correct, shuffle(ib, rng).map(B.label));
    } else if (r < 0.75) {
      const i = Math.floor(rng() * n);
      prompt = A.q(names[i]);
      correct = A.label(solA[i]);
      wrong = withUnknown(correct, shuffle(ia, rng).map(A.label));
    } else {
      const i = Math.floor(rng() * n);
      prompt = `¿Quién ${A.verb} ${solA[i]}?`;
      correct = names[i];
      wrong = withUnknown(correct, shuffle(names, rng));
    }
    const expl = names.map((p, i) => `${p}: ${solA[i]}${two ? `, ${solB[i]}` : ''}`).join(' · ') + '.';
    return {
      cat: 'deductiva',
      prompt: `${intro}\n${shuffle(clues, rng).map((c) => `• ${c.text}`).join('\n')}\n${prompt}`,
      correct,
      wrong,
      expl: `Solo hay un reparto posible: ${expl}`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 3. Knights and knaves
// ─────────────────────────────────────────────────────────────────────────
interface Stmt { text: string; truth: (k: boolean[]) => boolean }

function statementsFor(s: number, names: string[], rng: () => number): Stmt[] {
  const n = names.length;
  const others = names.map((_, i) => i).filter((i) => i !== s);
  const o = pick(rng, others);
  const all = names.map((_, i) => i);
  const res: Stmt[] = [
    { text: `${names[o]} siempre miente.`, truth: (k) => !k[o] },
    { text: `${names[o]} siempre dice la verdad.`, truth: (k) => k[o] },
    { text: `${names[o]} y yo somos del mismo tipo.`, truth: (k) => k[s] === k[o] },
    { text: `${names[o]} y yo somos de distinto tipo.`, truth: (k) => k[s] !== k[o] },
    { text: 'Al menos uno de nosotros es bribón.', truth: (k) => all.some((i) => !k[i]) },
    { text: n === 2 ? 'Los dos somos bribones.' : 'Los tres somos bribones.', truth: (k) => all.every((i) => !k[i]) },
    { text: 'Exactamente uno de nosotros es caballero.', truth: (k) => all.filter((i) => k[i]).length === 1 },
  ];
  if (n === 3) {
    const [x, y] = others;
    res.push({ text: `${names[x]} y ${names[y]} son del mismo tipo.`, truth: (k) => k[x] === k[y] });
    res.push({ text: `Exactamente dos de nosotros son caballeros.`, truth: (k) => all.filter((i) => k[i]).length === 2 });
  }
  return res;
}

function describe(k: boolean[], names: string[]): string {
  const kn = names.filter((_, i) => k[i]);
  if (kn.length === 0) return 'Ninguno es caballero';
  if (kn.length === names.length) return names.length === 2 ? 'Los dos son caballeros' : 'Los tres son caballeros';
  return `Solo ${list(kn)} ${kn.length === 1 ? 'es caballero' : 'son caballeros'}`;
}

const knights: Family = {
  id: 'kk',
  counts: (m) => (m === 'facil' ? spread(0, 0, 1, 2, 2, 1) : m === 'normal' ? spread(1, 1, 2, 2, 2, 1) : spread(1, 2, 2, 2, 2, 2)),
  make: ({ D, rng }) => {
    const n = D <= 5 ? 2 : 3;
    const names = sample(rng, NAMES, n);
    const speakers = n === 2 ? (rng() < 0.4 ? [0] : [0, 1]) : D >= 8 ? [0, 1, 2] : [0, 1];
    const stmts = speakers.map((s) => ({ s, st: pick(rng, statementsFor(s, names, rng)) }));
    const worlds: boolean[][] = [];
    for (let m = 0; m < 1 << n; m++) worlds.push(names.map((_, i) => !!(m & (1 << i))));
    const ok = worlds.filter((k) => stmts.every(({ s, st }) => k[s] === st.truth(k)));
    if (ok.length !== 1) return null;
    const sol = ok[0];
    const correct = describe(sol, names);
    const wrong = shuffle(worlds.filter((w) => w.some((v, i) => v !== sol[i])), rng).map((w) => describe(w, names)).slice(0, 3);
    const says = stmts.map(({ s, st }) => `• ${names[s]} dice: «${st.text}»`).join('\n');
    return {
      cat: 'deductiva',
      prompt: `${KK} Te encuentras con ${list(names)}.\n${says}\n¿Quién es caballero?`,
      correct,
      wrong,
      expl: `Es la única combinación en la que cada caballero dice la verdad y cada bribón miente. Cualquier otra lleva a una contradicción.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 4. Labelled boxes ("only one label tells the truth")
// ─────────────────────────────────────────────────────────────────────────
const BOX_COND = [
  { text: 'Solo una de las etiquetas dice la verdad.', ok: (t: number) => t === 1, short: 'una sola etiqueta verdadera' },
  { text: 'Solo una de las etiquetas miente.', ok: (t: number, m: number) => t === m - 1, short: 'una sola etiqueta falsa' },
  { text: 'Todas las etiquetas mienten.', ok: (t: number) => t === 0, short: 'todas las etiquetas falsas' },
];
const boxes: Family = {
  id: 'box',
  counts: (m) => (m === 'facil' ? spread(0, 1, 2, 2, 2, 1) : spread(1, 2, 2, 2, 2, 1)),
  make: ({ D, rng }) => {
    const k = D <= 4 ? 3 : 4;
    const L = ['A', 'B', 'C', 'D'].slice(0, k);
    const kinds = D <= 4 ? ['in', 'notIn'] : ['in', 'notIn', 'either'];
    const labels = L.map((self) => {
      const kind = pick(rng, kinds);
      const x = pick(rng, L);
      const y = pick(rng, L.filter((z) => z !== x));
      const ref = (z: string) => (z === self ? 'esta caja' : `la caja ${z}`);
      if (kind === 'in') return { text: x === self ? 'El premio está aquí.' : `El premio está en ${ref(x)}.`, t: (p: string) => p === x };
      if (kind === 'notIn') return { text: x === self ? 'El premio no está aquí.' : `El premio no está en ${ref(x)}.`, t: (p: string) => p !== x };
      return { text: `El premio está en ${ref(x)} o en ${ref(y)}.`, t: (p: string) => p === x || p === y };
    });
    const cond = pick(rng, D <= 3 ? BOX_COND.slice(0, 1) : BOX_COND);
    const sols = L.filter((p) => cond.ok(labels.filter((l) => l.t(p)).length, k));
    if (sols.length !== 1) return null;
    const ans = sols[0];
    const texts = L.map((b, i) => `• Caja ${b}: «${labels[i].text}»`).join('\n');
    return {
      cat: 'deductiva',
      prompt: `Hay ${NUM[k]} cajas y el premio está en una de ellas.\n${texts}\n${cond.text} ¿Dónde está el premio?`,
      correct: `En la caja ${ans}`,
      wrong: withUnknown(`En la caja ${ans}`, shuffle(L, rng).map((b) => `En la caja ${b}`)),
      expl: `Prueba cada caja: solo si el premio está en la ${ans} hay ${cond.short}.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 5. Suspects
// ─────────────────────────────────────────────────────────────────────────
const CRIMES = ['se comió la tarta', 'rompió el jarrón', 'dejó la puerta abierta', 'escondió las llaves', 'se llevó el último pastel', 'pintó la pared'];
const SUS_COND = [
  { text: 'Exactamente uno de ellos miente.', ok: (lies: number[]) => lies.length === 1, short: 'un solo mentiroso' },
  { text: 'Exactamente uno de ellos dice la verdad.', ok: (lies: number[], n: number) => lies.length === n - 1, short: 'una sola persona sincera' },
  { text: 'Solo el culpable miente.', ok: (lies: number[], _n: number, c: number) => lies.length === 1 && lies[0] === c, short: 'que solo mienta el culpable' },
];
const suspects: Family = {
  id: 'sus',
  counts: (m) => (m === 'facil' ? spread(0, 1, 2, 2, 2, 1) : spread(1, 2, 2, 2, 2, 2)),
  make: ({ D, rng }) => {
    const n = D <= 3 ? 3 : D <= 6 ? 4 : 5;
    const names = sample(rng, NAMES, n);
    type S = { text: string; truth: (c: number, lies: (i: number) => boolean) => boolean; ref?: number };
    const st: S[] = names.map((_, i) => {
      const o = pick(rng, names.map((_, j) => j).filter((j) => j !== i));
      const o2 = pick(rng, names.map((_, j) => j).filter((j) => j !== i && j !== o));
      const kinds = ['accuse', 'self', 'not', 'either'];
      if (D >= 5) kinds.push('liar');
      const kind = pick(rng, kinds);
      if (kind === 'accuse') return { text: `Fue ${names[o]}.`, truth: (c) => c === o };
      if (kind === 'self') return { text: 'Yo no fui.', truth: (c) => c !== i };
      if (kind === 'not') return { text: `No fue ${names[o]}.`, truth: (c) => c !== o };
      if (kind === 'either') return { text: `Fue ${or(names[o], names[o2])}.`, truth: (c) => c === o || c === o2 };
      return { text: `${names[o]} miente.`, truth: (_c, lies) => lies(o), ref: o };
    });
    // "X miente" must point at a statement that is not itself of that kind.
    if (st.some((s) => s.ref !== undefined && st[s.ref].ref !== undefined)) return null;
    const cond = pick(rng, SUS_COND);
    const results: number[] = [];
    for (let c = 0; c < n; c++) {
      const base = (i: number) => !st[i].truth(c, () => false);
      const lies = names.map((_, i) => (st[i].ref !== undefined ? !st[i].truth(c, base) : base(i)));
      const liars = lies.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
      if (cond.ok(liars, n, c)) results.push(c);
    }
    if (results.length !== 1) return null;
    const c = results[0];
    const says = names.map((p, i) => `• ${p}: «${st[i].text}»`).join('\n');
    return {
      cat: 'deductiva',
      prompt: `Alguien ${pick(rng, CRIMES)}. Los sospechosos declaran:\n${says}\n${cond.text} ¿Quién fue?`,
      correct: names[c],
      wrong: withUnknown(names[c], shuffle(names, rng)),
      expl: `Si el culpable fuera cualquier otro, no se cumpliría la condición de ${cond.short}. Solo encaja ${names[c]}.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 6. Syllogisms (checked against every possible world)
// ─────────────────────────────────────────────────────────────────────────
const WORDS = ['zorp', 'glim', 'pluf', 'drac', 'brin', 'quibo', 'fendo', 'cronto', 'tarpo', 'mimbo', 'lurdo', 'sorpo', 'vinco', 'trel'];
type SType = 'A' | 'E' | 'I' | 'O';
interface Prop { t: SType; s: number; p: number }

function propText(pr: Prop, w: string[]): string {
  const S = w[pr.s];
  const P = w[pr.p];
  switch (pr.t) {
    case 'A': return `Todos los ${S}s son ${P}s`;
    case 'E': return `Ningún ${S} es ${P}`;
    case 'I': return `Algunos ${S}s son ${P}s`;
    case 'O': return `Algunos ${S}s no son ${P}s`;
  }
}

function worldsFor(terms: number): number[][] {
  const regions = (1 << terms) - 1; // non-empty subsets of terms
  const worlds: number[][] = [];
  for (let m = 0; m < 1 << regions; m++) {
    const filled: number[] = [];
    for (let r = 0; r < regions; r++) if (m & (1 << r)) filled.push(r + 1);
    let ok = true;
    for (let t = 0; t < terms; t++) if (!filled.some((r) => r & (1 << t))) ok = false; // every term non-empty
    if (ok) worlds.push(filled);
  }
  return worlds;
}
const W3 = worldsFor(3);
const W4 = worldsFor(4);

function holds(pr: Prop, w: number[]): boolean {
  const S = 1 << pr.s;
  const P = 1 << pr.p;
  switch (pr.t) {
    case 'A': return !w.some((r) => r & S && !(r & P));
    case 'E': return !w.some((r) => r & S && r & P);
    case 'I': return w.some((r) => r & S && r & P);
    case 'O': return w.some((r) => r & S && !(r & P));
  }
}

const FORMS: { prem: [SType, SType]; concl: SType; expl: (w: string[]) => string }[] = [
  { prem: ['A', 'A'], concl: 'A', expl: (w) => `Todo ${w[0]} es ${w[1]} y todo ${w[1]} es ${w[2]}: por tanto, todo ${w[0]} es ${w[2]}.` },
  { prem: ['A', 'E'], concl: 'E', expl: (w) => `Todo ${w[0]} es ${w[1]} y ningún ${w[1]} es ${w[2]}: ningún ${w[0]} puede ser ${w[2]}.` },
  { prem: ['I', 'A'], concl: 'I', expl: (w) => `Los ${w[0]}s que son ${w[1]}s también son ${w[2]}s, porque todo ${w[1]} lo es.` },
  { prem: ['I', 'E'], concl: 'O', expl: (w) => `Los ${w[0]}s que son ${w[1]}s no pueden ser ${w[2]}s, porque ningún ${w[1]} lo es.` },
];

const syllogism: Family = {
  id: 'sil',
  counts: (m) => (m === 'facil' ? spread(1, 2, 2, 2, 1, 1) : spread(2, 2, 2, 2, 2, 1)),
  make: ({ D, rng }) => {
    const four = D >= 7;
    const w = sample(rng, WORDS, four ? 4 : 3);
    let prem: Prop[];
    let concl: Prop;
    let expl: string;
    if (!four) {
      const f = pick(rng, D <= 3 ? FORMS.slice(0, 2) : FORMS);
      prem = [{ t: f.prem[0], s: 0, p: 1 }, { t: f.prem[1], s: 1, p: 2 }];
      concl = { t: f.concl, s: 0, p: 2 };
      expl = f.expl(w);
    } else {
      const last = pick(rng, ['A', 'E'] as SType[]);
      prem = [{ t: 'A', s: 0, p: 1 }, { t: 'A', s: 1, p: 2 }, { t: last, s: 2, p: 3 }];
      concl = { t: last, s: 0, p: 3 };
      expl = `Encadenando: todo ${w[0]} es ${w[1]}, todo ${w[1]} es ${w[2]} y ${last === 'A' ? `todo ${w[2]} es ${w[3]}` : `ningún ${w[2]} es ${w[3]}`}. Así, ${last === 'A' ? `todo ${w[0]} es ${w[3]}` : `ningún ${w[0]} es ${w[3]}`}.`;
    }
    const worlds = (four ? W4 : W3).filter((x) => prem.every((p) => holds(p, x)));
    const valid = (pr: Prop) => worlds.every((x) => holds(pr, x));
    if (!valid(concl)) return null;
    const ends = [concl.s, concl.p];
    const cands: Prop[] = [];
    for (const t of ['A', 'E', 'I', 'O'] as SType[])
      for (const [s, p] of [[ends[0], ends[1]], [ends[1], ends[0]]]) cands.push({ t, s, p });
    const invalid = shuffle(cands.filter((c) => !valid(c)), rng);
    if (invalid.length < 3) return null;
    // Shuffle premise order for harder levels.
    const shownPrem = D >= 5 ? shuffle(prem, rng) : prem;
    return {
      cat: 'verbal',
      prompt: `Supón que es cierto que: ${shownPrem.map((p) => `«${propText(p, w)}»`).join(four ? ', ' : ' y ')}${four ? '' : ''}. ¿Qué conclusión es segura?`.replace(/, («[^»]+»)\. ¿/, ' y $1. ¿'),
      correct: propText(concl, w),
      wrong: invalid.slice(0, 3).map((c) => propText(c, w)),
      expl: `${expl} Las demás opciones podrían ser falsas aunque las premisas sean ciertas.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 7. Conditionals (modus ponens / tollens and the classic fallacies)
// ─────────────────────────────────────────────────────────────────────────
const CONDS: [string, string, string, string][] = [
  ['Leo estudia', 'Leo no estudia', 'Leo aprueba', 'Leo no aprueba'],
  ['suena la alarma', 'no suena la alarma', 'Marta se despierta', 'Marta no se despierta'],
  ['el semáforo está en verde', 'el semáforo no está en verde', 'los coches avanzan', 'los coches no avanzan'],
  ['el horno está encendido', 'el horno no está encendido', 'la cocina está caliente', 'la cocina no está caliente'],
  ['el gato tiene hambre', 'el gato no tiene hambre', 'el gato maúlla', 'el gato no maúlla'],
  ['hace sol', 'no hace sol', 'Vera va a la playa', 'Vera no va a la playa'],
  ['es festivo', 'no es festivo', 'la biblioteca cierra', 'la biblioteca no cierra'],
  ['Teo gana la partida', 'Teo no gana la partida', 'Teo invita a cenar', 'Teo no invita a cenar'],
  ['el móvil tiene batería', 'el móvil no tiene batería', 'el móvil se enciende', 'el móvil no se enciende'],
  ['la planta recibe agua', 'la planta no recibe agua', 'la planta crece', 'la planta no crece'],
  ['nieva', 'no nieva', 'el colegio cierra', 'el colegio no cierra'],
  ['Hugo entrena', 'Hugo no entrena', 'Hugo juega el partido', 'Hugo no juega el partido'],
];
const conditional: Family = {
  id: 'cnd',
  counts: (m) => (m === 'facil' ? spread(2, 2, 2, 2, 1, 0) : spread(2, 2, 2, 2, 1, 1)),
  make: ({ D, rng }) => {
    const [P, nP, Q, nQ] = pick(rng, CONDS);
    const forms = [
      `Si ${P}, entonces ${Q}.`,
      `Siempre que ${P}, ${Q}.`,
      ...(D >= 4 ? [`${cap(P)} solo si ${Q}.`, `Solo si ${Q}, ${P}.`] : []),
      ...(D >= 6 ? [`Nunca ocurre que ${P} y, a la vez, ${nQ}.`] : []),
    ];
    const rule = cap(pick(rng, forms));
    const fact = pick(rng, D <= 2 ? [0, 1] : [0, 1, 2, 3]);
    const unknownQ = `No se puede saber si ${Q}`;
    const unknownP = `No se puede saber si ${P}`;
    const converse = `Que si ${Q}, entonces ${P}`;
    let factText: string;
    let correct: string;
    let wrong: string[];
    let expl: string;
    if (fact === 0) {
      factText = P; correct = cap(Q); wrong = [cap(nQ), unknownQ, converse];
      expl = `La regla garantiza que, si ${P}, ${Q}.`;
    } else if (fact === 1) {
      factText = nQ; correct = cap(nP); wrong = [cap(P), unknownP, converse];
      expl = `Si ${P}, entonces ${Q}. Como no ocurre lo segundo, tampoco puede ocurrir lo primero.`;
    } else if (fact === 2) {
      factText = Q; correct = unknownP; wrong = [cap(P), cap(nP), converse];
      expl = `La regla no dice qué pasa cuando ${Q}: puede ocurrir por otros motivos.`;
    } else {
      factText = nP; correct = unknownQ; wrong = [cap(Q), cap(nQ), converse];
      expl = `La regla solo habla de lo que pasa cuando ${P}. Si no ocurre, no sabemos nada de lo otro.`;
    }
    return {
      cat: 'verbal',
      prompt: `Regla: «${rule}» Sabemos que ${factText}. ¿Qué se puede concluir?`,
      correct,
      wrong,
      expl,
    };
  },
};

export const LOGIC_FAMILIES = [ordering, assignment, knights, boxes, suspects, syllogism, conditional];
export type { Draft, Ctx };
