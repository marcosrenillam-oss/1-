// End-to-end check of the production build in Chromium at iPhone size.
// Usage: npm run build && npm run e2e   (screenshots go to $SHOTS or ./e2e-shots)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SHOTS = resolve(process.env.SHOTS ?? 'e2e-shots');
mkdirSync(SHOTS, { recursive: true });
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const KEY = 'uno-por-ciento:v1';

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
process.on('exit', stopServer);
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('Local') && res());
  server.on('exit', rej);
  setTimeout(() => rej(new Error('preview timeout')), 20000);
});

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: Number(process.env.DPR ?? 1),
  isMobile: true,
  hasTouch: true,
  reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference',
});
await context.addInitScript(() => {
  const add = () => {
    try { localStorage.setItem('uno-por-ciento:e2e', '1'); } catch { /* ignore */ }
    const s = document.createElement('style');
    s.textContent = ':root{--sat:59px!important;--sab:34px!important}';
    document.head.appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add);
});
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const save = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const settle = (ms = 700) => page.waitForTimeout(ms);
const bank = await (async () => {
  // The bank is bundled; read it back through the module graph of the page is not possible,
  // so we derive answers from the save + DOM instead (see answer()).
  return null;
})();
void bank;

async function noHorizontalOverflow(label) {
  const bad = await page.evaluate(() => [document.documentElement, ...document.querySelectorAll('.screen')].some((el) => el.scrollWidth > el.clientWidth + 1));
  check(!bad, `no horizontal overflow (${label})`);
}

/** Reads the current question definition from the page (exposed for tests). */
const currentQ = () => page.evaluate(() => window.__q && window.__q());

/** Answers the current question through the UI. */
async function answer(correct) {
  const { q, order } = await currentQ();
  const kind = q.kind ?? 'choice';
  if (kind === 'choice') {
    const pos = correct ? order.indexOf(q.answer) : order.findIndex((i) => i !== q.answer);
    await page.locator('.opt').nth(pos).click();
  } else if (kind === 'order') {
    const seq = correct ? q.items : [...q.items].reverse();
    for (const it of seq) {
      const idx = order.findIndex((o) => q.items[o] === it);
      await page.locator('.ord-item').nth(idx).click();
    }
  } else if (kind === 'tap') {
    const cell = correct ? q.cell : (q.cell + 1) % (await page.locator('.tcell').count());
    await page.locator('.tcell').nth(cell).click();
  } else if (kind === 'memory') {
    await page.waitForFunction(() => document.querySelector('.mem-status')?.textContent?.startsWith('Tu turno'), null, { timeout: 20000 });
    const seq = correct ? q.seq : q.seq.map((c) => (c + 1) % (q.size * q.size));
    for (const c of seq) await page.locator('.pcell').nth(c).click();
    if (!correct && new Set(seq).size < seq.length) return answer(true); // degenerate: fall back
  } else if (kind === 'paint') {
    const target = correct ? q.target : q.target.replace(/./g, (c) => (c === '1' ? '0' : '1'));
    for (let i = 0; i < 9; i++) if (target[i] === '1') await page.locator('.pcell').nth(i).click();
  }
  await page.locator('.btn-confirm').click();
}
async function nextQuestion() {
  await page.waitForTimeout(350);
  await page.locator('.feedback--good .btn').click();
  await settle(450);
}

// ── 1. Home ───────────────────────────────────────────────────────────────
await page.goto(URL);
await settle(1600);
await shot('01-home');
const bg = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
check(bg.every((c) => c === 'rgb(11, 12, 14)'), `html/body background is carbon (${bg})`);
check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.screen')).paddingTop)) >= 73, 'content clears the Dynamic Island');
await noHorizontalOverflow('home');
const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
const manifest = await (await page.request.get(new globalThis.URL(manifestHref, URL).href)).json();
check(manifest.display === 'standalone' && manifest.short_name === '1%', 'manifest standalone, name 1%');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await settle(900);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
for (const b of [/^Preguntas/, /^Invasión/, /^Tu Núcleo/]) check(await page.getByRole('button', { name: b }).isVisible(), `home branch ${b}`);
await page.getByRole('button', { name: /^Preguntas/ }).click();
await settle(900);
await shot('01b-preguntas');
{
  const radios = (await page.getByRole('radio').allTextContents()).join('|');
  check(radios.includes('Clásico') && radios.includes('Aventura') && !radios.includes('Contrarreloj'), `Preguntas: Clásico and Aventura, no Contrarreloj (${radios})`);
}

// ── 2. Classic run: phase 1 → colour change → loss after victory ─────────
await page.getByRole('radio', { name: 'Normal' }).click();
await page.getByRole('button', { name: 'Empezar', exact: true }).click();
await settle(900);
await shot('02-question');
check(await page.locator('.counter-of').textContent() === '/100', 'runs go up to 100');
const kindsSeen = new Set();
for (let i = 0; i < 20; i++) {
  const { q } = await currentQ();
  kindsSeen.add(q.kind ?? 'choice');
  await answer(true);
  await settle(350);
  if (i === 0) await shot('03-correct');
  if (i < 19) await nextQuestion();
}
check(await page.locator('.feedback-title').textContent() === '¡Victoria! Fase 1 superada', 'question 20 shows the phase victory');
await page.waitForTimeout(350);
await page.locator('.feedback--good .btn').click();
await settle(900);
await shot('04-stage-clear');
check(await page.locator('.stage-clear').isVisible(), 'phase-clear overlay shown');
await page.getByRole('button', { name: 'Continuar' }).click();
await settle(900);
const accent = await page.evaluate(() => getComputedStyle(document.querySelector('.game')).getPropertyValue('--lime').trim());
check(accent === '#3d9bff', `phase 2 turns the accent blue (${accent})`);
check(await page.locator('.counter-now').textContent() === '21', 'question 21 after phase 1');
await shot('05-phase2-blue');
await answer(false);
await settle(2200);
await shot('06-result-after-victory');
check((await page.locator('.result-eyebrow').textContent()).includes('Victoria'), 'losing after 20 still shows the victory');
let s = await save();
check(s.records.normal.classic.completed === 1 && s.records.normal.classic.best === 20 && s.run === null, 'records: 20 correct = 1 victory');
console.log('  kinds answered:', [...kindsSeen].join(', '));

// ── 3. Touch questions of every kind ─────────────────────────────────────
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1000);
const kinds = ['order', 'tap', 'memory', 'paint'];
for (const k of kinds) {
  // Inject a run whose current question is of kind k.
  const ok = await page.evaluate(([k, KEY]) => {
    const all = window.__bank();
    const q = all.find((x) => x.kind === k && x.level === 2);
    if (!q) return false;
    const order = k === 'order' ? q.items.map((_, i) => i).reverse() : [];
    const ids = Array(100).fill(q.id);
    const s = JSON.parse(localStorage.getItem(KEY));
    s.run = { type: 'run', mode: 'normal', ids, orders: ids.map(() => order), index: 0, gameNo: 999 };
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  }, [k, KEY]);
  check(ok, `bank has ${k} questions`);
  await page.reload();
  await settle(1200);
  await shot(`07-touch-${k}`);
  await answer(true);
  await settle(500);
  check(await page.locator('.feedback--good').isVisible(), `${k}: answering through touch works`);
  await shot(`08-touch-${k}-done`);
  await page.evaluate((KEY) => { const s = JSON.parse(localStorage.getItem(KEY)); s.run = null; localStorage.setItem(KEY, JSON.stringify(s)); }, KEY);
  await page.reload();
  await settle(900);
}

// ── 4. 100/100 victory (injected near the end) ───────────────────────────
await page.evaluate((KEY) => {
  const s = JSON.parse(localStorage.getItem(KEY));
  const all = window.__bank().filter((q) => (q.kind ?? 'choice') === 'choice' && q.level === 5);
  const ids = all.slice(0, 100).map((q) => q.id);
  s.run = { type: 'run', mode: 'normal', ids, orders: ids.map(() => [0, 1, 2, 3]), index: 99, gameNo: 1000 };
  localStorage.setItem(KEY, JSON.stringify(s));
}, KEY);
await page.reload();
await settle(1000);
check((await page.evaluate(() => getComputedStyle(document.querySelector('.game')).getPropertyValue('--lime').trim())) === '#ff3b3b', 'phase 5 is red');
await answer(true);
await settle(400);
await nextQuestion();
await settle(1800);
await shot('09-victory-100');
check((await page.locator('.victory-title').textContent()) === 'Cien de cien', '100/100 victory screen');
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1000);

// ── 5. Invasión ──────────────────────────────────────────────────────────
await page.getByRole('button', { name: /^Invasión/ }).click();
await settle(1000);
await page.getByRole('button', { name: 'Defender el núcleo' }).click();
await settle(5000);
check(await page.locator('.inv-hud').isVisible(), 'invasion: game running with HUD');
await page.mouse.click(200, 250);
await shot('10-invasion');
await page.evaluate(() => { window.__inv.current.xp += 30; });
await settle(600);
check(await page.locator('.inv-card').count() >= 2, 'invasion: level up offers upgrade cards');
await shot('10b-invasion-cards');
{
  const before = await page.evaluate(() => window.__inv.current.taken.length);
  for (let k = 0; k < 20 && (await page.locator('.inv-card').count()); k++) {
    await page.locator('.inv-card').first().click();
    await page.waitForTimeout(150);
  }
  check((await page.evaluate(() => window.__inv.current.taken.length)) > before, 'invasion: choosing a card applies it');
}
s = await save();
check(s.invasion.run && s.invasion.run.defenders.length >= 2, 'invasion: game saved at the start of the wave');
await page.reload();
await settle(1200);
check((await page.getByRole('button', { name: /^Invasión/ }).textContent()).includes('Continuar'), 'invasion: home offers to continue');
await page.getByRole('button', { name: /^Invasión/ }).click();
await settle(900);
await page.getByRole('button', { name: /Continuar · oleada/ }).click();
await settle(2500);
check(await page.locator('.inv-hud').isVisible(), 'invasion: resumed');
await page.getByRole('button', { name: 'Pausa' }).click();
await settle(400);
check(await page.locator('.inv-build li').count() >= 2, 'invasion: pause shows your defenders');
await page.getByRole('button', { name: 'Terminar partida' }).click();
await settle(2600);
check(await page.getByRole('button', { name: 'Otra vez' }).isVisible(), 'invasion: end screen');
s = await save();
check(s.invasion.played === 1 && s.invasion.run === null && s.invasion.bestWave >= 1, 'invasion: record stored, saved game cleared');
await shot('10c-invasion-over');
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1000);

// ── 6. Adventure ─────────────────────────────────────────────────────────
await page.getByRole('button', { name: /^Preguntas/ }).click();
await settle(900);
await page.getByRole('radio', { name: 'Aventura' }).click();
await settle(500);
await shot('11-home-adventure');
await page.getByRole('button', { name: 'Empezar la aventura' }).click();
await settle(1200);
await shot('12-map');
check(await page.locator('.node--current').isVisible(), 'map: current level visible');
await page.getByRole('button', { name: 'Jugar nivel 100 %' }).click();
await settle(1000);
check((await page.locator('.counter-now').textContent()) === '100', 'adventure level shows 100 %');
await answer(true);
await settle(400);
await nextQuestion();
await settle(1500);
await shot('13-map-after-level');
s = await save();
check(s.adventure.level === 2, 'adventure: level passed (now 99 %)');
await page.getByRole('button', { name: 'Jugar nivel 99 %' }).click();
await settle(1000);
await answer(false);
await settle(800);
await shot('14-adventure-fail');
check(await page.getByRole('button', { name: 'Volver al mapa' }).isVisible(), 'adventure: failing offers to go back to the map');
await page.waitForTimeout(350);
await page.getByRole('button', { name: 'Volver al mapa' }).click();
await settle(1200);
check((await save()).adventure.level === 2, 'adventure: failed level stays');
// Boss
await page.evaluate((KEY) => { const s = JSON.parse(localStorage.getItem(KEY)); s.adventure.level = 101; localStorage.setItem(KEY, JSON.stringify(s)); }, KEY);
await page.reload();
await settle(900);
await page.getByRole('button', { name: /^Preguntas/ }).click();
await settle(900);
await page.getByRole('button', { name: 'Abrir el mapa' }).click();
await settle(1200);
await shot('15-map-boss');
await page.getByRole('button', { name: 'Enfrentarse al jefe' }).click();
await settle(1000);
await shot('16-boss');
check((await page.locator('.counter-now').textContent()) === 'Jefe', 'boss question');
await answer(true);
await settle(400);
await nextQuestion();
await settle(1800);
await shot('17-boss-defeated');
check((await page.locator('.victory-title').textContent()) === 'Jefe derrotado', 'boss defeated screen');
s = await save();
check(s.adventure.world === 1 && s.adventure.level === 1, 'next world unlocked');
await page.getByRole('button', { name: 'Al siguiente mundo' }).click();
await settle(1200);
check((await page.locator('.map-name').textContent()) === 'Laberinto', 'map shows world 2');
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1000);

// ── 6b. Tu Núcleo (cosmetic chip) ─────────────────────────────────────────
s = await save();
const energy0 = s.core.energy;
check(energy0 > 0 && s.core.earned >= energy0, `correct answers earned energy (${energy0})`);
await page.getByRole('button', { name: /^Tu Núcleo/ }).click();
await settle(1000);
check(await page.locator('.core-stage .chip').isVisible(), 'core: chip visible');
await page.locator('.core-item:not(:disabled)').first().click();
await settle(600);
s = await save();
check(s.core.slots.filter(Boolean).length === 1 && s.core.energy < energy0, 'core: module built with energy');
await page.getByRole('button', { name: /Mejorar a nivel 2/ }).click();
await settle(600);
s = await save();
check(s.core.slots.find(Boolean).lvl === 2, 'core: module upgraded to level 2');
await shot('17a-core-upgrade');
await page.getByRole('tab', { name: 'Evolución' }).click();
check(await page.getByRole('button', { name: /Evolucionar el chip/ }).isDisabled(), 'core: chip cannot evolve until full and maxed');
await page.getByRole('tab', { name: 'Color' }).click();
await page.locator('.core-item:not(.is-active):not(:disabled)').first().click();
await settle(600);
s = await save();
check(s.core.color !== 'lima' && s.core.owned.includes('color:' + s.core.color), `core: colour bought and applied (${s.core.color})`);
await shot('17b-core');
await noHorizontalOverflow('core');
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1000);

// ── 7. Offline ───────────────────────────────────────────────────────────
await context.setOffline(true);
await page.reload();
await settle(1500);
await page.getByRole('button', { name: /^Preguntas/ }).click();
await settle(900);
await page.getByRole('radio', { name: 'Clásico' }).click();
await page.getByRole('button', { name: 'Empezar', exact: true }).click();
await settle(900);
for (let i = 0; i < 5; i++) {
  await answer(true);
  await settle(300);
  await nextQuestion();
}
check((await page.locator('.counter-now').textContent()) === '06', 'offline: playing works');
const fontsOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 20px "Space Grotesk"'); });
check(fontsOk, 'offline: local fonts available');
await page.getByRole('button', { name: 'Abandonar partida' }).click();
await page.getByRole('button', { name: 'Terminar' }).click();
await settle(1000);
await context.setOffline(false);

// ── 8. Small screen ──────────────────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 667 });
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1400);
await shot('18-home-se');
await noHorizontalOverflow('home SE');

// ── 9. Landscape ─────────────────────────────────────────────────────────
await page.setViewportSize({ width: 852, height: 393 });
await settle(800);
await shot('19-home-landscape');
await noHorizontalOverflow('home landscape');
{
  const [hero, tree] = await page.evaluate(() => ['.hub-hero', '.hub-tree'].map((s) => document.querySelector(s).getBoundingClientRect().toJSON()));
  check(tree.left >= hero.right - 1 && tree.width > 300, 'landscape: home uses two columns over the full width');
}
await page.getByRole('button', { name: /^Invasión/ }).click();
await settle(900);
await page.getByRole('button', { name: /Laboratorio/ }).click();
await settle(700);
check(await page.locator('.inv-lab-item').count() >= 15, 'invasion: Laboratorio lists permanent upgrades');
await shot('20-lab-landscape');
await noHorizontalOverflow('lab landscape');
await page.getByRole('button', { name: 'Volver' }).click();
await settle(400);
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(900);
await page.setViewportSize({ width: 393, height: 852 });
await settle(600);

check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
stopServer();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
