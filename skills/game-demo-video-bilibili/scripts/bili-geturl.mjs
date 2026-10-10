import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const PROFILE = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/.bili-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const context = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1380, height: 900 } });
const page = context.pages()[0] ?? await context.newPage();
await page.goto('https://member.bilibili.com/platform/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(6000);
const found = await page.evaluate(async () => {
  const r = await fetch('https://member.bilibili.com/x/web/archives?status=all&pn=1&ps=20', { credentials: 'include' });
  const j = await r.json();
  const flat = (a) => ({ ...(a.Archive || a.archive || a), _where: '' });
  const all = [
    ...(j.data?.arc_audits || []).map((a) => ({ ...flat(a), _where: 'audits' })),
    ...(j.data?.archives || []).map((a) => ({ ...flat(a), _where: 'archives' }))
  ];
  return all.map((a) => ({ where: a._where, bvid: a.bvid, title: a.title, state: a.state_desc || a.state || '' }));
});
for (const f of found) console.log(`[${f.where}] ${f.bvid} | ${(f.title || "").slice(0, 46)} | ${f.state}`);
const ours = found.find((f) => /Ghost|心灵调理师|walkthrough/i.test(f.title));
if (ours) {
  writeFileSync('E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission/bili_url.txt', `https://www.bilibili.com/video/${ours.bvid}\n`);
  console.log('OUR VIDEO BV:', `https://www.bilibili.com/video/${ours.bvid}`);
} else console.log('NOT FOUND in member API');
await context.close();
