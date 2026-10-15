// Renders app icons from assets/icons/icon.svg (design: Claude Design "Android Icon").
// usage: node scripts/render-icons.js assets/icons/icon.svg assets/icons  (needs playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [art, out] = process.argv.slice(2);
const svg = fs.readFileSync(art, 'utf8');
const BG = 'radial-gradient(85% 85% at 50% 28%, #ffffff 0%, #f6f1ea 55%, #efe6d9 100%)';
// inner = fraction of canvas the 108-unit artwork occupies
const page = (size, { bg = true, art = true, inner = 1, css = '', fill = '#efe6d9' }) => `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
.c{width:${size}px;height:${size}px;position:relative;${bg ? `background:${fill}` : ''}}
.i{position:absolute;left:${size*(1-inner)/2}px;top:${size*(1-inner)/2}px;width:${size*inner}px;height:${size*inner}px;${bg ? `background:${BG}` : ''}}
.i svg{width:100%;height:100%;display:block}${css}</style></head><body><div class="c"><div class="i">${art ? svg : ''}</div></div></body></html>`;
const mono = `svg *{fill:none!important;stroke:#fff!important;opacity:1!important}svg .halo{display:none}svg .rays{display:none}`;
const jobs = [
  ['icon.png', 1024, {}],
  ['adaptive-icon.png', 1024, { bg: false, inner: 72/108 }],
  ['adaptive-icon-background.png', 1024, { art: false, inner: 72/108 }],
  ['adaptive-icon-monochrome.png', 1024, { bg: false, inner: 72/108, css: mono }],
  ['notification-icon.png', 96, { bg: false, css: mono + 'svg .ground{display:none}svg *{stroke-width:2.2!important}' }],
  ['splash-icon.png', 1024, { bg: false }],
  ['favicon.png', 196, {}],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, size, o] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(page(size, o));
    await p.locator('.c').screenshot({ path: path.join(out, name), omitBackground: true });
    await p.close();
  }
  await b.close();
})();
