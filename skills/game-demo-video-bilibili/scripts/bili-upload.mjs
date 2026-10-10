// bili-upload3.mjs — B站投稿（v3）：修简介、封面对话框内上传官方主视觉并截图验证、立即投稿
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const PROFILE = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/.bili-profile';
const VIDEO = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/walkthrough_解说版.mp4';
const COVER = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/01_封面_1920x1080.png';
const TITLE = '《Ghost Inside·心灵调理师》第一关《留一个位置》通关解说 | Tripothon 参赛 Demo';
const DESC = `2077年，算法替人类管理情绪、规划人生。你是心灵调理师，接入来访者林澈的记忆现场：替家人拿起三件事，身体越来越重，跳不过那道断层；把责任放回原处，也把被压住的自己找回来，再跳一次。
调查记忆 → 破解信念 → 重构记忆。
在线试玩：https://asb999.github.io/Ghost-Inside-Web/
开源仓库：https://github.com/asb999/Ghost-Inside-Web
3D角色由 Tripo 生成 · Tripothon 参赛作品`;
const TAGS = ['独立游戏', '剧情游戏', '解谜', 'AI', '心理', '3D', 'Tripo'];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1380, height: 900 },
  args: ['--window-size=1400,920', '--lang=zh-CN']
});
const page = context.pages()[0] ?? await context.newPage();
await page.goto('https://member.bilibili.com/platform/upload/video/frame', { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(4000);
if (/passport\.bilibili\.com/.test(page.url())) throw new Error('未登录！请先运行 bili-login.mjs');
for (const t of ['知道了', '我知道了']) {
  try { const b = page.getByText(t, { exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); await sleep(800); } } catch {}
}

// ── 1. 视频上传 ──
await page.locator('input[type=file]').first().setInputFiles(VIDEO);
log('video attached');
const tUp = Date.now() + 300000;
while (Date.now() < tUp) {
  const txt = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
  if (/上传完成/.test(txt)) { log('upload complete'); break; }
  if (/上传失败/.test(txt)) throw new Error('upload failed');
  await sleep(5000);
}
await sleep(3000);

// ── 2. 标题 + 简介（带自检）──
const filled = await page.evaluate(({ TITLE, DESC }) => {
  const fire = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const out = { title: false, desc: false, candidates: [] };
  const titleEl = document.querySelector('textarea[placeholder*="标题"], input[placeholder*="标题"]');
  if (titleEl) { titleEl.focus(); titleEl.value = TITLE; fire(titleEl); out.title = true; }
  const cands = [...document.querySelectorAll('textarea, div[contenteditable="true"], input[type="text"]')]
    .filter((e) => e !== titleEl)
    .map((e) => ({ tag: e.tagName, ph: e.placeholder || '', h: e.clientHeight, vis: !!e.offsetParent, cls: (e.className || '').slice(0, 40) }));
  out.candidates = cands.filter((c) => c.vis);
  const descEl = cands
    .map((c, i) => ({ c, el: [...document.querySelectorAll('textarea, div[contenteditable="true"]')].filter((e) => e !== titleEl)[i] }))
    .filter((x) => x.c.vis && x.c.h > 30)
    .map((x) => x.el)[0];
  if (descEl) {
    descEl.focus();
    if (descEl.tagName === 'TEXTAREA') { descEl.value = DESC; fire(descEl); }
    else { descEl.innerText = DESC; fire(descEl); }
    out.desc = true;
  }
  return out;
}, { TITLE, DESC });
log('fill:', JSON.stringify({ title: filled.title, desc: filled.desc }));
log('desc candidates:', JSON.stringify(filled.candidates));
await sleep(1000);

// ── 3. 标签 ──
for (const tag of TAGS) {
  try {
    const handle = await page.evaluateHandle(() => [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('回车')));
    const el = handle.asElement();
    if (!el) break;
    await el.fill(tag);
    await el.press('Enter');
    await sleep(500);
    log('tag:', tag);
  } catch (e) { log('tag FAILED:', tag); }
}

// ── 4. 封面：官方主视觉，对话框内上传 + 截图验证 ──
try {
  const addCover = page.getByText('添加封面', { exact: false }).first();
  await addCover.scrollIntoViewIfNeeded();
  await addCover.click();
  await sleep(2500);
  // 对话框内的图片上传入口（第二个 file input，accept 含 image）
  const imgInputs = page.locator('input[type=file][accept*="image"]');
  const n = await imgInputs.count();
  log('image inputs in dialog:', n);
  if (n > 0) {
    await imgInputs.first().setInputFiles(COVER);
    log('official keyart attached to cover dialog');
    await sleep(4500);
    await page.screenshot({ path: 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/_cover_dialog.png' });
    log('cover dialog screenshot saved for verification');
  } else {
    log('NO image input found in cover dialog!');
    await page.screenshot({ path: 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/_cover_dialog.png' });
  }
  // 点“完成”确认封面（对话框底部）
  for (const t of ['完成', '确 定', '确认']) {
    const b = page.getByText(t, { exact: true }).last();
    if (await b.isVisible().catch(() => false)) { await b.click(); log('cover confirmed with:', t); break; }
    await sleep(800);
  }
  await sleep(2000);
} catch (e) { log('cover FAILED:', String(e).slice(0, 150)); }

// ── 5. 创作声明：选“含AI生成内容”（平台新规，AI素材须声明）──
try {
  await page.keyboard.press('Escape'); await sleep(600);
  const declInput = page.locator('input[placeholder*="创作声明"]').first();
  await declInput.scrollIntoViewIfNeeded();
  await declInput.click({ force: true });
  await sleep(1200);
  const opt = page.getByText('含AI生成内容', { exact: true }).first();
  await opt.click({ force: true, timeout: 8000 });
  log('声明: 含AI生成内容 ✓');
  await sleep(800);
} catch (e) { log('声明 FAILED:', String(e).slice(0, 120)); }

// ── 6. 立即投稿（限定可见 button 元素）──
let clicked = false;
try {
  const btn = page.locator('button:visible').filter({ hasText: '立即投稿' }).last();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ force: true, timeout: 15000 });
  clicked = true; log('立即投稿 button force-clicked');
} catch (e) { log('button click FAILED:', String(e).slice(0, 120)); }
if (!clicked) {
  try {
    const btn2 = page.getByText('立即投稿', { exact: true }).last();
    await btn2.click({ force: true, timeout: 10000 });
    clicked = true; log('立即投稿 text force-clicked');
  } catch (e) { log('text click FAILED:', String(e).slice(0, 120)); }
}
await sleep(9000);
await page.screenshot({ path: 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/_submit_result.png' });
for (const t of ['确认', '确定']) {
  try {
    const b = page.locator('button:visible').filter({ hasText: t }).last();
    if (await b.isVisible().catch(() => false)) { await b.click({ force: true }); log('confirm:', t); await sleep(4000); }
  } catch {}
}
await sleep(5000);
const post = await page.evaluate(() => ({ url: location.href, text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700) }));
console.log('POST-CLICK:', JSON.stringify(post, null, 2));

// ── 6. 抓 BV（限定本稿件行）──
let bv = null;
try {
  await page.goto('https://member.bilibili.com/platform/content/video', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(9000);
  bv = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr, li, [class*="item"]')].filter((e) => /walkthrough|Ghost Inside|心灵调理师/.test(e.textContent || ''));
    for (const r of rows) {
      const m = (r.innerHTML || '').match(/(BV[0-9A-Za-z]{10})/);
      if (m) return m[1];
    }
    return null;
  });
} catch (e) { log('BV err:', String(e).slice(0, 100)); }

if (bv) {
  writeFileSync('E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/bili_url.txt', `https://www.bilibili.com/video/${bv}\n`);
  log('BV LINK:', `https://www.bilibili.com/video/${bv}`);
} else log('BV not found — 请到稿件管理确认');
await context.close();
log('done');
