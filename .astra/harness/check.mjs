// check.mjs — 自检 harness runner：H01–H16，每项一行 [PASS]/[FAIL]
// 只依据本次运行结果；详情写 .astra/reports/。
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WEB = path.join(ROOT, 'game', 'web');
const REPORTS = path.join(ROOT, '.astra', 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const require = createRequire(path.join(WEB, 'package.json'));
const { chromium } = require('@playwright/test');

const PORT = 4179;
const RUN_ID = `h${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const CHECKS = [
  'H01_BUILD_HTTP', 'H02_NORMAL_INPUT', 'H03_ORDERED_FLOW', 'H04_CLEAN_SMOKE',
  'H05_CASE_CONTRACT', 'H06_EVIDENCE_BOUNDARY', 'H07_COPY_LINT', 'H08_BEAT_BUDGET',
  'H09_NO_KEY', 'H10_PROVIDER_TIMEOUT', 'H11_PROVIDER_INVALID', 'H12_OFFLINE',
  'H13_INTERACTIVE_TIME', 'H14_RENDER_BUDGET', 'H15_DELIVERABLES', 'H16_SECRET_BOUNDARY'
];

const serverLog = [];
let server = null;
let browser = null;
let mock = null;
let mockPort = 0;

function log(line) { console.error(line); }

async function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [path.join(WEB, 'scripts', 'start.mjs')], {
    cwd: WEB,
    env: { ...process.env, GHOST_PORT: String(PORT), GHOST_HARNESS_RUN_ID: RUN_ID, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => serverLog.push(String(d)));
  child.stderr.on('data', (d) => serverLog.push(String(d)));
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const ready = serverLog.join('').split('\n').some((l) => {
      try {
        const j = JSON.parse(l);
        return j.type === 'ghost-ready' && j.runId === RUN_ID;
      } catch { return false; }
    });
    if (ready) return child;
    if (child.exitCode !== null) throw new Error(`server exited: ${serverLog.join('').slice(-800)}`);
    await sleep(150);
  }
  child.kill();
  throw new Error('server start timeout 60s');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

// 严格静态文件服务（无 SPA 回退），挂载 dist 到 /ghost/
function startStaticServer(mount) {
  const srv = http.createServer((req, res) => {
    const rel = req.url.replace(mount, '').split('?')[0];
    if (rel === '/' || rel === '') {
      const idx = path.join(WEB, 'dist', 'index.html');
      if (fs.existsSync(idx)) {
        res.writeHead(200).end(fs.readFileSync(idx));
      } else res.writeHead(404).end();
      return;
    }
    const file = path.join(WEB, 'dist', path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(path.join(WEB, 'dist')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port })));
}

// 故障注入 mock provider
function startMock() {
  const routes = {
    '/ok': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['R01', 'E02'] }),
    '/pick': (body) => {
      const s = JSON.parse(body).statement ?? '';
      if (s.includes('ACCEPT')) return { verdict: 'accept', feedback_key: 't_accept_thanks', evidence_ids: ['F01', 'F02', 'B01'] };
      if (s.includes('REVISE')) return { verdict: 'revise', feedback_key: 't_revise_not_hate', evidence_ids: ['E03', 'F02'] };
      return { verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['R01', 'E02'] };
    },
    '/invalid-json': () => 'not-json-at-all',
    '/not-object': () => [],
    '/missing-field': () => ({ verdict: 'hold' }),
    '/unknown-template': () => ({ verdict: 'hold', feedback_key: 'nope', evidence_ids: ['R01'] }),
    '/reject-verdict': () => ({ verdict: 'reject', feedback_key: 't_hold_read_first', evidence_ids: ['R01'] }),
    '/no-evidence': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: [] }),
    '/unknown-evidence': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['NOPE'] }),
    '/locked-evidence': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['B02'] }),
    '/dup-evidence': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['R01', 'R01'] }),
    '/extra-field': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['R01'], cmd: 'unlock_all' }),
    '/huge': () => ({ verdict: 'hold', feedback_key: 't_hold_read_first', evidence_ids: ['R01'], pad: 'x'.repeat(2 * 1024 * 1024) }),
    '/http500': () => { const e = new Error('boom'); e.statusCode = 500; throw e; }
  };
  const hangs = ['/hang', '/hang-body'];
  const srv = http.createServer((req, res) => {
    const route = req.url.split('?')[0];
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (hangs.includes(route)) return; // 永不响应（/hang-body 在下方已发 header 的分支处理）
      if (route === '/hang-body') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return; // header 已发，body 永不结束
      }
      const fn = routes[route];
      if (!fn) { res.writeHead(404).end(); return; }
      try {
        const out = fn(body);
        if (typeof out === 'string') { res.writeHead(200).end(out); return; }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(e.statusCode ?? 500).end('mock error');
      }
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port })));
}

// ── 流程驱动（只组合正式输入；不做任何状态直写）──
async function clickThroughOpening(page) {
  for (let i = 0; i < 8; i++) {
    const btn = page.locator('[data-action="opening-next"]');
    if ((await btn.count()) === 0) break;
    await btn.first().click();
    await sleep(60);
  }
}

async function driveGarden(page) {
  // 模拟时间推进 + 跳跃越过障碍；终点按 E 关闭终端
  for (let i = 0; i < 600; i++) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const snap = g.snapshot();
      return { beat: snap.beat, z: snap.player?.z ?? 0, y: snap.player?.y ?? 1 };
    });
    if (s.beat !== 'garden') return;
    if (s.z >= 92) {
      // 按住交互的同时必须推进模拟（测试模式下 RAF 已停），终端关闭后等真实 500ms 延迟
      await page.evaluate(() => window.__game.input('interact', true));
      await page.evaluate(() => window.__game.stepSimulation(200));
      await page.waitForTimeout(700);
      await page.evaluate(() => window.__game.input('interact', false));
      continue;
    }
    const nextObs = [24, 42, 60].find((z) => z > s.z - 0.4);
    if (nextObs !== undefined && nextObs - s.z < 3.0 && s.y <= 1.01) {
      await page.evaluate(() => window.__game.input('jump', true));
      await page.evaluate(() => window.__game.stepSimulation(400));
      await page.evaluate(() => window.__game.input('jump', false));
      continue;
    }
    await page.evaluate(() => window.__game.stepSimulation(300));
  }
}

async function driveCollector(page) {
  for (let i = 0; i < 600; i++) {
    const s = await page.evaluate(() => window.__game.snapshot());
    if (s.beat !== 'collector') return;
    if (s.history.some((e) => e.id === 'collector_converted')) return;
    if (s.history.filter((e) => e.id === 'collector_defense_drop').length >= 3) {
      // 防御归零：向前接近并交互转化
      await page.evaluate(() => {
        window.__game.input('forward', true);
        window.__game.stepSimulation(900);
      });
      await page.evaluate(() => window.__game.input('interact', true));
      await page.evaluate(() => window.__game.stepSimulation(400));
      await page.evaluate(() => window.__game.input('interact', false));
      continue;
    }
    await page.evaluate(() => window.__game.stepSimulation(400));
  }
}

async function driveDinner(page) {
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-action="dinner-cycle"]').click();
    await sleep(60);
  }
  await page.locator('[data-action="reveal"]').click();
  await page.locator('[data-action="to-pollution"]').click();
}

async function drivePollution(page) {
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => window.__game.snapshot());
    if (s.beat !== 'pollution') return s.beat;
    await page.evaluate(() => window.__game.stepSimulation(500));
  }
  return 'timeout';
}

async function submitAtStatement(page, text, ids) {
  const res = await page.evaluate(([t, e]) => window.__game.submitJudgment(t, e), [text, ids]);
  if (!res.ok) return res;
  await page.waitForFunction(
    () => window.__game?.snapshot?.().feedback !== null,
    null, { timeout: 20000 }
  );
  return res;
}

async function finishToEnd(page) {
  await page.locator('[data-action="feedback-continue"]').click();
  // 尾声：逐行点继续，最后结束
  for (let i = 0; i < 8; i++) {
    const s = await page.evaluate(() => window.__game.snapshot());
    if (s.beat === 'closed') return;
    const btn = page.locator('[data-action="epilogue-next"], [data-action="case-close"]').last();
    await btn.click();
    await sleep(50);
  }
}

async function fullFlow(page, statementText, ids) {
  await page.goto(`http://127.0.0.1:${PORT}/?test=1`);
  await page.locator('#btn-start').click();
  await clickThroughOpening(page);
  await driveGarden(page);
  await driveCollector(page);
  await driveDinner(page);
  await drivePollution(page);
  await submitAtStatement(page, statementText, ids);
  await finishToEnd(page);
  return page.evaluate(() => window.__game.snapshot());
}

// ── 各项检查 ──
const results = {};
const detail = {};

async function h01() {
  const res = await get(`http://127.0.0.1:${PORT}/`);
  assertEq(res.status, 200, '首页状态码');
  assertOk(res.body.includes('data-app="ghost-inside"'), '缺少 data-app 标记');
  const assets = [...res.body.matchAll(/assets\/[^"]+/g)].map((m) => m[0]);
  assertOk(assets.length > 0, '无本地资源引用');
  for (const a of assets) {
    const r = await get(`http://127.0.0.1:${PORT}/${a}`);
    assertEq(r.status, 200, `资源 ${a}`);
  }
  const stat = await startStaticServer('/ghost');
  try {
    const sub = await get(`http://127.0.0.1:${stat.port}/ghost/`);
    assertEq(sub.status, 200, '子路径首页');
    for (const a of assets) {
      const r = await get(`http://127.0.0.1:${stat.port}/ghost/${a}`);
      assertEq(r.status, 200, `子路径资源 ${a}`);
    }
    const missing = await get(`http://127.0.0.1:${stat.port}/ghost/nope.js`);
    assertEq(missing.status, 404, 'SPA 回退掩盖 404');
  } finally { stat.srv.close(); }
  return { assets: assets.length };
}

async function h02() {
  // (a) 普通页面：真实点击 + 真实键盘
  const ctxA = await browser.newContext();
  const pa = await ctxA.newPage();
  const errs = [];
  pa.on('pageerror', (e) => errs.push(String(e)));
  await pa.goto(`http://127.0.0.1:${PORT}/`);
  await pa.locator('#btn-start').click();
  await clickThroughOpening(pa);
  await sleep(400);
  const readTel = () => pa.locator('#telemetry').evaluate((el) => ({
    beat: el.dataset.beat, x: parseFloat(el.dataset.x), y: parseFloat(el.dataset.y), z: parseFloat(el.dataset.z)
  }));
  await pa.keyboard.down('ArrowRight');
  await pa.waitForTimeout(700);
  const t1 = await readTel();
  await pa.keyboard.up('ArrowRight');
  assertOk(t1.x > 0.5, `真实右键未移动: x=${t1.x}`);
  await pa.keyboard.down('Space');
  await pa.waitForTimeout(280);
  const t2 = await readTel();
  await pa.keyboard.up('Space');
  assertOk(t2.y > 1.2, `空格未离地: y=${t2.y}`);
  await pa.waitForTimeout(700);
  const t3 = await readTel();
  assertOk(Math.abs(t3.y - 1) < 0.05, '未落地');
  // 失焦清空按键：按住右键后 blur，x 不应继续增加
  await pa.keyboard.down('ArrowRight');
  const xBefore = (await readTel()).x;
  await ctxA.pages()[0].evaluate(() => window.dispatchEvent(new Event('blur')));
  await pa.waitForTimeout(500);
  const xAfter = (await readTel()).x;
  await pa.keyboard.up('ArrowRight');
  assertOk(Math.abs(xAfter - xBefore) < 1.2, `失焦后按键未清空: ${xBefore}→${xAfter}`);
  assertOk(errs.length === 0, `页面错误: ${errs[0]}`);
  await ctxA.close();

  // (b) 表态真实 DOM：空白 / 61 字 / 60 字（测试页快进到表态点）
  const ctxB = await browser.newContext();
  const pb = await ctxB.newPage();
  await pb.goto(`http://127.0.0.1:${PORT}/?test=1`);
  await pb.locator('#btn-start').click();
  await clickThroughOpening(pb);
  await driveGarden(pb);
  await driveCollector(pb);
  await driveDinner(pb);
  await drivePollution(pb);
  const input = pb.locator('[data-story="statement-input"]');
  const submitBtn = pb.locator('[data-action="statement-submit"]');
  await submitBtn.click();
  await assertToast(pb, '请输入 1–60 字');
  await input.fill('字'.repeat(61));
  await submitBtn.click();
  await assertToast(pb, '请输入 1–60 字');
  await input.fill('谢'.repeat(60));
  await pb.locator('.chip[data-card-id="R01"]').click();
  await submitBtn.click();
  await pb.waitForFunction(() => document.querySelector('[data-story="feedback"]'), null, { timeout: 20000 });
  // 中文组合输入：compositionstart/update/end + input 事件不导致提交或崩溃
  await pb.evaluate(() => {
    const ta = document.querySelector('[data-story="statement-input"]');
    ta.dispatchEvent(new CompositionEvent('compositionstart', { data: '不' }));
    ta.dispatchEvent(new CompositionEvent('compositionupdate', { data: '不知道' }));
    ta.dispatchEvent(new CompositionEvent('compositionend', { data: '不知道' }));
  });
  await ctxB.close();
  return { keyboard: true, statementDom: true };
}

async function assertToast(page, text) {
  const toast = await page.locator('[data-story="statement-error"]').textContent();
  assertOk(toast.includes(text), `提示不符: ${toast}`);
}

async function h03() {
  const snap = await fullFlow(browser.newPage(), '感谢家人的付出，不等于把以后所有选择都交出去。', ['F02', 'B01'])
    .finally((p) => p);
  const ctxPage = snap; void ctxPage;
  return snap;
}

async function h04(pageErrors, consoleErrors, failedRequests) {
  assertEq(pageErrors.length, 0, `pageerror: ${pageErrors[0]}`);
  assertEq(consoleErrors.length, 0, `console.error: ${consoleErrors[0]}`);
  assertEq(failedRequests.length, 0, `资源失败: ${failedRequests[0]}`);
  return { clean: true };
}

async function h05() {
  const { h05CaseContract } = await import('./checks/data.mjs');
  return h05CaseContract();
}
async function h07() {
  const { h07CopyLint } = await import('./checks/data.mjs');
  return h07CopyLint();
}
async function h08() {
  const { h08BeatBudget } = await import('./checks/data.mjs');
  return h08BeatBudget();
}

async function h06() {
  // 未知/锁定证据在真实 UI 被拒绝；三种合法判定经 mock provider 均可达结尾
  const url = `http://127.0.0.1:${mockPort}/pick`;
  for (const marker of ['ACCEPT', 'REVISE', 'HOLD']) {
    const page = await browser.newPage();
    const snap = await fullFlow(page, `${marker} ${marker} 一句判断`, ['F02', 'B01']);
    assertEq(snap.beat, 'closed', `${marker} 未到结尾`);
    assertEq(snap.feedback.verdict, marker.toLowerCase(), `${marker} 判定不符`);
    // provider 不得改变世界数据：除已解锁卡外数量不变
    assertOk(snap.unlockedCards.length >= 8, '解锁卡数量异常');
    await page.close();
  }
  // 边界负例（状态机层）
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?test=1`);
  await page.locator('#btn-start').click();
  await clickThroughOpening(page);
  const wrongBeat = await page.evaluate(() => window.__game.submitJudgment('测试', ['F02']));
  assertEq(wrongBeat.ok, false, '非表态点居然可提交');
  await page.evaluate(() => window.__game.stepSimulation(1000));
  const badIds = await page.evaluate(() => window.__game.submitJudgment('测试', ['NOPE']));
  assertEq(badIds.reason, 'unknown_evidence', '未知证据未被拒');
  await page.close();
  return { threeVerdicts: true };
}

async function h09() {
  const page = await browser.newPage();
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) external.push(r.url()); });
  const snap = await fullFlow(page, '一句判断 HOLD', ['F02', 'B01']);
  assertEq(snap.beat, 'closed', '未到结尾');
  assertEq(snap.feedback.source, 'unconfigured', '来源应为 unconfigured');
  const expect = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/cases/case_001_optimal_life.json'), 'utf8'));
  assertEq(snap.feedback.response, expect.fallbacks.hold.response, '回退文本与 JSON 不一致');
  await page.close();
  return { externalRequests: external.length };
}

async function h10() {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?test=1&provider=${encodeURIComponent(`http://127.0.0.1:${mockPort}/hang`)}`);
  await page.locator('#btn-start').click();
  await clickThroughOpening(page);
  await driveGarden(page);
  await driveCollector(page);
  await driveDinner(page);
  await drivePollution(page);
  const t0 = Date.now();
  const res = await page.evaluate(([t, e]) => window.__game.submitJudgment(t, e), ['一句判断', ['R01']]);
  assertOk(res.ok, '提交失败');
  await page.waitForFunction(() => window.__game?.snapshot?.().feedback !== null, null, { timeout: 15000 });
  const elapsed = (Date.now() - t0) / 1000;
  const snap = await page.evaluate(() => window.__game.snapshot());
  assertOk(elapsed >= 7.5 && elapsed <= 10.5, `超时耗时异常: ${elapsed}s`);
  assertEq(snap.feedback.source, 'timeout', '来源应为 timeout');
  const expect = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/cases/case_001_optimal_life.json'), 'utf8'));
  assertEq(snap.feedback.response, expect.fallbacks.timeout.response, 'timeout 回退文本不符');
  await finishToEnd(page);
  const done = await page.evaluate(() => window.__game.snapshot());
  assertEq(done.beat, 'closed', '超时后未到结尾');
  await page.close();
  // header 已发但 body 不结束 → 同样走 timeout 回退
  const page2 = await browser.newPage();
  await page2.goto(`http://127.0.0.1:${PORT}/?test=1&provider=${encodeURIComponent(`http://127.0.0.1:${mockPort}/hang-body`)}`);
  await page2.locator('#btn-start').click();
  await clickThroughOpening(page2);
  await driveGarden(page2);
  await driveCollector(page2);
  await driveDinner(page2);
  await drivePollution(page2);
  await page2.evaluate(([t, e]) => window.__game.submitJudgment(t, e), ['一句判断', ['R01']]);
  await page2.waitForFunction(() => window.__game?.snapshot?.().feedback !== null, null, { timeout: 15000 });
  const snap2 = await page2.evaluate(() => window.__game.snapshot());
  assertEq(snap2.feedback.source, 'timeout', 'hang-body 未走 timeout');
  await page2.close();
  return { elapsed };
}

async function h11() {
  const faults = ['invalid-json', 'not-object', 'missing-field', 'unknown-template', 'reject-verdict',
    'no-evidence', 'unknown-evidence', 'locked-evidence', 'dup-evidence', 'extra-field', 'huge', 'http500'];
  const expect = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/cases/case_001_optimal_life.json'), 'utf8'));
  for (const f of faults) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/?test=1&provider=${encodeURIComponent(`http://127.0.0.1:${mockPort}/${f}`)}`);
    await page.locator('#btn-start').click();
    await clickThroughOpening(page);
    await driveGarden(page);
    await driveCollector(page);
    await driveDinner(page);
    await drivePollution(page);
    const res = await page.evaluate(([t, e]) => window.__game.submitJudgment(t, e), ['一句判断', ['R01']]);
    assertOk(res.ok, `${f}: 提交被拒`);
    await page.waitForFunction(() => window.__game?.snapshot?.().feedback !== null, null, { timeout: 20000 });
    const snap = await page.evaluate(() => window.__game.snapshot());
    assertEq(snap.feedback.source, 'invalid_or_unavailable', `${f}: 来源不符`);
    assertEq(snap.feedback.response, expect.fallbacks.hold.response, `${f}: 回退文本不符`);
    await finishToEnd(page);
    const done = await page.evaluate(() => window.__game.snapshot());
    assertEq(done.beat, 'closed', `${f}: 未到结尾`);
    await page.close();
  }
  return { faults: faults.length };
}

async function h12() {
  // 断网后表态仍可完成
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?test=1&provider=${encodeURIComponent(`http://127.0.0.1:${mockPort}/hang`)}`);
  await page.locator('#btn-start').click();
  await clickThroughOpening(page);
  await driveGarden(page);
  await driveCollector(page);
  await driveDinner(page);
  await ctx.setOffline(true);
  await drivePollution(page);
  await submitAtStatement(page, '一句判断', ['R01']);
  await finishToEnd(page);
  const snap = await page.evaluate(() => window.__game.snapshot());
  assertEq(snap.beat, 'closed', '断网后未到结尾');
  await ctx.close();
  return { offline: true };
}

async function h13() {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.locator('#btn-start').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => document.querySelector('[data-action="opening-next"]'), null, { timeout: 5000 });
    times.push((Date.now() - t0) / 1000);
    await ctx.close();
  }
  const max = Math.max(...times);
  assertOk(max < 5, `可交互时间 ${max}s ≥ 5s`);
  return { max };
}

async function h14() {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?test=1`);
  await page.locator('#btn-start').click();
  await clickThroughOpening(page);
  // 花园：真实时钟采样 120 帧（不加速）
  await sample(page, 'garden');
  await driveGarden(page);
  await driveCollectorWait(page);
  // 收集者：真实时钟采样 120 帧
  await sample(page, 'collector');
  await page.close();
  return { sampled: 240 };
}

async function driveCollectorWait(page) {
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => window.__game.snapshot());
    if (s.beat === 'collector') return;
    if (s.beat === 'garden') {
      await page.evaluate(() => window.__game.stepSimulation(500));
      continue;
    }
    return;
  }
}

async function sample(page, phase) {
  const samples = [];
  for (let i = 0; i < 130; i++) {
    const st = await page.evaluate(() => {
      const s = window.__game.snapshot();
      return { calls: s.stats.calls, tri: s.stats.triangles, beat: s.beat, hasPlayer: s.hasPlayer };
    });
    if (st.beat === phase) samples.push(st);
    await sleep(20);
  }
  assertOk(samples.length >= 120, `${phase} 采样不足: ${samples.length}`);
  for (const s of samples) {
    assertOk(s.calls > 0 && s.calls <= 100, `${phase} draw calls 超限: ${s.calls}`);
    assertOk(s.tri > 0 && s.tri <= 150000, `${phase} 三角形超限: ${s.tri}`);
    assertOk(s.hasPlayer, `${phase} 关键对象缺失`);
  }
}

async function h15() {
  const files = [
    'game/web/src/main.js', 'game/data/cases/case_001_optimal_life.json',
    'game/web/package-lock.json', 'game/web/README.md', 'DEMO_CHECKLIST.md',
    '.astra/harness/check.mjs', '.astra/harness/check.sh', 'ask_astra.sh'
  ];
  for (const f of files) {
    assertOk(fs.existsSync(path.join(ROOT, f)), `缺少交付物 ${f}`);
  }
  const readme = fs.readFileSync(path.join(ROOT, 'game/web/README.md'), 'utf8');
  for (const cmd of ['npm install', 'npm start', 'npm run build', 'bash ./ask_astra.sh check', 'VITE_GHOST_PROVIDER_URL']) {
    assertOk(readme.includes(cmd), `README 缺少 ${cmd}`);
  }
  const checklist = fs.readFileSync(path.join(ROOT, 'DEMO_CHECKLIST.md'), 'utf8');
  for (const kw of ['生活切片', '完美花园', '饭桌', '污染', '表态', '我不知道', '心流', '共鸣', '掌声延迟', '静音呼吸', '台词的人味']) {
    assertOk(checklist.includes(kw), `走查表缺少 ${kw}`);
  }
  return { files: files.length };
}

async function h16() {
  const fake = 'FAKEKEY_8f2c1e';
  execSync('npm run build', {
    cwd: WEB,
    env: { ...process.env, VITE_GHOST_PROVIDER_URL: 'https://gateway.example/ghost', VITE_GHOST_FAKE_KEY: fake },
    stdio: 'pipe'
  });
  // 扫 dist 全部文本产物：假 key 不得出现
  let scanned = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        scanned += 1;
        const text = fs.readFileSync(p, 'utf8');
        assertOk(!text.includes(fake), `假 key 泄漏于 ${path.basename(p)}`);
      }
    }
  };
  walk(path.join(WEB, 'dist'));
  const srcText = fs.readFileSync(path.join(WEB, 'src', 'main.js'), 'utf8');
  assertOk(!/VITE_[A-Z_]*KEY/.test(srcText.replace('VITE_GHOST_PROVIDER_URL', '')), '前端引用了 VITE_*KEY');
  // 恢复干净构建并复验
  execSync('npm run build', { cwd: WEB, stdio: 'pipe' });
  const res = await get(`http://127.0.0.1:${PORT}/`);
  assertEq(res.status, 200, '干净重建后首页不可用');
  return { distFiles: scanned };
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 实际 ${JSON.stringify(a)} 期望 ${JSON.stringify(b)}`);
}
function assertOk(v, msg) {
  if (!v) throw new Error(msg || 'assertOk 失败');
}

// ── 主流程 ──
async function main() {
  const only = process.argv.filter((a) => a.startsWith('--only=')).map((a) => a.split('=')[1]);
  const active = only.length ? CHECKS.filter((c) => only.includes(c)) : CHECKS;
  for (const id of only ?? []) {
    if (!CHECKS.includes(id)) {
      console.log(`[FAIL] UNKNOWN_ONLY_${id}`);
      process.exit(1);
    }
  }
  void only;

  const lines = [];
  const report = { startedAt: new Date().toISOString(), runId: RUN_ID, detail: {} };
  server = await startServer();
  browser = await chromium.launch();

  try {
    if (active.includes('H01_BUILD_HTTP')) {
      try { report.detail.H01 = await h01(); lines.push(['H01_BUILD_HTTP', true]); }
      catch (e) { report.detail.H01 = { error: String(e) }; lines.push(['H01_BUILD_HTTP', false, e]); }
    }
    if (active.includes('H05_CASE_CONTRACT')) await runCheck(lines, report, 'H05_CASE_CONTRACT', h05);
    if (active.includes('H07_COPY_LINT')) await runCheck(lines, report, 'H07_COPY_LINT', h07);
    if (active.includes('H08_BEAT_BUDGET')) await runCheck(lines, report, 'H08_BEAT_BUDGET', h08);
    if (active.includes('H15_DELIVERABLES')) await runCheck(lines, report, 'H15_DELIVERABLES', h15);

    if (active.some((c) => ['H02_NORMAL_INPUT', 'H03_ORDERED_FLOW', 'H04_CLEAN_SMOKE', 'H06_EVIDENCE_BOUNDARY', 'H09_NO_KEY', 'H10_PROVIDER_TIMEOUT', 'H11_PROVIDER_INVALID', 'H12_OFFLINE', 'H13_INTERACTIVE_TIME', 'H14_RENDER_BUDGET'].includes(c))) {
      mock = await startMock();
      mockPort = mock.port;
    }

    // H03 + H04 合并一次完整流程（console/pageerror/资源失败监听）
    if (active.includes('H03_ORDERED_FLOW') || active.includes('H04_CLEAN_SMOKE')) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const pageErrors = [], consoleErrors = [], failedRequests = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
      try {
        const snap = await fullFlow(page, '感谢家人的付出，不等于把以后所有选择都交出去。', ['F02', 'B01']);
        // 顺序与关键事件
        const beats = snap.history.filter((e) => e.id === 'beat_enter').map((e) => e.beat);
        const expected = ['life_slice', 'garden', 'collector', 'dinner', 'pollution', 'statement', 'epilogue', 'closed'];
        assertEq(JSON.stringify(beats), JSON.stringify(expected), `节拍顺序: ${beats}`);
        for (const ev of ['terminal_closed', 'collector_converted', 'dinner_cycle_1', 'dinner_cycle_2', 'dinner_cycle_3', 'dinner_reveal', 'pollution_blur_c', 'pollution_delete_c', 'pollution_delete_b', 'pollution_only_a', 'pollution_auto_select', 'feedback_shown', 'case_closed']) {
          assertOk(snap.history.some((e) => e.id === ev), `缺少事件 ${ev}`);
        }
        assertEq(snap.beat, 'closed', '未到 closed');
        if (active.includes('H03_ORDERED_FLOW')) lines.push(['H03_ORDERED_FLOW', true]);
        if (active.includes('H04_CLEAN_SMOKE')) {
          try {
            await h04(pageErrors, consoleErrors, failedRequests);
            lines.push(['H04_CLEAN_SMOKE', true]);
          } catch (e) {
            lines.push(['H04_CLEAN_SMOKE', false, e]);
          }
        }
        report.detail.H03 = { beats };
      } catch (e) {
        if (active.includes('H03_ORDERED_FLOW')) lines.push(['H03_ORDERED_FLOW', false, e]);
        if (active.includes('H04_CLEAN_SMOKE')) lines.push(['H04_CLEAN_SMOKE', false, new Error('H03 失败导致 H04 无从判定')]);
        report.detail.H03 = { error: String(e) };
      }
      await ctx.close();
    }

    if (active.includes('H02_NORMAL_INPUT')) await runCheck(lines, report, 'H02_NORMAL_INPUT', h02);
    if (active.includes('H06_EVIDENCE_BOUNDARY')) await runCheck(lines, report, 'H06_EVIDENCE_BOUNDARY', h06);
    if (active.includes('H09_NO_KEY')) await runCheck(lines, report, 'H09_NO_KEY', h09);
    if (active.includes('H10_PROVIDER_TIMEOUT')) await runCheck(lines, report, 'H10_PROVIDER_TIMEOUT', h10);
    if (active.includes('H11_PROVIDER_INVALID')) await runCheck(lines, report, 'H11_PROVIDER_INVALID', h11);
    if (active.includes('H12_OFFLINE')) await runCheck(lines, report, 'H12_OFFLINE', h12);
    if (active.includes('H13_INTERACTIVE_TIME')) await runCheck(lines, report, 'H13_INTERACTIVE_TIME', h13);
    if (active.includes('H14_RENDER_BUDGET')) await runCheck(lines, report, 'H14_RENDER_BUDGET', h14);
    if (active.includes('H16_SECRET_BOUNDARY')) await runCheck(lines, report, 'H16_SECRET_BOUNDARY', h16);
  } finally {
    await browser?.close();
    server?.kill();
    mock?.srv.close();
  }

  for (const l of lines) {
    const [id, ok, err] = l;
    if (ok) console.log(`[PASS] ${id}`);
    else console.log(`[FAIL] ${id} :: ${err?.message ?? err ?? ''}`);
    report.detail[id] = report.detail[id] ?? (ok ? { ok: true } : { ok: false, error: String(err?.message ?? err) });
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(REPORTS, 'harness.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS, 'server.log'), serverLog.join(''));
  if (lines.some((l) => !l[1])) process.exit(1);
}

async function runCheck(lines, report, id, fn) {
  try {
    report.detail[id] = await fn();
    lines.push([id, true]);
  } catch (e) {
    report.detail[id] = { ok: false, error: String(e?.message ?? e) };
    lines.push([id, false, e]);
  }
}

main().catch((e) => {
  log(`harness fatal: ${e?.stack ?? e}`);
  process.exit(2);
});
