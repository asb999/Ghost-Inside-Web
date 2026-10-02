// check-variation.mjs — P0 行为检查（独立于 17 项门禁，H00 仍恰好 17 行 PASS）：
//   GARDEN_VARIATION  三阶段变奏（一阶段无惩罚 / 二阶段单一新条件 / 三阶段组合）
//   GHOST_AND_GATE    协作门：缺玩家或缺 Ghost 均不可完成；窗口耗尽即解除；只完成一次
//   LOCAL_RETRY       连续失败 10 次仍可完成；不重复奖励/污染；不倒退叙事状态
// 用法：node .astra/harness/check-variation.mjs [--only=GARDEN_VARIATION]
import { spawn } from 'node:child_process';
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
const RUN_ID = `v${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const CHECKS = [
  'GARDEN_VARIATION', 'GHOST_AND_GATE', 'LOCAL_RETRY'
].filter((id) => !ONLY || id === ONLY);

const serverLog = [];
let server = null;
let browser = null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function assertOk(cond, msg) { if (!cond) throw new Error(msg); }

async function startServer() {
  const child = spawn(process.execPath, [path.join(WEB, 'scripts', 'start.mjs')], {
    cwd: WEB,
    env: { ...process.env, GHOST_PORT: String(PORT), GHOST_HARNESS_RUN_ID: RUN_ID },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => serverLog.push(String(d)));
  child.stderr.on('data', (d) => serverLog.push(String(d)));
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const ready = serverLog.join('').split('\n').some((l) => {
      try { const j = JSON.parse(l); return j.type === 'ghost-ready' && j.runId === RUN_ID; }
      catch { return false; }
    });
    if (ready) return child;
    if (child.exitCode !== null) throw new Error(`server exited: ${serverLog.join('').slice(-800)}`);
    await sleep(150);
  }
  child.kill();
  throw new Error('server start timeout 60s');
}

// ── 驱动（只组合正式输入）──
async function snap(page) {
  return page.evaluate(() => window.__game.snapshot());
}
async function step(page, ms) {
  await page.evaluate((m) => window.__game.stepSimulation(m), ms);
}
async function tap(page, action, simMs = 100) {
  await page.evaluate(([a, m]) => {
    window.__game.input(a, true);
    window.__game.stepSimulation(m);
    window.__game.input(a, false);
  }, [action, simMs]);
}

async function startCase(page) {
  await page.goto(`http://127.0.0.1:${PORT}/?test=1`);
  await page.locator('#btn-start').click();
  for (let i = 0; i < 8; i++) {
    const btn = page.locator('[data-action="opening-next"]');
    if ((await btn.count()) === 0) break;
    await btn.first().click();
    await sleep(60);
  }
  assertOk((await snap(page)).beat === 'garden', '未进入花园节拍');
}

// 跳跃越过障碍与赞许弹幕（一阶段障碍 24 无惩罚，不需跳）
const LETHAL_Z = [44, 50, 58, 84];

// 前进到 z >= targetZ；until 为可选附加条件（z 条件满足后仍须 until() 为真才停）
async function driveTo(page, targetZ) {
  for (let i = 0; i < 400; i++) {
    const s = await snap(page);
    assertOk(s.beat === 'garden', `花园中节拍变为 ${s.beat}`);
    const jumpZ = LETHAL_Z.find((z) => z > s.player.z - 0.4 && z < targetZ);
    if (jumpZ !== undefined && jumpZ - s.player.z < 3.0 && s.player.y <= 1.01) {
      await tap(page, 'jump', 400);
      continue;
    }
    if (s.player.z >= targetZ) return s;
    await step(page, 300);
  }
  throw new Error(`400 轮未到 z=${targetZ}`);
}

// 完成协作门并进入收集者
async function completeGate(page) {
  for (let i = 0; i < 60; i++) {
    const s = await snap(page);
    if (s.beat === 'collector') return;
    assertOk(s.beat === 'garden', `协作门阶段节拍变为 ${s.beat}`);
    const sc = s.scene;
    if (!sc.clueObserved) {
      if (!sc.cluePinned) await tap(page, 'support');
      else await tap(page, 'interact');
      continue;
    }
    await page.evaluate(() => {
      window.__game.input('interact', true);
      window.__game.stepSimulation(200);
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      window.__game.input('interact', false);
      window.__game.stepSimulation(100);
    });
  }
  throw new Error('协作门未完成');
}

// ── 检查 ──
async function gardenVariation(page) {
  await startCase(page);

  // 一阶段：直行穿过障碍 24，无操作失败惩罚
  let s = await driveTo(page, 33);
  const h = s.history;
  assertOk(!h.some((e) => e.id === 'garden_respawn' && e.hitZ < 32), '一阶段出现操作失败惩罚');
  assertOk(h.some((e) => e.id === 'garden_stage' && e.stage === 1), '缺一阶段进入事件');

  // 二阶段：唯一新条件=赞许弹幕；等弹幕墙开启期贴地穿过 → 局部重置。
  // 穿越相位由累计模拟时间决定：错过窗口会撞 58 障碍重置回 36，用步长抖动重试直至命中
  s = await driveTo(page, 48.2);
  const respawnBefore = s.history.filter((e) => e.id === 'garden_respawn').length;
  let waveHit = null;
  for (let i = 0; i < 300 && !waveHit; i++) {
    await step(page, 150 + (i % 7) * 25);
    s = await snap(page);
    const rs = s.history.filter((e) => e.id === 'garden_respawn');
    if (rs.length > respawnBefore) { waveHit = rs.pop(); break; }
    if (s.player.z > 56) await driveTo(page, 48.2);
  }
  assertOk(waveHit && waveHit.reason === 'wave', `未吃到赞许弹幕: ${JSON.stringify(waveHit)}`);
  assertOk(s.player.z <= 37, '弹幕命中未局部重置到检查点');

  // 跳过余下挑战进入三阶段（组合条件），完成全程
  s = await driveTo(page, 91);
  const stageEvents = s.history.filter((e) => e.id === 'garden_stage').map((e) => e.stage);
  assertOk(JSON.stringify(stageEvents) === '[1,2,3]', `阶段事件应为 [1,2,3]: ${JSON.stringify(stageEvents)}`);
  await completeGate(page);
  s = await snap(page);
  assertOk(s.beat === 'collector', '完成后未进入原有下一节拍 collector');
  return { stages: '[1,2,3]', waveRespawn: true, nextBeat: s.beat };
}

async function ghostAndGate(page) {
  await startCase(page);
  await driveTo(page, 91);

  // (a) 仅玩家：无 Ghost 固定 → 观察不成立，终端只给提示不关闭
  await tap(page, 'interact');
  await driveTo(page, 94.5);
  await tap(page, 'interact');
  let s = await snap(page);
  assertOk(!s.history.some((e) => e.id === 'clue_observed'), '无 Ghost 支援竟然完成观察');
  assertOk(s.history.some((e) => e.id === 'terminal_blocked'), '未观察时终端未给出阻断提示');
  assertOk(!s.history.some((e) => e.id === 'terminal_closed'), '缺 Ghost 支援竟能关闭终端');

  // (b) 仅 Ghost：固定后玩家不动作 → 窗口耗尽解除（取消路径），仍不可完成
  // （advanceTestClock 单次调用上限 1000ms，需分块推进）
  await tap(page, 'support');
  s = await snap(page);
  assertOk(s.scene.cluePinned, 'Ghost 固定未生效');
  for (let i = 0; i < 4; i++) await step(page, 1000);
  s = await snap(page);
  assertOk(!s.scene.cluePinned, '窗口耗尽后保持未解除');
  assertOk(s.history.some((e) => e.id === 'ghost_pin_expired'), '缺 ghost_pin_expired 事件');
  assertOk(!s.history.some((e) => e.id === 'clue_observed'), '窗口外竟能观察');

  // (c) 双方配合：固定 → 观察 → 关闭，恰好一次
  await tap(page, 'support');
  await tap(page, 'interact');
  s = await snap(page);
  assertOk(s.scene.clueObserved, '双方配合未完成观察');
  await tap(page, 'interact', 200);
  await page.waitForTimeout(700);
  s = await snap(page);
  assertOk(s.history.filter((e) => e.id === 'terminal_closed').length === 1, 'terminal_closed 不是恰好一次');
  assertOk(s.beat === 'collector', '协作完成后未进入 collector');
  // 表态状态不被代写：全程无表态提交
  assertOk(!s.history.some((e) => e.id.startsWith('statement')), '协作门不得写入表态状态');
  return { onlyPlayerBlocked: true, pinExpiry: true, completedOnce: true };
}

async function localRetry(page) {
  await startCase(page);
  await driveTo(page, 34);

  // 连续失败 10 次：不跳，反复撞二阶段障碍 44 → 每次回到检查点 36
  for (let i = 0; i < 200; i++) {
    const s = await snap(page);
    if (s.history.filter((e) => e.id === 'garden_respawn').length >= 10) break;
    await step(page, 300);
  }
  let s = await snap(page);
  const respawns = s.history.filter((e) => e.id === 'garden_respawn');
  assertOk(respawns.length >= 10, `连续失败次数不足: ${respawns.length}`);
  assertOk(respawns.every((e) => e.reason === 'obstacle' && e.z <= 36), '重试未恢复到挑战起点（应 ≤36，恢复 <3 秒）');
  // 不重复奖励/污染：花园内无污染写入，阶段事件不因重试重复
  assertOk(!s.history.some((e) => e.id.startsWith('PE')), '花园重试不应写入污染事件');
  const stage2Count = s.history.filter((e) => e.id === 'garden_stage' && e.stage === 2).length;
  assertOk(stage2Count === 1, `二阶段进入事件重复: ${stage2Count}`);

  // 第 11 次尝试成功 → 完成全程，叙事状态无倒退（从检查点跳过全部挑战到协作门）
  await driveTo(page, 91);
  await completeGate(page);
  s = await snap(page);
  assertOk(s.beat === 'collector', '重试后未完成全程');
  assertOk(s.history.filter((e) => e.id === 'terminal_closed').length === 1, 'terminal_closed 重复');
  assertOk(!s.history.some((e) => e.id.startsWith('PE')), '全程不应提前出现污染事件');
  return { respawns: respawns.length, completed: true };
}

// ── 主流程 ──
const lines = [];
let failed = false;
try {
  server = await startServer();
  browser = await chromium.launch();
  for (const id of CHECKS) {
    const page = await browser.newPage();
    try {
      const detail = await ({ GARDEN_VARIATION: gardenVariation, GHOST_AND_GATE: ghostAndGate, LOCAL_RETRY: localRetry })[id](page);
      lines.push([id, true, detail]);
      console.log(`[PASS] ${id}`);
    } catch (e) {
      failed = true;
      lines.push([id, false, String(e)]);
      console.log(`[FAIL] ${id}`);
      console.error(String(e.stack || e));
    }
    await page.close();
  }
} finally {
  await browser?.close();
  server?.kill();
}

fs.writeFileSync(path.join(REPORTS, `variation-${RUN_ID}.json`), JSON.stringify({
  runId: RUN_ID, finishedAt: new Date().toISOString(), lines
}, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
