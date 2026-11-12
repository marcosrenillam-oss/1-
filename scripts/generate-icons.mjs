// Renders the app icons and iOS launch images from HTML using the bundled
// Space Grotesk font. Run once with `npm run icons` (needs Playwright).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const font = readFileSync(resolve(root, 'src/assets/fonts/space-grotesk.woff2')).toString('base64');
const CARBON = '#0B0C0E';
const LIME = '#C8FF2E';

const page = (w, h, logoSize, opts = {}) => `<!doctype html><html><head><style>
@font-face{font-family:SG;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700}
html,body{margin:0;width:${w}px;height:${h}px;background:${CARBON};overflow:hidden}
.wrap{position:absolute;inset:0;display:grid;place-items:center}
.glow{position:absolute;left:50%;top:50%;width:${logoSize * 2.4}px;height:${logoSize * 1.7}px;transform:translate(-45%,-50%);
  background:radial-gradient(closest-side,rgba(200,255,46,${opts.glow ?? 0.14}),rgba(200,255,46,0));}
.logo{position:relative;font-family:SG;font-weight:700;font-size:${logoSize}px;line-height:1;letter-spacing:-0.07em;display:flex;align-items:baseline;
  transform:translateX(${opts.shift ?? -0.03}em)}
.one{color:#F4F5F6;padding-right:.04em}
.pct{color:${LIME};font-weight:600;font-size:.86em;margin-left:.02em}
.bar{position:absolute;left:0;right:0;bottom:0;height:${opts.bar ?? 0}px;background:${LIME}}
</style></head><body><div class="wrap"><div class="glow"></div><div class="logo"><span class="one">1</span><span class="pct">%</span></div></div>
${opts.bar ? '<div class="bar"></div>' : ''}</body></html>`;

const ICONS = [
  { file: 'icons/apple-touch-icon.png', size: 180, logo: 92 },
  { file: 'icons/icon-192.png', size: 192, logo: 98 },
  { file: 'icons/icon-512.png', size: 512, logo: 262 },
  // Maskable: content inside the 80% safe zone.
  { file: 'icons/icon-maskable-512.png', size: 512, logo: 200 },
];

// iPhone portrait launch images: [css width, css height, pixel ratio]
export const SPLASH = [
  [440, 956, 3], [402, 874, 3], [420, 912, 3], [430, 932, 3], [393, 852, 3], [390, 844, 3],
  [428, 926, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();

for (const icon of ICONS) {
  await p.setViewportSize({ width: icon.size, height: icon.size });
  await p.setContent(page(icon.size, icon.size, icon.logo, { glow: 0.2 }));
  await p.evaluate(() => document.fonts.ready);
  const out = resolve(root, 'public', icon.file);
  mkdirSync(dirname(out), { recursive: true });
  await p.screenshot({ path: out });
  console.log('icon', icon.file);
}

const links = [];
for (const [w, h, r] of SPLASH) {
  const pw = w * r;
  const ph = h * r;
  await p.setViewportSize({ width: pw, height: ph });
  await p.setContent(page(pw, ph, Math.round(pw * 0.34), { glow: 0 }));
  await p.evaluate(() => document.fonts.ready);
  const file = `splash/splash-${pw}x${ph}.png`;
  const out = resolve(root, 'public', file);
  mkdirSync(dirname(out), { recursive: true });
  await p.screenshot({ path: out });
  links.push(
    `    <link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="${file}" />`,
  );
  console.log('splash', file);
}
await browser.close();

// Inject the launch-image links into index.html between the SPLASH markers.
const indexPath = resolve(root, 'index.html');
const html = readFileSync(indexPath, 'utf8');
const block = `<!--SPLASH-->\n${links.join('\n')}\n    <!--/SPLASH-->`;
const next = html.includes('<!--/SPLASH-->')
  ? html.replace(/<!--SPLASH-->[\s\S]*<!--\/SPLASH-->/, block)
  : html.replace('<!--SPLASH-->', block);
writeFileSync(indexPath, next);
console.log('index.html updated');
