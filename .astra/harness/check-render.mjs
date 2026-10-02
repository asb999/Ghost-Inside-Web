// Visual regression checks: actual WebGL pixels, layout and live fallback clock.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'game/web/package.json'));
const { chromium } = require('@playwright/test');
const url = process.env.GHOST_RENDER_URL || 'http://127.0.0.1:4173/';
const dir = path.join(root, '.astra/reports/render');
fs.mkdirSync(dir, { recursive: true });
const report = { time: new Date().toISOString(), checks: {} };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
function ok(v, message) { if (!v) throw new Error(message); }
async function check(id, run) {
  try { report.checks[id] = { pass: true, detail: await run() }; console.log(`[PASS] ${id}`); }
  catch (e) { report.checks[id] = { pass: false, error: String(e) }; console.log(`[FAIL] ${id}: ${e.message}`); }
}
async function start(p) {
  await p.goto(`${url}?test=1`);
  await p.locator('#btn-start').click();
  for (let i = 0; i < 8; i++) {
    const b = p.locator('[data-action="opening-next"]');
    if (!await b.count()) break;
    await b.first().click();
  }
}
async function step(ms = 100) { await page.evaluate(m => window.__game.stepSimulation(m), ms); }
async function tap(action, ms = 100) {
  await page.evaluate(([a, m]) => {
    window.__game.input(a, true); window.__game.stepSimulation(m); window.__game.input(a, false); window.__game.stepSimulation(1);
  }, [action, ms]);
}
async function pixels() {
  return page.evaluate(() => {
    window.__game.stepSimulation(1);
    const canvas = document.querySelector('#stage');
    const gl = canvas.getContext('webgl2');
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let player = 0, floor = 0, red = 0;
    // Character cyan and lit blue floor, excluding DOM HUD and decorative emissive columns.
    for (let y = 0; y < h * .72; y++) for (let x = w * .25 | 0; x < w * .75; x++) {
      const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 85 && g > 100 && b > 105 && g > r * 1.08) player++;
      if (r > 15 && r < 85 && g > r && b > g && g > 22) floor++;
      if (r > 90 && r > g * 1.4 && r > b * 1.3) red++;
    }
    return { player, floor, red, width: w, height: h, snapshot: window.__game.snapshot() };
  });
}
try {
  await start(page);
  await check('R01_LAYOUT', async () => {
    const s = await page.evaluate(() => {
      const c = document.querySelector('#stage').getBoundingClientRect();
      const u = document.querySelector('#ui').getBoundingClientRect();
      return { x: c.x, y: c.y, w: c.width, h: c.height, uiX: u.x, uiY: u.y, uiW: u.width, uiH: u.height,
        scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, styles: document.styleSheets.length };
    });
    ok(s.styles > 0 && s.x === 0 && s.y === 0 && s.w === 960 && s.h === 640 && s.uiX === 0 && s.uiY === 0 && s.uiW === 960 && s.uiH === 640 && s.scrollW === 960 && s.scrollH === 640, 'Canvas/UI layout or stylesheet missing');
    return s;
  });
  await check('R02_GARDEN_PIXELS', async () => {
    const p = await pixels();
    await page.screenshot({ path: path.join(dir, 'garden.png') });
    ok(p.snapshot.beat === 'garden', 'Not in garden');
    ok(p.player > 100 && p.floor > 1000, `Garden not visible: player=${p.player}, floor=${p.floor}`);
    return p;
  });
  await check('R03_COLLECTOR_PIXELS', async () => {
    for (let i = 0; i < 400; i++) {
      const s = await page.evaluate(() => window.__game.snapshot());
      if (s.beat === 'collector') break;
      if (s.player.z >= 91) {
        if (!s.scene.clueObserved) await tap(s.scene.cluePinned ? 'interact' : 'support');
        else { await tap('interact', 200); await page.waitForTimeout(700); }
      } else {
        const z = [44, 50, 58, 84].find(z => z > s.player.z - .4);
        if (z !== undefined && z - s.player.z < 3 && s.player.y <= 1.01) await tap('jump', 400);
        else await step(300);
      }
    }
    const p = await pixels();
    await page.screenshot({ path: path.join(dir, 'collector.png') });
    ok(p.snapshot.beat === 'collector', 'Not in collector');
    ok(p.player > 100 && p.floor > 1000 && p.red > 100, `Collector not visible: ${JSON.stringify({ player: p.player, floor: p.floor, red: p.red })}`);
    return p;
  });
  await check('R04_NO_RAF_LIVE', async () => {
    const fallback = await context.newPage();
    fallback.on('pageerror', e => errors.push(`fallback: ${e}`));
    await fallback.addInitScript(() => { window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; });
    await start(fallback);
    await fallback.waitForTimeout(250);
    const read = () => fallback.evaluate(() => window.__game.snapshot());
    const a = await read();
    await fallback.waitForTimeout(1000);
    const b = await read();
    await fallback.screenshot({ path: path.join(dir, 'fallback.png') });
    const distance = b.player.z - a.player.z;
    ok(distance > 4.5 && distance < 10, `Fallback speed incorrect: ${distance}`);
    ok(b.stats.calls > 0 && b.stats.triangles > 0, 'Fallback did not render');
    await fallback.close();
    return { distance, stats: b.stats };
  });
  await check('R05_NO_PAGE_ERRORS', async () => { ok(errors.length === 0, errors.join('\n')); return errors; });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(report, null, 2));
}
process.exitCode = Object.values(report.checks).every(c => c.pass) && Object.keys(report.checks).length === 5 ? 0 : 1;
