// record-walkthrough.mjs — 自动通关录屏模板（在 Ghost Inside / Three.js 游戏上跑通）
// ── ADAPT 以下内容以适配你的游戏 ──
//   1. TARGETS：你的本地服务器 / 线上部署地址（需支持 ?test=1 暴露 window.__game）
//   2. snap()：字段映射（player 坐标、阶段名、障碍物位置等，按你游戏的快照结构改）
//   3. 关卡流程段（搜「通关流程」）：交互点坐标、跳跃触发位置、阶段等待
//   4. 节拍停顿：sleep 毫秒数按解说节奏调
//   5. OUT：输出目录
// ── 不可改的约束 ──
//   · headless: false（GPU 渲染）· 真实键盘事件 · 不调用 stepSimulation（会冻结渲染）
//   · addInitScript 拦截 blur · 运行时告知用户不要抢焦点
// 详见 ../references/pitfalls.md
// record-walkthrough.mjs — 真实键盘实时通关录屏（test=1 仅读状态，不触发 testMode，保证 60fps 渲染）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission';
mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const TL = { t0: T0, url: '', events: [], total: 0 };
const ev = (name) => { TL.events.push([name, Number(((Date.now() - T0) / 1000).toFixed(2))]); log(name); };
const watchdog = () => { if (Date.now() - T0 > 12 * 60000) throw new Error('watchdog: >12min'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ headless: false, args: ['--window-size=1300,820'] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
// 失焦防护：输入类在 window blur 时清空按键；拦截 blur 冒泡，防止外部点击打断录制
await page.addInitScript(() => {
  window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
});

const TARGETS = [process.env.TARGET, 'http://127.0.0.1:4173/?test=1', 'https://asb999.github.io/Ghost-Inside-Web/?test=1'].filter(Boolean);
let target = null;
for (const url of TARGETS) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (r.ok) { target = url; break; }
    log(`probe ${url}: HTTP ${r.status}`);
  } catch { log(`probe failed: ${url}`); }
}
if (!target) throw new Error('no reachable game target');
TL.url = target;
ev('page_loaded');
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__game !== undefined, null, { timeout: 60000 });
const MODEL = new URL('assets/models/ghost.glb', target).href;
await page.evaluate(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); await r.arrayBuffer(); }, MODEL)
  .then(() => log('model prefetch OK')).catch((e) => log('model prefetch FAILED:', String(e).slice(0, 60)));
await page.click('#btn-game-start');
await page.click('#btn-start');

let reloaded = false;
const tIntro = Date.now();
const ticker = setInterval(() => {
  if (!reloaded && Date.now() - tIntro > 75000) {
    reloaded = true;
    log('assets stuck >75s — reloading');
    clearInterval(ticker);
    page.reload({ waitUntil: 'domcontentloaded' })
      .then(() => page.waitForFunction(() => window.__game !== undefined, null, { timeout: 60000 }))
      .then(() => page.click('#btn-game-start'))
      .then(() => page.click('#btn-start'))
      .catch(() => {});
  }
}, 5000);
await page.waitForSelector('[data-story="chapter-intro"]', { state: 'detached', timeout: 300000 });
clearInterval(ticker);
await page.waitForFunction(() => { const s = window.__game?.snapshot?.(); return !!s?.scene; }, null, { timeout: 120000 });
log('scene ready'); ev('scene_ready');
await sleep(2500); // 开场驻留

// ── 实时驱动原语（真实键盘事件；__game 只读）──
const snap = () => page.evaluate(() => {
  const s = window.__game.snapshot();
  return {
    phase: s.phase,
    p: s.scene ? { x: s.scene.player.x, y: s.scene.player.y, z: s.scene.player.z } : null,
    obsX: s.scene?.course.obstacle.x ?? 0,
    passed: s.scene?.course.passes ?? 0,
    crossed: s.scene?.finalGapCrossed ?? false
  };
});
const held = new Set();
async function setHeld(desired) {
  for (const k of [...held]) if (!desired.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of desired) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
const releaseAll = () => setHeld(new Set());
// 方向：dz>0 前进(W)；dx>0 需要世界 +X = 屏幕左(A)
async function steer(dx, dz) {
  const d = new Set();
  if (dz > 0.08) d.add('KeyW'); if (dz < -0.08) d.add('KeyS');
  if (dx > 0.08) d.add('KeyA'); if (dx < -0.08) d.add('KeyD');
  await setHeld(d);
}
async function tapE() { await page.keyboard.down('KeyE'); await sleep(120); await page.keyboard.up('KeyE'); await sleep(200); }
async function tapJump() { await page.keyboard.down('Space'); await sleep(90); await page.keyboard.up('Space'); }

async function move(tx, tz, tol = 0.45, maxMs = 45000) {
  const tEnd = Date.now() + maxMs;
  while (Date.now() < tEnd) {
    watchdog();
    const s = await snap();
    if (!s.p) { await sleep(150); continue; }
    const dx = tx - s.p.x, dz = tz - s.p.z;
    if (Math.hypot(dx, dz) < tol) { await releaseAll(); return true; }
    await steer(dx, dz);
    await sleep(85);
  }
  await releaseAll(); return false;
}
async function waitPhase(t, maxMs = 30000) {
  const tEnd = Date.now() + maxMs;
  while (Date.now() < tEnd) { watchdog(); const s = await snap(); if (s.phase === t) return true; await sleep(100); }
  return false;
}

// ── 通关 ──
await move(-3.6, 1.5); await tapE(); ev('tutorial_1'); await sleep(900);
await move(0, 1.5); await tapE(); ev('tutorial_2'); await sleep(900);
await move(3.6, 1.5); await tapE(); ev('tutorial_3'); await sleep(1600);
await waitPhase('COLLECT_RESPONSIBILITIES');

await move(-2.6, 11); await tapE(); ev('carry_phone'); await sleep(1400);
await move(0, 15); await tapE(); ev('carry_medicine'); await sleep(1400);
await move(2.6, 19); await tapE(); ev('carry_application'); await sleep(1800);

const BANDS = [[26.3, 28.3], [37.3, 39.3], [49.3, 51.3]];
const inBand = (z, [a, b]) => z >= a && z <= b;
async function course(until, tag) {
  let falls = 0;
  const tEnd = Date.now() + 240000;
  while (Date.now() < tEnd) {
    watchdog();
    const s = await snap();
    if (!s.p) { await sleep(120); continue; }
    if (until(s)) { await releaseAll(); return; }
    if (s.p.y < 0.85) { await releaseAll(); await sleep(700); if (++falls > 20) throw new Error(tag + ': too many falls'); continue; }
    if (s.p.y <= 1.06) {
      let jumped = false;
      for (const b of BANDS) if (inBand(s.p.z, b)) { await tapJump(); jumped = true; break; }
      if (!jumped && s.p.z >= 60.9 && s.p.z <= 62.5) { await tapJump(); jumped = true; }
      if (!jumped) {
        if (s.p.z < 33.6) await steer(-s.p.x, 1);
        else if (s.p.z < 37.3) { if (Math.abs(s.obsX) > 3.5) await steer(0, 1); else await releaseAll(); }
        else await steer(0, 1);
      } else await steer(0, 1);
    } else await steer(0, 1);
    await sleep(80);
  }
  throw new Error(tag + ': time exhausted');
}

ev('course1_start');
await course((s) => s.passed >= 1 && s.p.z > 55, 'course1');
ev('course1_passed');
await setHeld(new Set(['KeyW']));
await waitPhase('MEMORY_HUB', 25000);
await releaseAll(); ev('first_fail'); await sleep(2600); // Ghost 台词

await move(-7, 24); await tapE(); ev('memory_mother'); await sleep(1300);
await move(0, 22); await tapE(); ev('memory_phone'); await sleep(1300);
await move(2.2, 25); await tapE(); ev('memory_hint'); await sleep(1300);
await move(7, 24); await tapE(); ev('memory_brother'); await sleep(1800);
await waitPhase('RESPONSIBILITIES_RESOLVED');

ev('course2_start');
await course((s) => s.phase === 'TRANSFER_NOTICE_REVEAL', 'course2');
await releaseAll(); ev('notice_revealed'); await sleep(1800);

await move(0, 26); await tapE(); ev('notice_picked'); await sleep(3200); // 矛盾对照字幕
await move(4.5, 23); await tapE(); ev('notice_kept'); await sleep(2000);
await waitPhase('FINAL_RUN');

ev('course3_start');
let falls3 = 0;
{
  const tEnd = Date.now() + 240000;
  while (Date.now() < tEnd) {
    watchdog();
    const s = await snap();
    if (!s.p) { await sleep(120); continue; }
    if (s.crossed) { await releaseAll(); break; }
    if (s.p.y < 0.85) { await releaseAll(); await sleep(700); if (++falls3 > 20) throw new Error('course3: falls'); continue; }
    if (s.p.y <= 1.06) {
      let jumped = false;
      for (const b of BANDS) if (inBand(s.p.z, b)) { await tapJump(); jumped = true; break; }
      if (!jumped && s.p.z >= 60.9 && s.p.z <= 62.5) { await tapJump(); ev('final_jump'); jumped = true; }
      if (!jumped) {
        if (s.p.z < 33.6) await steer(-s.p.x, 1);
        else if (s.p.z < 37.3) { if (Math.abs(s.obsX) > 3.5) await steer(0, 1); else await releaseAll(); }
        else await steer(0, 1);
      } else await steer(0, 1);
    } else await steer(0, 1);
    await sleep(80);
  }
}
ev('crossed'); await sleep(1200);

await move(0, 74.5); await tapE(); ev('replied_brother'); await sleep(2600);
await setHeld(new Set(['KeyW']));
await waitPhase('ENDING', 30000);
await releaseAll(); ev('ending');

await page.waitForTimeout(8000);
const video = page.video();
await context.close();
await video.saveAs(`${OUT}/walkthrough_raw.webm`);
TL.total = Number(((Date.now() - T0) / 1000).toFixed(2));
writeFileSync(`${OUT}/timeline.json`, JSON.stringify(TL, null, 2));
log('video + timeline saved, total', TL.total, 's, from', TL.url);
await browser.close();
process.exit(0);
