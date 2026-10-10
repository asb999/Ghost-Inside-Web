// bili-edit-cover.mjs — 编辑已发布稿件的封面为官方主视觉
import { chromium } from 'playwright';

const PROFILE = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/.bili-profile';
const COVER = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/01_封面_1920x1080.png';
const BV = 'BV1VjpP6tEZ2';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1380, height: 900 },
  args: ['--window-size=1400,920', '--lang=zh-CN']
});
let page = context.pages()[0] ?? await context.newPage();

// ── 1. 首页 → 内容管理（统一稿件管理）→ 找到稿件行 ──
await page.goto('https://member.bilibili.com/platform/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(6000);
const nav = page.locator('a, div, li, span').filter({ hasText: /^内容管理$/ }).first();
await nav.click({ force: true });
log('clicked 内容管理');
await sleep(9000);
log('list url:', page.url());

const row = page.locator('.article-card').filter({ hasText: 'Ghost Inside·心灵调理师' }).first();
if (!(await row.isVisible().catch(() => false))) throw new Error('list card not found');
await row.hover().catch(() => {});
await sleep(1500);
const rowHtml = await row.evaluate((e) => e.innerHTML.replace(/\s+/g, ' ').slice(0, 700));
log('card html:', rowHtml);

// 编辑可能开新标签页
const editPagePromise = context.waitForEvent('page', { timeout: 12000 }).catch(() => null);
let clickedEdit = false;
for (const t of ['编辑稿件', '编辑']) {
  const b = row.getByText(t, { exact: false }).first();
  if (await b.isVisible().catch(() => false)) { await b.click({ force: true }); clickedEdit = true; log('clicked:', t); break; }
}
if (!clickedEdit) {
  // 兜底：直接走编辑路由（SPA 内部导航）
  log('no edit action found, trying SPA edit route');
  await page.evaluate((bv) => {
    const a = document.createElement('a');
    a.href = '/platform/upload/video/edit?bvid=' + bv;
    document.body.appendChild(a);
    a.click();
  }, BV);
}

let editPage = await editPagePromise;
if (editPage) { log('editor opened in new tab'); page = editPage; await page.waitForLoadState('domcontentloaded'); }
await sleep(10000);
log('editor url:', page.url());

// ── 2. 封面小部件：定位 → hover → 点“更换” ──
const coverWidget = await page.evaluate(() => {
  const label = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === '封面');
  if (!label) return { found: false };
  let row = label.parentElement;
  for (let i = 0; i < 5 && row; i++) { if (/cover/i.test(String(row.className))) break; row = row.parentElement; }
  return { found: true, rowClass: String(row?.className || ''), html: (row?.outerHTML || '').replace(/\s+/g, ' ').slice(0, 500) };
});
log('cover widget:', JSON.stringify(coverWidget));

// 悬停封面图 → 浮层“封面设置”显现 → 点击
let coverSet = false;
{
  const img = page.locator('.cover .cover-img').first();
  const entry = page.locator('.cover .edit-text').first();
  if (await img.isVisible().catch(() => false)) {
    await img.scrollIntoViewIfNeeded().catch(() => {});
    await img.hover().catch(() => {});
    await sleep(1500);
    log('after hover, edit-text visible:', await entry.isVisible().catch(() => false));
  }
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 7000 }).catch(() => null),
    (await entry.isVisible().catch(() => false) ? entry.click({ force: true })
      : (await img.isVisible().catch(() => false) ? img.click({ force: true }) : Promise.resolve()))
  ]);
  if (chooser) {
    await chooser.setFiles(COVER); coverSet = true; log('cover set via filechooser');
    await sleep(5000);
  }
}
// 路径B：封面制作对话框内上传（放宽选择器 + 上传区兜底）
if (!coverSet) {
  try {
    log('dialog open, waiting for file input...');
    const foundInput = await page.waitForSelector('input[type=file]', { timeout: 20000 }).then(() => true).catch(() => false);
    const inputsDump = await page.evaluate(() => [...document.querySelectorAll('input[type=file]')].map((i) => ({
      accept: i.accept || '(none)', cls: String(i.className).slice(0, 30),
      parentCls: String(i.parentElement?.className || '').slice(0, 40)
    })));
    log('file inputs:', JSON.stringify(inputsDump));
    if (foundInput) {
      // 选 accept 含 image 的；否则选挂在弹层/对话框里的
      const candidates = page.locator('input[type=file][accept*="image"]');
      const target = (await candidates.count()) ? candidates.first() : page.locator('input[type=file]').last();
      await target.setInputFiles(COVER);
      coverSet = true; log('keyart attached in dialog');
    } else {
      // 点击“上传封面”区域触发 filechooser
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }),
        page.getByText('上传封面', { exact: false }).last().click({ force: true })
      ]);
      await chooser.setFiles(COVER);
      coverSet = true; log('keyart attached via filechooser after zone click');
    }
    // 等图片上传到B站服务器完成（12s），再点完成
    await sleep(12000);
    await page.screenshot({ path: 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/_cover_dialog2.png' });
    const clickDone = async () => {
      // 1) button 元素
      const btn = page.locator('button:visible').filter({ hasText: '完成' }).last();
      if (await btn.isVisible().catch(() => false)) { await btn.click({ force: true }); return 'button'; }
      // 2) 文本元素 + 真实坐标点击
      const t = page.getByText('完成', { exact: true }).last();
      if (await t.isVisible().catch(() => false)) {
        const box = await t.boundingBox();
        if (box) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); return `coords(${Math.round(box.x)},${Math.round(box.y)})`; }
        await t.click({ force: true }); return 'text-force';
      }
      return 'not-found';
    };
    for (let attempt = 1; attempt <= 4 && coverSet; attempt++) {
      const how = await clickDone();
      await sleep(8000);
      const dialogGone = await page.evaluate(() => !/封面制作/.test(document.body.innerText || ''));
      log(`attempt ${attempt} via ${how}: dialog gone = ${dialogGone}`);
      if (dialogGone) break;
    }
    await sleep(1500);
  } catch (e) { log('dialog flow FAILED:', String(e).slice(0, 150)); }
}
if (!coverSet) {
  const st = await page.evaluate(() => ({ url: location.href, coverText: (document.querySelector('.cover')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200) }));
  console.log('COVER NOT SET:', JSON.stringify(st, null, 2));
  await page.screenshot({ path: 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/_edit_debug.png' });
  await context.close(); throw new Error('cover not set');
}
await sleep(2000);

// ── 5. 保存稿件（编辑页的提交按钮）──
let saved = false;
for (const sel of ['button:has-text("保存修改")', 'button:has-text("立即投稿")']) {
  const b = page.locator(sel).last();
  if (await b.isVisible().catch(() => false)) {
    await b.scrollIntoViewIfNeeded().catch(() => {});
    await b.click({ force: true });
    log('save clicked via:', sel); saved = true;
    break;
  }
}
if (!saved) {
  // 文本兜底（上传页曾用此法成功）
  const t = page.getByText('立即投稿', { exact: true }).last();
  if (await t.isVisible().catch(() => false)) { await t.click({ force: true }); saved = true; log('save clicked via text 立即投稿'); }
}
if (!saved) log('no save button matched — 检查截图');
await sleep(9000);
for (const t of ['确认', '确定']) {
  try {
    const b = page.locator(`button:has-text("${t}")`).last();
    if (await b.isVisible().catch(() => false)) { await b.click({ force: true }); log('confirm dialog:', t); await sleep(4000); }
  } catch {}
}
const post = await page.evaluate(() => ({ url: location.href, text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500) }));
console.log('AFTER SAVE:', JSON.stringify(post, null, 2));
await page.screenshot({ path: 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/_after_save.png' });

// ── 6. 用 member 接口核验封面 URL ──
await page.goto('https://member.bilibili.com/platform/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(6000);
const check = await page.evaluate(async (bv) => {
  const r = await fetch('https://member.bilibili.com/x/web/archives?status=all&pn=1&ps=20', { credentials: 'include' });
  const j = await r.json();
  const all = [...(j.data?.arc_audits || []), ...(j.data?.archives || [])].map((a) => a.Archive || a.archive || a);
  const mine = all.find((a) => a.bvid === bv);
  return mine ? { bvid: mine.bvid, title: (mine.title || '').slice(0, 40), pic: mine.pic || mine.cover || '(no field)' } : null;
}, BV);
console.log('VERIFY:', JSON.stringify(check, null, 2));
if (check?.pic) log('cover url:', check.pic);
await context.close();
log('done');
