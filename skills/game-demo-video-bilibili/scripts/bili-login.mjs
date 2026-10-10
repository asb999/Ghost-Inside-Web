// bili-login.mjs — B站投稿阶段1：打开上传页，等待扫码登录，登录后记录页面状态
import { chromium } from 'playwright';

const PROFILE = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/.bili-profile';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1380, height: 900 },
  args: ['--window-size=1400,920', '--lang=zh-CN']
});
const page = context.pages()[0] ?? await context.newPage();
await page.goto('https://member.bilibili.com/platform/upload/video/frame', { waitUntil: 'domcontentloaded', timeout: 60000 });
log('opened upload page, url:', page.url());

// 若跳到登录页，等待扫码（最长 5 分钟）；需连续 2 次检测都在会员域才算登录成功
const tEnd = Date.now() + 300000;
let stable = 0;
while (Date.now() < tEnd) {
  const url = page.url();
  if (/passport\.bilibili\.com|login/.test(url)) {
    stable = 0;
    log('waiting for QR login... (请在弹出的窗口中用B站App扫码)');
    await page.waitForTimeout(6000);
    continue;
  }
  stable += 1;
  log('on member page, stable', stable, '-', url);
  if (stable >= 2) break;
  await page.waitForTimeout(4000);
}
if (stable < 2) throw new Error('login timeout');
log('final url:', page.url());
await page.waitForTimeout(5000);
// 抓取页面关键文本供下一步判断
const state = await page.evaluate(() => {
  const t = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200);
  const inputs = [...document.querySelectorAll('input[type=file]')].map((i) => ({ accept: i.accept, name: i.name }));
  return { url: location.href, title: document.title, inputs, text: t };
});
console.log(JSON.stringify(state, null, 2));
// 登录态 cookie 持久化在 profile；不关闭浏览器直到用户确认？——为保持登录，直接关闭由 profile 保存 cookie
await context.close();
log('done (profile saved)');
