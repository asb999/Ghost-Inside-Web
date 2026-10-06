import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = path.join(ROOT, 'game', 'web');
const OUT = path.join(ROOT, '.astra', 'artifacts', 'leave-a-place');
const REPORTS = path.join(ROOT, '.astra', 'reports');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(REPORTS, { recursive: true });
const require = createRequire(path.join(WEB, 'package.json'));
const { chromium } = require('@playwright/test');
const PORT = 4179, checks = [];
const pass = (id, detail = '') => { checks.push({ id, ok: true, detail }); console.log(`[PASS] ${id}${detail ? ` :: ${detail}` : ''}`); };
const fail = (id, e) => { checks.push({ id, ok: false, error: String(e?.message ?? e) }); console.log(`[FAIL] ${id} :: ${e?.message ?? e}`); };
const assert = (v, m) => { if (!v) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const log = [];
  const child = spawn(process.execPath, [path.join(WEB, 'scripts', 'start.mjs')], { cwd: WEB, env: { ...process.env, GHOST_PORT: String(PORT), GHOST_HARNESS_RUN_ID: 'leave-a-place' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => log.push(String(d))); child.stderr.on('data', (d) => log.push(String(d)));
  for (let i = 0; i < 400; i++) { if (log.join('').includes('ghost-ready')) return { child, log }; if (child.exitCode !== null) throw new Error(log.join('').slice(-1200)); await sleep(100); }
  child.kill(); throw new Error('server timeout');
}

const snap = (page) => page.evaluate(() => window.__game.snapshot());
const step = (page, ms) => page.evaluate((n) => window.__game.stepSimulation(n), ms);
async function press(page, action, ms = 80) {
  await page.evaluate(([a, n]) => { window.__game.input(a, true); window.__game.stepSimulation(n); window.__game.input(a, false); window.__game.stepSimulation(34); }, [action, ms]);
}
async function moveTo(page, x, z, tolerance = .28) {
  for (let i = 0; i < 900; i++) {
    const p = (await snap(page)).scene.player;
    if (Math.abs(p.x - x) <= tolerance && Math.abs(p.z - z) <= tolerance) return;
    const actions = [];
    if (p.x < x - tolerance) actions.push('left'); else if (p.x > x + tolerance) actions.push('right');
    if (p.z < z - tolerance) actions.push('forward'); else if (p.z > z + tolerance) actions.push('back');
    // 接近目标时改用短步进：固定 50ms 的位移可能大于 2×容差，造成永久震荡
    const ms = Math.abs(p.x - x) <= .6 && Math.abs(p.z - z) <= .6 ? 18 : 50;
    await page.evaluate(({ actions: aa, ms: n }) => { aa.forEach((a) => window.__game.input(a, true)); window.__game.stepSimulation(n); aa.forEach((a) => window.__game.input(a, false)); }, { actions, ms });
  }
  throw new Error(`move timeout ${x},${z}`);
}
async function interact(page, id) {
  const s = await snap(page); const target = s.scene.activeInteractables.find((v) => v.id === id);
  assert(target, `找不到互动点 ${id} / ${s.phase}`); await moveTo(page, target.x, target.z); await press(page, 'interact');
}
async function attemptGap(page, expectedPhase) {
  const gap = (await snap(page)).scene.gap;
  await moveTo(page, 0, gap.startZ - .45, .12);
  await page.evaluate(() => { window.__game.input('forward', true); window.__game.input('jump', true); });
  for (let i = 0; i < 90; i++) { await step(page, 50); if ((await snap(page)).phase === expectedPhase) break; }
  await page.evaluate(() => { window.__game.input('forward', false); window.__game.input('jump', false); });
  await step(page, 1100); const s = await snap(page);
  assert(s.phase === expectedPhase, `断层结果错误，期望 ${expectedPhase}，实际 ${s.phase}，位置 ${JSON.stringify(s.scene.player)}，落地=${s.scene.playerGrounded}`); return s;
}

async function jumpForward(page, startZ, x = null) {
  const p = (await snap(page)).scene.player;
  await moveTo(page, x ?? p.x, startZ, .14);
  await page.evaluate(() => { window.__game.input('forward', true); window.__game.input('jump', true); });
  await step(page, 700);
  await page.evaluate(() => { window.__game.input('jump', false); window.__game.input('forward', false); });
  await step(page, 420);
  await step(page, 260);
}

async function traverseCourse(page) {
  const course = (await snap(page)).scene.course;
  assert(course.microGaps.length === 3 && course.active, '跑酷路线未开启');
  await jumpForward(page, course.microGaps[0].startZ - .45, 0);
  await jumpForward(page, 33.5, 0);
  await jumpForward(page, course.microGaps[1].startZ - .45, 0);
  await moveTo(page, 0, 47.5, .2);
  await jumpForward(page, course.microGaps[2].startZ - .45, 0);
  const after = await snap(page);
  assert(after.scene.player.z > course.microGaps[2].endZ && after.scene.playerGrounded, `没有完成跑酷路线：${JSON.stringify(after.scene.player)}`);
}

async function run() {
  let server, browser;
  try {
    execSync('npm run build', { cwd: WEB, stdio: 'pipe' }); pass('BUILD_CLEAN');
    server = await startServer(); browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${e}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text()}`); }); page.on('requestfailed', (r) => errors.push(`request ${r.url()} ${r.failure()?.errorText}`));
    let releaseModels;
    const modelsAllowed = new Promise((resolve) => { releaseModels = resolve; });
    await page.route('**/*.glb', async (route) => { await modelsAllowed; await route.continue(); });
    await page.goto(`http://127.0.0.1:${PORT}/?test=1`);
    let s = await snap(page); eq(s.phase, 'INTRO', '整体开始页不应提前开始关卡'); assert(s.scene === null, '整体开始页不应建立 3D 关卡');
    await page.locator('#btn-game-start').waitFor({ state: 'visible' }); await page.screenshot({ path: path.join(OUT, '00-game-start.png') });
    await page.locator('#btn-game-start').click(); s = await snap(page); eq(s.phase, 'INTRO', '章节页不应提前开始关卡'); assert(s.scene === null, '章节页不应建立 3D 关卡');
    await page.locator('#btn-start').click();
    s = await snap(page); eq(s.phase, 'TUTORIAL', '开始阶段');
    assert(!s.scene.character.fallbackVisible, '模型加载过程中不应显示胶囊占位角色');
    assert(await page.locator('[data-story="chapter-intro"]').isVisible(), '角色加载时章节遮罩应继续显示');
    eq(await page.locator('#btn-start').textContent(), '角色载入中…', '加载提示缺失');
    releaseModels();
    await step(page, 1000);
    await page.waitForFunction(() => {
      const scene = window.__game?.snapshot?.().scene;
      return scene && (scene.ghostAssetLoaded || scene.ghostAssetFailed) && (scene.character?.assetLoaded || scene.character?.assetFailed);
    }, null, { timeout: 30000 });
    await step(page, 50);
    s = await snap(page);
    assert(s.scene.ghostAssetLoaded && !s.scene.ghostAssetFailed, 'Ghost GLB 加载失败');
    assert(s.scene.character.assetLoaded && !s.scene.character.assetFailed, '林澈正式模型加载失败');
    assert(!s.scene.character.fallbackVisible, '正式模型加载后仍显示占位角色');
    assert(s.scene.character.skinnedMeshCount >= 1 && s.scene.character.boneCount >= 15, `角色绑骨异常：${JSON.stringify(s.scene.character)}`);
    assert(s.scene.character.modelBoxHeight > 1.5 && s.scene.character.modelBoxHeight < 2.2, `角色比例异常：${s.scene.character.modelBoxHeight}`);
    assert(s.scene.ghostToCharacterRatio >= .55 && s.scene.ghostToCharacterRatio <= .60, `Ghost/林澈比例异常：${s.scene.ghostToCharacterRatio}`);
    assert(await page.locator('[data-story="chapter-intro"]').count() === 0, '正式角色加载完成后章节遮罩没有关闭');
    const characterSource = fs.readFileSync(path.join(WEB, 'src', 'game', 'character-visual.js'), 'utf8');
    assert(characterSource.includes('this.fallback.visible = false') && characterSource.includes('this.fallback.visible = true'), '备用角色必须仅在加载失败后显示');
    assert(s.scene.character.triangleCount <= 80000 && s.scene.character.drawCalls <= 20, '角色复杂度超出网页预算');
    assert(s.scene.character.animatedBones.length >= 10 && s.scene.character.animatedBones.includes('leftUpLeg') && s.scene.character.animatedBones.includes('rightUpLeg'), '全身动作没有控制腿部与骨盆');
    eq(s.scene.character.semanticActions, ['idle', 'run', 'jump', 'fall', 'land', 'interact'], '角色动作集合不完整');
    pass('FORMAL_CHARACTER', `${Math.round(s.scene.character.triangleCount)} triangles / ${s.scene.character.boneCount} bones`);
    await step(page, 400); // 加载回调发生在两次模拟步进之间，先渲染一帧再截图，避免拍到占位角色
    await page.screenshot({ path: path.join(OUT, '01-home.png') });
    await step(page, 8000); eq((await snap(page)).phase, 'TUTORIAL', '零输入不得推进'); pass('ZERO_INPUT');

    // 屏幕方向与人物正面回归：四方向都必须朝实际位移方向，不能左右键却面向前后。
    {
      const x0 = (await snap(page)).scene.player.x;
      await press(page, 'right', 350);
      const x1 = (await snap(page)).scene.player.x;
      assert(x1 < x0 - .15, `按 D 应向屏幕右（世界 -X）移动：${x0.toFixed(2)} -> ${x1.toFixed(2)}`);
      let character = (await snap(page)).scene.character;
      assert(character.facingDirection.x < -.96 && character.facingErrorDegrees < 12, `D 朝向错误：${JSON.stringify(character.facingDirection)} / ${character.facingErrorDegrees}`);
      await press(page, 'left', 420);
      const x2 = (await snap(page)).scene.player.x;
      assert(x2 > x1 + .15, `按 A 应向屏幕左（世界 +X）移动：${x1.toFixed(2)} -> ${x2.toFixed(2)}`);
      character = (await snap(page)).scene.character;
      assert(character.facingDirection.x > .96 && character.facingErrorDegrees < 12, `A 朝向错误：${JSON.stringify(character.facingDirection)} / ${character.facingErrorDegrees}`);
      await press(page, 'forward', 350); character = (await snap(page)).scene.character;
      assert(character.facingDirection.z > .96 && character.facingErrorDegrees < 12, `W 朝向错误：${JSON.stringify(character.facingDirection)} / ${character.facingErrorDegrees}`);
      await press(page, 'back', 420); character = (await snap(page)).scene.character;
      assert(character.facingDirection.z < -.96 && character.facingErrorDegrees < 12, `S 朝向错误：${JSON.stringify(character.facingDirection)} / ${character.facingErrorDegrees}`);
      pass('FOUR_DIRECTION_FACING', `max error ${character.facingErrorDegrees.toFixed(2)}°`);

      const gaitSamples = await page.evaluate(() => {
        window.__game.input('forward', true);
        const samples = {};
        for (let i = 0; i < 160; i++) {
          window.__game.stepSimulation(25);
          const c = window.__game.snapshot().scene.character;
          const sin = Math.sin(c.gaitPhase); const cos = Math.cos(c.gaitPhase);
          if (!samples.kneeLeft && cos > .88 && c.motionStrength > .9) samples.kneeLeft = c;
          if (!samples.kneeRight && cos < -.88 && c.motionStrength > .9) samples.kneeRight = c;
          if (!samples.elbowLeft && sin > .88 && c.motionStrength > .9) samples.elbowLeft = c;
          if (!samples.elbowRight && sin < -.88 && c.motionStrength > .9) samples.elbowRight = c;
          if (Object.keys(samples).length === 4) break;
        }
        return samples;
      });
      character = gaitSamples.kneeLeft;
      assert(character && gaitSamples.kneeRight && gaitSamples.elbowLeft && gaitSamples.elbowRight, `未采集到完整步态周期：${Object.keys(gaitSamples)}`);
      const motion = character.boneMotion;
      assert(character.motionStrength > .9, `起跑动作强度不足：${character.motionStrength}`);
      assert(Math.max(motion.leftUpLeg, motion.rightUpLeg) > .12, `大腿没有形成步幅：${JSON.stringify(motion)}`);
      assert(gaitSamples.kneeLeft.gaitPose.kneeL > gaitSamples.kneeLeft.gaitPose.kneeR + .55, `左摆动腿没有明显屈膝：${JSON.stringify(gaitSamples.kneeLeft.gaitPose)}`);
      assert(gaitSamples.kneeRight.gaitPose.kneeR > gaitSamples.kneeRight.gaitPose.kneeL + .55, `右摆动腿没有明显屈膝：${JSON.stringify(gaitSamples.kneeRight.gaitPose)}`);
      assert(Math.max(motion.leftFoot, motion.rightFoot) > .035, `脚掌没有抬落：${JSON.stringify(motion)}`);
      assert(gaitSamples.elbowLeft.gaitPose.elbowL > gaitSamples.elbowLeft.gaitPose.elbowR + .12, `左肘没有随手臂后摆弯曲：${JSON.stringify(gaitSamples.elbowLeft.gaitPose)}`);
      assert(gaitSamples.elbowRight.gaitPose.elbowR > gaitSamples.elbowRight.gaitPose.elbowL + .12, `右肘没有随手臂后摆弯曲：${JSON.stringify(gaitSamples.elbowRight.gaitPose)}`);
      assert(Math.max(gaitSamples.elbowLeft.boneMotion.leftForeArm, gaitSamples.elbowRight.boneMotion.rightForeArm) > .28, '前臂弯曲幅度不可见');
      await page.evaluate(() => { window.__game.input('forward', false); window.__game.stepSimulation(700); });
      character = (await snap(page)).scene.character;
      assert(character.motionStrength < .03, `停止后动作没有平滑回正：${character.motionStrength}`);
      pass('NATURAL_GAIT_COMPONENTS', 'alternating knees and elbows');
    }

    for (const id of ['bowl', 'fruit', 'water']) await interact(page, id);
    eq((await snap(page)).phase, 'COLLECT_RESPONSIBILITIES', '教学未完成');
    const expected = { phone: [1, .97, .96], medicine: [2, .93, .90], application: [3, .88, .81] };
    for (const id of ['phone', 'medicine', 'application']) { await interact(page, id); s = await snap(page); const [count, run, jump] = expected[id]; eq([s.carriedResponsibilityCount, s.runMultiplier, s.jumpMultiplier], [count, run, jump], `${id} 负重曲线`); }
    eq((await snap(page)).scene.character.attachments.sort(), ['application', 'medicine', 'phone'], '责任物没有挂到林澈身上');
    pass('WEIGHT_CURVE'); await page.screenshot({ path: path.join(OUT, '02-full-load.png') });
    // 小断层失败只重跑路线，不得误触发剧情大断层。
    const beforeCourseFail = await snap(page);
    await moveTo(page, 0, beforeCourseFail.scene.course.microGaps[0].startZ - .25, .12);
    await page.evaluate(() => window.__game.input('forward', true)); await step(page, 900); await page.evaluate(() => window.__game.input('forward', false)); await step(page, 1200);
    s = await snap(page); eq(s.phase, 'COLLECT_RESPONSIBILITIES', '小断层错误推进剧情'); eq(s.carriedResponsibilityCount, 3, '小断层失败后责任物丢失'); assert(s.scene.course.respawns >= 1, '小断层没有快速重生');
    await traverseCourse(page); await moveTo(page, 0, (await snap(page)).scene.gap.startZ - .9, .2);
    await page.screenshot({ path: path.join(OUT, '03-first-gap.png') }); const gap = (await snap(page)).scene.gap;
    s = await attemptGap(page, 'MEMORY_HUB'); eq(s.scene.gap, gap, '第一次后断层被改变'); eq(s.carriedResponsibilityCount, 3, '失败后物品丢失');

    await interact(page, 'family_calendar'); s = await snap(page); eq(s.items.medicine.currentState, 'Shared', '药盒未共享'); await page.screenshot({ path: path.join(OUT, '04-memory-puzzle.png') });
    await interact(page, 'brother_return'); await interact(page, 'father_return'); s = await snap(page); eq(s.items.phone.currentState, 'ReturnedPending', '手机应等待父亲最后一步');
    await interact(page, 'father_hint'); s = await snap(page); eq([s.items.phone.currentState, s.items.application.currentState], ['Returned', 'Returned'], '归还状态错误');
    eq([s.runMultiplier, s.jumpMultiplier, s.carriedResponsibilityCount], [1, 1, 0], '责任解除后未恢复'); eq(s.phase, 'RESPONSIBILITIES_RESOLVED', '三段记忆未完成');
    eq(s.scene.character.attachments, [], '责任解除后身上仍有物件');

    await traverseCourse(page); s = await attemptGap(page, 'TRANSFER_NOTICE_REVEAL'); eq(s.scene.gap, gap, '第二次后断层被改变'); assert(s.history.some((e) => e.type === 'gap_attempt_2_interrupted'), '第二次失败没有表现为通知中断');
    await interact(page, 'notice'); await interact(page, 'discard'); s = await snap(page); eq(s.items.notice.currentState, 'Revealed', '通知被错误丢弃'); assert(s.history.some((e) => e.type === 'notice_discard_rejected'), '缺少丢弃拒绝');
    await page.screenshot({ path: path.join(OUT, '05-notice-rejected.png') }); await interact(page, 'keep'); s = await snap(page); eq(s.items.notice.currentState, 'Kept', '通知未保留');

    await traverseCourse(page); s = await attemptGap(page, 'FINAL_JUMP'); eq(s.scene.gap, gap, '最终跳后断层被改变'); assert(s.scene.finalGapCrossed, '最终未越过断层'); assert(s.scene.course.passes >= 3, '没有在三种责任状态下重复穿越跑酷路线'); await page.screenshot({ path: path.join(OUT, '06-final-landing.png') });
    await page.evaluate(() => window.__game.input('forward', true)); await step(page, 1000); await step(page, 1000); await page.evaluate(() => window.__game.input('forward', false));
    s = await snap(page); eq(s.phase, 'FINAL_JUMP', '未回复弟弟却提前结束'); assert(!s.scene.endingMessageRead && s.scene.player.z <= 77.26, '未回复时出口没有阻止误走');
    await interact(page, 'brother_message'); s = await snap(page); assert(s.scene.endingMessageRead, '按 E 后没有回复弟弟'); eq(s.history.filter((e) => e.type === 'brother_message_replied').length, 1, '弟弟回复事件次数');
    await page.screenshot({ path: path.join(OUT, '07-reply-sent.png') });
    await moveTo(page, 0, 84); s = await snap(page); eq(s.phase, 'ENDING', '未进入结尾'); assert(s.closed, '结尾未关闭');
    await page.locator('.gb-finish.visible').waitFor({ state: 'visible' }); await page.screenshot({ path: path.join(OUT, '08-level-complete.png') });
    const sequence = s.history.map((e) => e.type);
    for (const event of ['gap_attempt_1_failed', 'responsibilities_resolved', 'gap_attempt_2_interrupted', 'notice_discard_rejected', 'notice_kept', 'final_jump_landed', 'brother_message_replied', 'ending_message_sent']) eq(sequence.filter((v) => v === event).length, 1, `${event} 次数`);
    assert(s.scene.character.actionHistory.includes('run') && s.scene.character.actionHistory.includes('jump') && s.scene.character.actionHistory.includes('land'), '实际游玩没有触发完整移动动作');
    pass('PARKOUR_ROUTE_THREE_PASSES', `${s.scene.course.passes} passes / ${s.scene.course.respawns} retry`);
    pass('OFFICIAL_INPUT_E2E'); pass('SAME_GAP_THREE_ATTEMPTS'); pass('ITEM_STATE_CONTRACT');
    await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('[data-action="restart"]').click()]);
    await page.locator('#btn-game-start').waitFor({ state: 'visible' }); s = await snap(page);
    eq(s.phase, 'INTRO', '重新开始后阶段未归零'); assert(s.scene === null && s.carriedResponsibilityCount === 0 && !s.closed, '重新开始后场景或物品未归零');
    await page.locator('#btn-game-start').click(); await page.locator('#btn-start').click(); s = await snap(page); eq(s.phase, 'TUTORIAL', '重新开始后无法再次进入第一关'); pass('RESTART_FULL_RESET');
    eq(errors, [], '浏览器错误'); pass('CLEAN_RUNTIME');
    const shots = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')); assert(shots.length >= 9, '截图数量不足'); pass('SCREENSHOTS_720P', shots.join(', '));
  } catch (e) { fail('HARNESS', e); throw e; }
  finally { await browser?.close(); server?.child?.kill(); fs.writeFileSync(path.join(REPORTS, 'harness.json'), JSON.stringify({ at: new Date().toISOString(), checks }, null, 2)); }
}

run().catch(() => process.exit(1));
