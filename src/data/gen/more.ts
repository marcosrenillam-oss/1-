import { shuffle } from '../../engine/rng';
import { cap, pick, randInt, sample, spread, strip, type Family } from './util';
import { flipV, invert, mirror, randomShape, rotCCW, rotCW, tok, type Mask } from './visual';

const distinct3 = (correct: string, cands: string[]) => {
  const w = [...new Set(cands.filter((c) => c !== correct))];
  return w.length >= 3 ? w.slice(0, 3) : null;
};

// ─────────────────────────────────────────────────────────────────────────
// Orientation and routes
// ─────────────────────────────────────────────────────────────────────────
const DIRS = ['norte', 'este', 'sur', 'oeste'];
const TURNS = [
  { t: 'giras a la derecha', d: 1 },
  { t: 'giras a la izquierda', d: -1 },
  { t: 'das media vuelta', d: 2 },
];
const orientation: Family = {
  id: 'ori',
  counts: () => spread(1, 2, 2, 1, 1, 1),
  make: ({ D, rng }) => {
    const n = D <= 2 ? 2 : D <= 5 ? 3 : D <= 7 ? 4 : 5;
    let dir = randInt(rng, 0, 3);
    const path = [DIRS[dir]];
    const steps = Array.from({ length: n }, () => pick(rng, TURNS));
    for (const s of steps) {
      dir = (dir + s.d + 4) % 4;
      path.push(DIRS[dir]);
    }
    const text = steps.map((s, i) => (i === 0 ? cap(s.t) : s.t)).join(', luego ');
    return {
      cat: 'problemas',
      prompt: `Estás mirando hacia el ${path[0]}. ${text}. ¿Hacia dónde miras ahora?`,
      correct: `Al ${DIRS[dir]}`,
      wrong: DIRS.filter((d) => d !== DIRS[dir]).map((d) => `Al ${d}`),
      expl: `Paso a paso: ${path.join(' → ')}.`,
    };
  },
};

const route: Family = {
  id: 'rec',
  counts: () => spread(0, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const n = D <= 3 ? 3 : D <= 6 ? 4 : 5;
    const V = [[0, 1, 'norte'], [1, 0, 'este'], [0, -1, 'sur'], [-1, 0, 'oeste']] as const;
    let x = 0;
    let y = 0;
    const moves = Array.from({ length: n }, () => [pick(rng, V), randInt(rng, 1, 4)] as const);
    for (const [[dx, dy], k] of moves) {
      x += dx * k;
      y += dy * k;
    }
    const desc = (X: number, Y: number) => {
      if (X === 0 && Y === 0) return 'En casa';
      const parts: string[] = [];
      if (Y) parts.push(`${Math.abs(Y)} ${Math.abs(Y) === 1 ? 'calle' : 'calles'} al ${Y > 0 ? 'norte' : 'sur'}`);
      if (X) parts.push(`${Math.abs(X)} ${Math.abs(X) === 1 ? 'calle' : 'calles'} al ${X > 0 ? 'este' : 'oeste'}`);
      return cap(parts.join(' y ')) + ' de casa';
    };
    const ans = desc(x, y);
    const [[lx, ly], lk] = moves[n - 1];
    const w = distinct3(ans, shuffle([desc(-x, y), desc(x, -y), desc(y, x), desc(x - lx * lk, y - ly * lk), desc(-x, -y), desc(x + 1, y)], rng));
    if (!w) return null;
    const text = moves.map(([[, , name], k], i) => `${i === 0 ? 'Andas' : ''} ${k} ${k === 1 ? 'calle' : 'calles'} al ${name}`.trim()).join(', ');
    return { cat: 'problemas', prompt: `Sales de casa. ${text}. ¿Dónde estás?`, correct: ans, wrong: w, expl: `Sumando norte-sur y este-oeste por separado: ${ans.toLowerCase()}.` };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Spatial reasoning on 3×3 figures
// ─────────────────────────────────────────────────────────────────────────
const mirrorImg: Family = {
  id: 'esp',
  counts: () => spread(1, 2, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const s = randomShape(rng, D <= 3 ? 3 : 4);
    const water = D >= 4 && rng() < 0.5;
    const ans = water ? flipV(s) : mirror(s);
    const w = distinct3(tok(ans), [water ? mirror(s) : flipV(s), rotCW(s), s, rotCCW(s)].map(tok));
    if (!w) return null;
    return {
      cat: 'visual',
      prompt: water ? '¿Cómo se ve esta figura reflejada en un lago (con el agua debajo)?' : '¿Cómo se ve esta figura en un espejo colocado a su derecha?',
      correct: tok(ans),
      wrong: w,
      expl: water ? 'El reflejo en el agua invierte arriba y abajo, pero no izquierda y derecha.' : 'Un espejo vertical invierte izquierda y derecha, pero no arriba y abajo.',
      visual: [tok(s)],
    };
  },
};

const rotated: Family = {
  id: 'gir',
  counts: () => spread(1, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const s = randomShape(rng, D <= 4 ? 4 : 5);
    const k = randInt(rng, 1, 3);
    let r = s;
    for (let i = 0; i < k; i++) r = rotCW(r);
    const m = mirror(s);
    const w = distinct3(tok(r), shuffle([m, flipV(s), rotCW(m), rotCCW(m)], rng).map(tok));
    if (!w) return null;
    return {
      cat: 'visual',
      prompt: '¿Cuál de las opciones es la misma figura, solo que girada (sin darle la vuelta)?',
      correct: tok(r),
      wrong: w,
      expl: `Es la figura girada ${k === 2 ? 'media vuelta' : `un cuarto de vuelta en sentido ${k === 1 ? 'horario' : 'antihorario'}`}. Las demás son su imagen en un espejo, que no se puede conseguir solo girando.`,
      visual: [tok(s)],
    };
  },
};

const ORDW = ['1.ª', '2.ª', '3.ª', '4.ª', '5.ª'];
const pairs: Family = {
  id: 'par',
  counts: () => spread(1, 1, 2, 2, 1, 0),
  make: ({ D, rng }) => {
    const base = randomShape(rng, 4);
    const subtle = D >= 5;
    const others = new Set<Mask>();
    let guard = 0;
    while (others.size < 3 && guard++ < 100) {
      const v = subtle ? base ^ (1 << randInt(rng, 0, 8)) : randomShape(rng, 4);
      if (v !== base && v !== 0) others.add(v);
    }
    if (others.size < 3) return null;
    const row = shuffle([base, base, ...others], rng);
    const idx = row.map((m, i) => (m === base ? i : -1)).filter((i) => i >= 0);
    const label = (a: number, b: number) => `La ${ORDW[a]} y la ${ORDW[b]}`;
    const ans = label(idx[0], idx[1]);
    const cands: string[] = [];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) cands.push(label(a, b));
    return { cat: 'observacion', prompt: '¿Qué dos cuadrículas son exactamente iguales?', correct: ans, wrong: sample(rng, cands.filter((c) => c !== ans), 3), expl: `${ans} coinciden casilla por casilla${subtle ? '; las demás se diferencian en una sola casilla' : ''}.`, visual: [row.map(tok).join(' ')] };
  },
};

const symmetric: Family = {
  id: 'sim',
  counts: () => spread(1, 1, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const vertical = D <= 4 || rng() < 0.5; // vertical axis → left/right symmetry
    const f = vertical ? mirror : flipV;
    // Build a symmetric mask.
    let sym = 0;
    for (const i of sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], randInt(rng, 2, 4))) sym |= 1 << i;
    sym |= f(sym);
    if (sym === 0x1ff || f(sym) !== sym) return null;
    const non: Mask[] = [];
    let guard = 0;
    while (non.length < 3 && guard++ < 200) {
      const m = randomShape(rng, randInt(rng, 3, 5));
      if (f(m) !== m && !non.includes(m)) non.push(m);
    }
    if (non.length < 3) return null;
    return {
      cat: 'visual',
      prompt: vertical ? '¿Qué cuadrícula es simétrica respecto a una línea vertical en su centro?' : '¿Qué cuadrícula es simétrica respecto a una línea horizontal en su centro?',
      correct: tok(sym),
      wrong: non.map(tok),
      expl: vertical ? 'Si la doblas por la mitad de izquierda a derecha, las dos mitades coinciden.' : 'Si la doblas por la mitad de arriba abajo, las dos mitades coinciden.',
    };
  },
};

const TR: { name: string; f: (m: Mask) => Mask }[] = [
  { name: 'gira un cuarto de vuelta en sentido horario', f: rotCW },
  { name: 'gira un cuarto de vuelta en sentido antihorario', f: rotCCW },
  { name: 'se refleja de izquierda a derecha', f: mirror },
  { name: 'se refleja de arriba abajo', f: flipV },
  { name: 'invierte sus colores', f: invert },
];
const visualAnalogy: Family = {
  id: 'anv',
  counts: () => spread(0, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const t = pick(rng, D <= 4 ? TR.slice(0, 3) : TR);
    const A = randomShape(rng, 4);
    const C = randomShape(rng, D <= 5 ? 3 : 4);
    if (A === C) return null;
    // The example must identify the transformation.
    if (TR.some((o) => o !== t && o.f(A) === t.f(A))) return null;
    const ans = t.f(C);
    const w = distinct3(tok(ans), shuffle(TR.filter((o) => o !== t).map((o) => tok(o.f(C))), rng));
    if (!w) return null;
    return {
      cat: 'visual',
      prompt: 'La primera figura se transforma en la segunda. ¿En qué se transforma la tercera siguiendo la misma regla?',
      correct: tok(ans),
      wrong: w,
      expl: `La figura ${t.name}.`,
      visual: [`${tok(A)} → ${tok(t.f(A))}`, `${tok(C)} → ?`],
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Observation
// ─────────────────────────────────────────────────────────────────────────
const SN: Record<string, [string, string]> = { ci: ['círculo', 'círculos'], sq: ['cuadrado', 'cuadrados'], tr: ['triángulo', 'triángulos'], st: ['estrella', 'estrellas'] };
const statements: Family = {
  id: 'afi',
  counts: () => spread(1, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const kinds = sample(rng, Object.keys(SN), D <= 3 ? 2 : 3);
    const row = Array.from({ length: 8 }, () => ({ s: pick(rng, kinds), f: D <= 3 ? true : rng() < 0.6 }));
    const count = (s: string) => row.filter((r) => r.s === s).length;
    const st: { t: string; v: boolean }[] = [];
    for (const a of kinds) {
      for (const b of kinds) if (a !== b) {
        st.push({ t: `Hay más ${SN[a][1]} que ${SN[b][1]}.`, v: count(a) > count(b) });
        st.push({ t: `Hay tantos ${SN[a][1]} como ${SN[b][1]}.`, v: count(a) === count(b) });
      }
      const n = count(a) + pick(rng, [0, 1, -1]);
      if (n > 0) st.push({ t: `Hay exactamente ${n} ${n === 1 ? SN[a][0] : SN[a][1]}${a === 'st' ? '' : ''}.`, v: count(a) === n });
      st.push({ t: `Nunca hay dos ${SN[a][1]} seguidos.`.replace('dos estrellas seguidos', 'dos estrellas seguidas'), v: !row.some((r, i) => i > 0 && r.s === a && row[i - 1].s === a) });
      if (D > 3) st.push({ t: `Todos los ${SN[a][1]} están rellenos.`.replace('Todos los estrellas están rellenos', 'Todas las estrellas están rellenas'), v: row.filter((r) => r.s === a).every((r) => r.f) && count(a) > 0 });
    }
    st.push({ t: 'La primera y la última figura son iguales.', v: row[0].s === row[7].s && row[0].f === row[7].f });
    const tr = shuffle(st.filter((x) => x.v), rng);
    const fa = shuffle(st.filter((x) => !x.v), rng);
    if (!tr.length || fa.length < 3) return null;
    return {
      cat: 'observacion',
      prompt: 'Observa la fila. ¿Qué afirmación es verdadera?',
      correct: tr[0].t,
      wrong: fa.slice(0, 3).map((x) => x.t),
      expl: `Contando con cuidado: ${kinds.map((k) => `${count(k)} ${count(k) === 1 ? SN[k][0] : SN[k][1]}`).join(', ')}.`,
      visual: [row.map((r) => `{${r.s}${r.f ? '' : 'o'}}`).join(' ')],
    };
  },
};

const countShapes: Family = {
  id: 'cnt',
  counts: () => spread(2, 2, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const kinds = sample(rng, ['ci', 'sq', 'tr', 'st', 'di'], D <= 2 ? 2 : 3);
    const outline = D >= 4;
    const R = D <= 2 ? 3 : 4;
    const grid = Array.from({ length: R * 5 }, () => `${pick(rng, kinds)}${outline && rng() < 0.4 ? 'o' : ''}`);
    const target = pick(rng, kinds);
    const filledOnly = outline && rng() < 0.5;
    const ans = grid.filter((g) => (filledOnly ? g === target : g.startsWith(target) && (g === target || g === `${target}o`))).length;
    if (ans < 2) return null;
    const names: Record<string, string> = { ci: 'círculos', sq: 'cuadrados', tr: 'triángulos', st: 'estrellas', di: 'rombos' };
    const w = distinct3(String(ans), shuffle([ans + 1, ans - 1, ans + 2, ans - 2].filter((x) => x > 0).map(String), rng));
    if (!w) return null;
    const what = filledOnly ? `${names[target]} rellen${target === 'st' ? 'as' : 'os'}` : `${names[target]} (rellen${target === 'st' ? 'as' : 'os'} o huec${target === 'st' ? 'as' : 'os'})`;
    return {
      cat: 'observacion',
      prompt: outline ? `¿Cuántos ${what} hay?`.replace('¿Cuántos estrellas', '¿Cuántas estrellas') : `¿Cuánt${target === 'st' ? 'as' : 'os'} ${names[target]} hay?`,
      correct: String(ans),
      wrong: w,
      expl: `Hay ${ans}.`,
      visual: Array.from({ length: R }, (_, i) => grid.slice(i * 5, i * 5 + 5).map((g) => `{${g}}`).join(' ')),
    };
  },
};

const PHRASES = ['LA LLAVE ESTÁ BAJO LA MALETA', 'MAÑANA SALIMOS TEMPRANO', 'EL PERRO DE ROSA CORRE RÁPIDO', 'TRES TRISTES TIGRES', 'PABLO PINTA PAREDES', 'LA CASA AMARILLA TIENE GARAJE', 'CADA COSA EN SU SITIO', 'SIETE SILLAS ROTAS', 'ANA Y ALBA BAILAN SALSA', 'EL ARROZ CON TOMATE', 'MIL MANZANAS MADURAS', 'LOS LOROS HABLAN SOLOS'];
const countLetters: Family = {
  id: 'ltr',
  counts: () => spread(1, 2, 1, 1, 0, 0),
  make: ({ rng }) => {
    const ph = pick(rng, PHRASES);
    const plain = strip(ph).toUpperCase();
    const letters = [...new Set(plain.replace(/[^A-Z]/g, ''))];
    const L = pick(rng, letters);
    const ans = [...plain].filter((c) => c === L).length;
    if (ans < 3) return null;
    const w = distinct3(String(ans), shuffle([ans + 1, ans - 1, ans + 2].map(String), rng));
    return w && { cat: 'observacion', prompt: `¿Cuántas veces aparece la letra ${L} en «${ph}»? (Las letras con tilde también cuentan.)`, correct: String(ans), wrong: w, expl: `La ${L} aparece ${ans} veces.` };
  },
};

const ANIMALS = ['GATO', 'LOBO', 'PATO', 'TORO', 'RANA', 'FOCA', 'MONO', 'LEON', 'CEBRA', 'TIGRE', 'BURRO', 'CERDO', 'PERRO', 'OVEJA', 'CABRA', 'GALLO', 'PULPO', 'ZORRO', 'MULA', 'CISNE'];
const FRUITS = ['PERA', 'KIWI', 'MANGO', 'LIMON', 'FRESA', 'MELON', 'COCO', 'CEREZA', 'UVAS', 'BANANA', 'CIRUELA'];
const hidden: Family = {
  id: 'sop',
  counts: () => spread(1, 2, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const animal = rng() < 0.6;
    const bank = animal ? ANIMALS : FRUITS;
    const word = pick(rng, bank);
    const len = D <= 2 ? 9 : 12;
    const back = D >= 6 && rng() < 0.4;
    const filler = 'BCDFGHJKLMNPRSTVZAEIOU';
    let row = '';
    while (row.length < len - word.length) row += filler[Math.floor(rng() * filler.length)];
    const at = randInt(rng, 0, row.length);
    const w2 = back ? [...word].reverse().join('') : word;
    const full = row.slice(0, at) + w2 + row.slice(at);
    const contains = (x: string) => full.includes(x) || (back && full.includes([...x].reverse().join('')));
    const others = shuffle(bank.filter((x) => x !== word && !contains(x)), rng).slice(0, 3);
    if (others.length < 3 || bank.some((x) => x !== word && contains(x))) return null;
    const display = (x: string) => cap(x.toLowerCase()).replace('Leon', 'León').replace('Limon', 'Limón').replace('Melon', 'Melón');
    return {
      cat: 'observacion',
      prompt: `¿Qué ${animal ? 'animal' : 'fruta'} está escondid${animal ? 'o' : 'a'} en esta fila de letras?${back ? ' (Puede estar escrito al revés.)' : ''}`,
      correct: display(word),
      wrong: others.map(display),
      expl: `${word} aparece ${back ? 'escrito al revés ' : ''}a partir de la posición ${at + 1}.`,
      visual: [[...full].join(' ')],
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────────────────────────────────
// [word, antonym, synonym] — every word appears only once.
const LEX: [string, string, string][] = [
  ['alegre', 'triste', 'contento'], ['generoso', 'tacaño', 'espléndido'], ['rápido', 'lento', 'veloz'], ['valiente', 'cobarde', 'audaz'],
  ['fácil', 'difícil', 'sencillo'], ['ancho', 'estrecho', 'amplio'], ['antiguo', 'moderno', 'viejo'], ['limpio', 'sucio', 'aseado'],
  ['rico', 'pobre', 'adinerado'], ['enorme', 'diminuto', 'gigantesco'], ['aburrido', 'divertido', 'tedioso'], ['tranquilo', 'nervioso', 'sereno'],
  ['empezar', 'terminar', 'comenzar'], ['aceptar', 'rechazar', 'admitir'], ['subir', 'bajar', 'ascender'], ['ganar', 'perder', 'vencer'],
  ['construir', 'destruir', 'edificar'], ['claro', 'oscuro', 'luminoso'], ['cerca', 'lejos', 'próximo'], ['amable', 'grosero', 'cortés'],
  ['débil', 'fuerte', 'frágil'], ['verdad', 'mentira', 'certeza'], ['feliz', 'infeliz', 'dichoso'], ['ruidoso', 'silencioso', 'escandaloso'],
  ['caro', 'barato', 'costoso'], ['obedecer', 'desobedecer', 'acatar'], ['ahorrar', 'gastar', 'guardar'], ['lleno', 'vacío', 'repleto'],
  ['dulce', 'amargo', 'azucarado'], ['bonito', 'feo', 'precioso'], ['listo', 'torpe', 'inteligente'], ['entrar', 'salir', 'acceder'],
  ['permitir', 'prohibir', 'autorizar'], ['unir', 'separar', 'juntar'], ['mojado', 'seco', 'empapado'], ['honrado', 'deshonesto', 'íntegro'],
];
const antonym: Family = {
  id: 'ant',
  counts: () => spread(2, 2, 2, 1, 1, 0),
  make: ({ rng }) => {
    const i = randInt(rng, 0, LEX.length - 1);
    const [w, a, s] = LEX[i];
    const others = sample(rng, LEX.filter((_, j) => j !== i).map((r) => r[randInt(rng, 0, 2)]), 2);
    return { cat: 'verbal', prompt: `¿Qué palabra significa lo contrario de «${w}»?`, correct: cap(a), wrong: [s, ...others].map(cap), expl: `Lo contrario de ${w} es ${a}. «${cap(s)}» significa casi lo mismo que ${w}.` };
  },
};
const synonym: Family = {
  id: 'syn',
  counts: () => spread(2, 2, 2, 1, 1, 0),
  make: ({ rng }) => {
    const i = randInt(rng, 0, LEX.length - 1);
    const [w, a, s] = LEX[i];
    const others = sample(rng, LEX.filter((_, j) => j !== i).map((r) => r[randInt(rng, 0, 2)]), 2);
    return { cat: 'verbal', prompt: `¿Qué palabra significa casi lo mismo que «${w}»?`, correct: cap(s), wrong: [a, ...others].map(cap), expl: `«${cap(s)}» es sinónimo de ${w}; «${a}» es justo lo contrario.` };
  },
};

const SYL: string[][] = [
  ['CHO', 'CO', 'LA', 'TE'], ['MA', 'RI', 'PO', 'SA'], ['BI', 'CI', 'CLE', 'TA'], ['PE', 'LO', 'TA'], ['VEN', 'TA', 'NA'],
  ['CA', 'MI', 'SE', 'TA'], ['E', 'LE', 'FAN', 'TE'], ['ZA', 'PA', 'TI', 'LLA'], ['PA', 'RA', 'GUAS'], ['CO', 'CO', 'DRI', 'LO'],
  ['OR', 'DE', 'NA', 'DOR'], ['CA', 'RA', 'ME', 'LO'], ['CU', 'CHA', 'RA'], ['TOR', 'TU', 'GA'], ['CA', 'LA', 'BA', 'ZA'],
  ['MAN', 'ZA', 'NA'], ['PI', 'RA', 'TA'], ['ES', 'PE', 'JO'], ['GUI', 'TA', 'RRA'], ['LA', 'GAR', 'TI', 'JA'],
  ['PA', 'YA', 'SO'], ['MU', 'ÑE', 'CA'], ['TE', 'LE', 'VI', 'SOR'], ['DI', 'NO', 'SAU', 'RIO'], ['MON', 'TA', 'ÑA'],
  ['SAN', 'DÍ', 'A'], ['HE', 'LA', 'DO'], ['GI', 'RA', 'SOL'], ['ES', 'TRE', 'LLA'], ['PRI', 'MA', 'VE', 'RA'],
];
const syllables: Family = {
  id: 'syl',
  counts: () => spread(2, 2, 2, 1, 0, 0),
  make: ({ rng }) => {
    const s = pick(rng, SYL);
    const word = s.join('');
    const perms = new Set<string>();
    let guard = 0;
    while (perms.size < 3 && guard++ < 50) {
      const p = shuffle(s, rng).join('');
      if (p !== word) perms.add(p);
    }
    if (perms.size < 3) return null;
    let shown = shuffle(s, rng);
    if (shown.join('') === word) shown = [...shown.slice(1), shown[0]];
    return { cat: 'palabras', prompt: `Ordena estas sílabas para formar una palabra: ${shown.join(' · ')}. ¿Cuál es?`, correct: word, wrong: [...perms], expl: `${s.join('-')}: ${word.toLowerCase()}.` };
  },
};

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMW = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco'];
const positions: Family = {
  id: 'pos',
  counts: () => spread(1, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const L = randInt(rng, 4, 21);
    const a = randInt(rng, 1, D <= 3 ? 2 : 4);
    const two = D >= 4;
    const b = randInt(rng, 1, 3);
    const afterFirst = rng() < 0.5;
    let idx = L + (afterFirst ? a : -a);
    let q = `¿Qué letra está ${NUMW[a]} ${a === 1 ? 'puesto' : 'puestos'} ${afterFirst ? 'después' : 'antes'} de la ${ABC[L]}?`;
    let ex = `${afterFirst ? 'Después' : 'Antes'} de la ${ABC[L]}, contando ${a}: ${ABC[idx]}.`;
    if (two) {
      const after2 = !afterFirst;
      const idx2 = idx + (after2 ? b : -b);
      q = `¿Qué letra está ${NUMW[b]} ${b === 1 ? 'puesto' : 'puestos'} ${after2 ? 'después' : 'antes'} de la que está ${NUMW[a]} ${a === 1 ? 'puesto' : 'puestos'} ${afterFirst ? 'después' : 'antes'} de la ${ABC[L]}?`;
      ex = `Primero: ${NUMW[a]} ${afterFirst ? 'después' : 'antes'} de la ${ABC[L]} está la ${ABC[idx]}. Luego, ${NUMW[b]} ${after2 ? 'después' : 'antes'}: la ${ABC[idx2]}.`;
      idx = idx2;
    }
    if (idx < 0 || idx > 25) return null;
    const w = distinct3(ABC[idx], shuffle([idx - 1, idx + 1, idx + 2, idx - 2, L].filter((i) => i >= 0 && i < 26).map((i) => ABC[i]), rng));
    return w && { cat: 'patrones', prompt: `${q} (Abecedario sin Ñ.)`, correct: ABC[idx], wrong: w, expl: ex };
  },
};

export const MORE_FAMILIES = [orientation, route, mirrorImg, rotated, pairs, symmetric, visualAnalogy, statements, countShapes, countLetters, hidden, antonym, synonym, syllables, positions];
