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
const stopServer = () => { try { process.kill(-server.pid); } catch { /* already gone */ } };
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
  viewport: { width: 393, height: 852 }, // iPhone 15/16 Pro
  deviceScaleFactor: Number(process.env.DPR ?? 1),
  isMobile: true,
  hasTouch: true,
  reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference',
});
// Simulate the Dynamic Island / home-indicator safe areas of a standalone PWA.
await context.addInitScript(() => {
  const add = () => {
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

async function noHorizontalOverflow(label) {
  const bad = await page.evaluate(() => {
    const els = [document.documentElement, ...document.querySelectorAll('.screen')];
    return els.some((el) => el.scrollWidth > el.clientWidth + 1);
  });
  check(!bad, `no horizontal overflow (${label})`);
}

/** Answers the current question; correct=true picks the right option. */
async function answer(correct) {
  const s = await save();
  const run = s.run;
  const order = run.orders[run.index];
  const pos = correct ? order.indexOf(0) : order.findIndex((i) => i !== 0); // authored answer is index 0
  await page.locator('.opt').nth(pos).click();
  await page.locator('.btn-confirm').click();
}

async function nextQuestion() {
  await page.waitForTimeout(250); // a human reads the explanation first
  await page.locator('.feedback--good .btn').click();
  await settle(450);
}

// ── 1. Home ───────────────────────────────────────────────────────────────
await page.goto(URL);
await settle(1600);
await shot('01-home');
const bg = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
check(bg.every((c) => c === 'rgb(11, 12, 14)'), `html/body background is carbon (${bg})`);
const topPad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.screen')).paddingTop));
check(topPad >= 59 + 14, `content clears the Dynamic Island (padding-top ${topPad}px)`);
await noHorizontalOverflow('home');
const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
const manifest = await (await page.request.get(new globalThis.URL(manifestHref, URL).href)).json();
check(manifest.display === 'standalone' && manifest.short_name === '1%' && manifest.name === '1%', 'manifest standalone, name 1%');
const metas = await page.evaluate(() => ({
  cap: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
  vp: document.querySelector('meta[name="viewport"]')?.content,
  icon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
}));
check(metas.cap === 'yes' && metas.bar === 'black-translucent' && metas.vp.includes('viewport-fit=cover') && !!metas.icon, 'iOS meta tags present');

// Service worker active and controlling.
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await settle(800);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');

// ── 2. Mode switching ─────────────────────────────────────────────────────
for (const [i, label] of ['Normal', 'Difícil', 'Experto', 'Fácil'].entries()) {
  await page.getByRole('radio', { name: label }).click();
  await settle(500);
  if (i === 2) await shot('02-home-experto');
}
check((await save()).lastMode === 'facil', 'last used mode persisted');

// ── 3. Full winning run (Fácil) ───────────────────────────────────────────
await page.getByRole('button', { name: 'Empezar' }).click();
await settle(900);
await shot('03-question');
await noHorizontalOverflow('question');
const seenIds = new Set();
for (let i = 0; i < 20; i++) {
  const s = await save();
  check(s.run.index === i, `question ${i + 1}: counter in sync`);
  const counter = await page.locator('.counter-now').textContent();
  if (counter !== String(i + 1).padStart(2, '0')) check(false, `counter shows ${counter} at ${i + 1}`);
  seenIds.add(s.run.ids[i]);
  await answer(true);
  await settle(350);
  if (i === 0) await shot('04-correct');
  if (i === 6) {
    // Persistence mid-game: reload resumes the same run at the next question.
    const before = await save();
    await page.reload();
    await settle(900);
    const after = await save();
    check(after.run && after.run.index === before.run.index && after.run.ids.join() === before.run.ids.join(), 'reload mid-game resumes the run');
    await settle(200);
    continue;
  }
  if (i < 19) await nextQuestion();
}
check(seenIds.size === 20, '20 different questions in the run');
await shot('05-twenty-correct');
await settle(300);
await page.locator('.feedback--good .btn').click();
await settle(1800);
await shot('06-victory');
check(await page.locator('.victory-title').isVisible(), 'victory screen shown');
let st = (await save()).stats.facil;
check(st.completed === 1 && st.best === 20 && st.played === 1, `fácil stats after win ${JSON.stringify({ c: st.completed, b: st.best, p: st.played })}`);

// ── 4. Losing run (Normal) ────────────────────────────────────────────────
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(900);
await page.getByRole('radio', { name: 'Normal' }).click();
await page.getByRole('button', { name: 'Empezar' }).click();
await settle(900);
const firstNormal = (await save()).run.ids.join();
for (let i = 0; i < 3; i++) {
  await answer(true);
  await settle(300);
  await nextQuestion();
}
await answer(false);
await settle(400);
await shot('07-wrong');
await settle(1600);
await shot('08-game-over');
check(await page.locator('.result-num').textContent() === '03', 'game over shows score 03');
st = (await save()).stats.normal;
check(st.played === 1 && st.best === 3 && st.completed === 0 && (await save()).run === null, 'normal stats after loss; run cleared');
check((await save()).stats.facil.best === 20, 'records kept per difficulty');
await page.getByRole('button', { name: 'Volver a empezar' }).click();
await settle(900);
const s2 = await save();
check(s2.run.index === 0 && s2.run.ids.join() !== firstNormal, 'restart begins at question 1 with a different set');

// ── 5. Abandon ────────────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Abandonar partida' }).click();
await settle(500);
await shot('09-abandon-dialog');
await page.getByRole('button', { name: 'Abandonar', exact: true }).click();
await settle(900);
check((await save()).stats.normal.played === 2, 'abandon counts as a played game');
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1200);

// ── 5b. Double taps never double-submit or double-start ──────────────────
await page.getByRole('radio', { name: 'Difícil' }).click();
const startedBefore = (await save()).stats.dificil.gamesStarted;
await page.getByRole('button', { name: 'Empezar' }).dblclick();
await settle(900);
check((await save()).stats.dificil.gamesStarted === startedBefore + 1, 'double tap on Empezar starts one game');
{
  const s = await save();
  const pos = s.run.orders[0].indexOf(0);
  await page.locator('.opt').nth(pos).click();
  await page.locator('.btn-confirm').dblclick();
  await settle(400);
  const after = await save();
  check(after.run.index === 1, `double tap on Confirmar answers once (index ${after.run.index})`);
  check(await page.locator('.feedback--good').isVisible(), 'double tap on Confirmar keeps the explanation on screen');
  await page.locator('.feedback--good .btn').dblclick();
  await settle(600);
  check((await save()).run.index === 1 && (await page.locator('.counter-now').textContent()) === '02', 'double tap on Siguiente advances once');
}
await page.getByRole('button', { name: 'Abandonar partida' }).click();
await page.getByRole('button', { name: 'Abandonar', exact: true }).click();
await settle(900);
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1200);

// ── 5c. Contrarreloj ──────────────────────────────────────────────────────
await page.getByRole('radio', { name: 'Contrarreloj' }).click();
await settle(500);
await shot('12-home-crono');
check((await save()).lastTimed === true, 'contrarreloj selection persisted');
const classicBefore = (await save()).stats.dificil.played;
await page.getByRole('button', { name: 'Empezar contrarreloj' }).click();
await settle(1200);
check(await page.locator('.clock').isVisible(), 'contrarreloj: clock visible');
{
  const s = await save();
  check(s.run.timed === true && s.run.timer?.index === 0 && s.run.timer.deadline > Date.now(), 'contrarreloj: clock started for question 1');
  const t1 = await page.locator('.clock-num').textContent();
  await settle(1500);
  const t2 = await page.locator('.clock-num').textContent();
  check(t1 !== t2, `contrarreloj: clock counts down (${t1} → ${t2})`);
  await shot('13-crono-question');
  await answer(true);
  await settle(400);
  await nextQuestion();
  await settle(600);
  // Leave the app and come back after the deadline: the run is lost.
  const s2 = await save();
  check(s2.run.timer?.index === 1, 'contrarreloj: new clock for question 2');
  s2.run.timer.deadline = Date.now() - 1000;
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, s2]);
  await page.reload();
  await settle(800);
  await shot('14-crono-timeout');
  check((await page.locator('.feedback--bad .feedback-title').textContent()) === 'Se acabó el tiempo', 'contrarreloj: timeout shown after returning late');
  await settle(1800);
  check((await page.locator('.result-eyebrow').textContent()).includes('tiempo'), 'contrarreloj: result explains the timeout');
  const s3 = await save();
  check(s3.crono.dificil.played === 1 && s3.crono.dificil.best === 1 && s3.stats.dificil.played === classicBefore, 'contrarreloj: separate records');
}
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1200);
await page.getByRole('radio', { name: 'Clásico' }).click();
await settle(400);

// ── 6. Offline (airplane mode) ────────────────────────────────────────────
await context.setOffline(true);
await page.reload();
await settle(1500);
check(await page.locator('.logo').isVisible(), 'offline: app shell loads from cache');
await page.getByRole('radio', { name: 'Experto' }).click();
await page.getByRole('button', { name: 'Empezar' }).click();
await settle(900);
for (let i = 0; i < 20; i++) {
  await answer(true);
  await settle(250);
  if (i === 12) await shot('10-offline-question');
  if (i < 19) await nextQuestion();
}
await settle(300);
await page.locator('.feedback--good .btn').click();
await settle(1500);
check(await page.locator('.victory-title').isVisible(), 'offline: complete 20/20 run in Experto');
await page.getByRole('button', { name: 'Nueva partida' }).click();
await settle(900);
check((await save()).run?.index === 0, 'offline: new game starts');
await page.reload();
await settle(1200);
check((await save()).stats.experto.completed === 1, 'offline: progress persists across reload');
const fontsOk = await page.evaluate(async () => {
  await document.fonts.ready;
  return document.fonts.check('700 20px "Space Grotesk"') && document.fonts.check('500 16px Inter');
});
check(fontsOk, 'offline: local fonts available');
await context.setOffline(false);

// ── 7. Small screen (iPhone SE) ───────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 667 });
await page.getByRole('button', { name: 'Abandonar partida' }).click();
await page.getByRole('button', { name: 'Abandonar', exact: true }).click();
await settle(900);
await page.getByRole('button', { name: 'Inicio' }).click();
await settle(1400);
await shot('11-home-se');
await noHorizontalOverflow('home SE');

check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);

await browser.close();
stopServer();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
