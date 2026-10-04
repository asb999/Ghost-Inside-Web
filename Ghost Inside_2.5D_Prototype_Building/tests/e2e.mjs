import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function staticDomChecks() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const uiPath = join(root, 'src', 'ui.js');
  assert.ok(existsSync(uiPath), '缺少 src/ui.js');
  const ui = readFileSync(uiPath, 'utf8');
  const source = `${html}\n${ui}`;
  for (const testId of [
    'start-game', 'game-root', 'object-report', 'object-plate', 'object-lin',
    'view-replay', 'replay-1913', 'open-belief', 'inference-worth',
    'reconstruction-input', 'preview', 'outcome-express', 'outcome-pause',
    'confirm-reconstruction', 'move-table', 'act-express', 'move-door',
    'act-pause', 'retry-reconstruction', 'restart-game', 'confirm-restart',
    'fallback-badge',
  ]) assert.match(source, new RegExp(`data-testid=["']${testId}["']`), `缺少稳定入口 ${testId}`);
  assert.match(source, /<button\b/i, '交互应使用可聚焦的 button');
  assert.match(source, /<textarea\b/i, '自由输入应使用 textarea');
  assert.doesNotMatch(source, /onclick\s*=/i, '不要使用内联 onclick');
  console.log('[e2e] PASS 静态 DOM 最低门槛');
}

staticDomChecks();

const playwrightEntry = resolve(here, '../../game/web/node_modules/playwright/index.mjs');
let chromium;
try {
  ({ chromium } = await import(pathToFileURL(playwrightEntry).href));
} catch (error) {
  console.log(`[e2e] SKIP 浏览器流程：Playwright 无法加载（${error.message}）。`);
  console.log('[e2e] 静态 DOM 检查已通过；此 SKIP 不计作真实浏览器试玩或 AI 验证。');
  process.exit(0);
}

const { createAppServer } = await import('../server.mjs');
const server = createAppServer({ env: {} });
await new Promise((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
const url = `http://127.0.0.1:${address.port}`;

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
} catch (error) {
  await new Promise((resolveClose) => server.close(resolveClose));
  console.log(`[e2e] SKIP 浏览器流程：Chromium 无法启动（${error.message}）。`);
  console.log('[e2e] 静态 DOM 检查已通过；此 SKIP 不计作真实浏览器试玩或 AI 验证。');
  process.exit(0);
}

const click = async (page, testId) => page.getByTestId(testId).click();
const closePanel = async (page) => page.locator('[data-action="close"]').first().click();

async function reachInference(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '跳过引导' }).click();
  await click(page, 'object-report');
  await closePanel(page);
  await page.locator('.hotspot[data-id="father"]').click();
  await closePanel(page);
  await click(page, 'object-lin');
  await closePanel(page);
  await click(page, 'open-belief');
  await click(page, 'inference-worth');
  await page.getByRole('button', { name: '不能这样推出' }).click();
  await click(page, 'evidence-M01');
  await click(page, 'evidence-M03');
  await page.getByRole('button', { name: '用自己的话说' }).click();
  await page.getByTestId('reconstruction-input').fill('即使这次没有达到期待，也不能说明我不值得被爱。');
  await page.getByRole('button', { name: '确认这表达了我的意思' }).click();
  await page.getByTestId('outcome-express').waitFor({ state: 'visible' });
  await expectFallback(page);
}

async function expectFallback(page) {
  const badge = page.getByTestId('fallback-badge');
  await badge.waitFor({ state: 'visible' });
  assert.match(await badge.textContent(), /备用互动/);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await reachInference(page);

  await click(page, 'outcome-express');
  await click(page, 'preview');
  await click(page, 'confirm-reconstruction');
  await click(page, 'move-table');
  await click(page, 'act-express');
  await page.getByRole('heading', { name: '林澈把那句话说完了' }).waitFor();
  assert.match(await page.locator('.result').textContent(), /门口牵引仍在/);
  console.log('[e2e] PASS 单鼠标 A 路线：留下表达');

  await click(page, 'retry-reconstruction');
  await click(page, 'inference-worth');
  await page.getByRole('button', { name: '不能这样推出' }).click();
  await click(page, 'evidence-M01');
  await click(page, 'evidence-M03');
  await page.getByRole('button', { name: '用自己的话说' }).click();
  await page.getByTestId('reconstruction-input').fill('一次成绩不等于我的全部价值，我可以先暂停这场谈话。');
  await page.getByRole('button', { name: '确认这表达了我的意思' }).click();
  await click(page, 'outcome-pause');
  await click(page, 'preview');
  await click(page, 'confirm-reconstruction');
  await click(page, 'move-door');
  await click(page, 'act-pause');
  await page.getByRole('heading', { name: '林澈走到了门口' }).waitFor();
  assert.match(await page.locator('.result').textContent(), /桌边对话仍未完成/);
  console.log('[e2e] PASS 单鼠标 B 路线：先暂停谈话；保留证据重试成功');

  await click(page, 'restart-game');
  await click(page, 'confirm-restart');
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.getByTestId('object-report').waitFor();
  assert.equal(await page.locator('.hotspot.seen').count(), 0, '从头开始后不应保留已调查状态');
  console.log('[e2e] PASS 清空重开');

  const keyboardPage = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await keyboardPage.emulateMedia({ reducedMotion: 'reduce' });
  await keyboardPage.goto(url, { waitUntil: 'networkidle' });
  await keyboardPage.keyboard.press('Tab');
  const focusedTag = await keyboardPage.evaluate(() => document.activeElement?.tagName);
  assert.equal(focusedTag, 'BUTTON', 'Tab 后应聚焦可操作按钮');
  await keyboardPage.keyboard.press('Enter');
  const overflow = await keyboardPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `360px 窄屏出现 ${overflow}px 横向溢出`);
  const smallTargets = await keyboardPage.locator('button:visible').evaluateAll((buttons) => buttons
    .map((button) => ({ text: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
    .filter((box) => box.width < 44 || box.height < 44));
  assert.deepEqual(smallTargets, [], `存在小于 44px 的可见按钮：${JSON.stringify(smallTargets)}`);
  console.log('[e2e] PASS 键盘聚焦、360px 窄屏与 44px 点击面积');
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log('[e2e] 自动浏览器流程通过；这不等同于陌生玩家试玩，也不等同于实时 AI 验证。');

