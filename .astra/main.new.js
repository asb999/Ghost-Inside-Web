// main.js — 装配：启动页 → 状态机驱动的节拍切换 → 测试钩子（仅正式输入）
import * as THREE from 'three';
import './styles.css';
import rawCase from '../../data/cases/case_001_optimal_life.json';
import { normalizeCase } from './data/normalize-case.js';
import { Machine } from './game/machine.js';
import { GameClock } from './game/clock.js';
import { Input } from './game/input.js';
import { createRenderer, createScene, createCamera, disposeObject, webglDiagnostics } from './render/renderer.js';
import { StoryUI } from './ui/story.js';
import { StatementUI } from './ui/statement.js';
import { requestFeedback } from './agent/provider.js';
import { validateProviderResponse } from './agent/validate-response.js';
import { resolveFeedback } from './agent/feedback.js';
import { Audio } from './audio/audio.js';
import { GardenScene } from './scenes/garden.js';
import { CollectorScene } from './scenes/collector.js';

const caseView = normalizeCase(rawCase);
const machine = new Machine(caseView);
const clock = new GameClock();
const input = new Input();
const audio = new Audio();

// 每个节拍共享同一套远景画面。图片只负责氛围，不参与碰撞、判定或状态流转。
const BACKDROPS = Object.freeze({
  boot: new URL('./assets/scenes/start.png', import.meta.url).href,
  life_slice: new URL('./assets/scenes/dinner.png', import.meta.url).href,
  garden: new URL('./assets/scenes/garden.png', import.meta.url).href,
  collector: new URL('./assets/scenes/collector.png', import.meta.url).href,
  dinner: new URL('./assets/scenes/dinner.png', import.meta.url).href,
  pollution: new URL('./assets/scenes/pollution.png', import.meta.url).href,
  statement: new URL('./assets/scenes/pollution.png', import.meta.url).href,
  epilogue: new URL('./assets/scenes/epilogue.png', import.meta.url).href,
  closed: new URL('./assets/scenes/epilogue.png', import.meta.url).href
});

const backdrop = document.getElementById('scene-backdrop');
for (const url of new Set(Object.values(BACKDROPS))) {
  const image = new Image();
  image.src = url;
}

function setBeatBackdrop(beat) {
  const url = BACKDROPS[beat] ?? BACKDROPS.boot;
  backdrop.style.setProperty('--scene-image', `url("${url}")`);
  backdrop.dataset.beat = beat;
  backdrop.classList.remove('scene-backdrop-enter');
  void backdrop.offsetWidth;
  backdrop.classList.add('scene-backdrop-enter');
}

setBeatBackdrop('boot');

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = createRenderer(canvas);
} catch (e) {
  // 渲染器初始化失败：给出明确提示，而不是黑屏静默
  document.getElementById('ui').innerHTML = '<div class="overlay" data-story="start"><div class="card"><div class="tag">GHOST INSIDE：心灵调理师</div><div class="line warn">3D 渲染器初始化失败：' + String(e?.message || e) + '</div><div class="line">请改用桌面版 Chrome / Edge 打开本地址。</div></div></div>';
  throw e;
}
const scene = createScene();
// 背景由 DOM 远景层承载；降低 WebGL 画布不透明度，让 3D 空间与远景自然融合。
scene.background = null;
renderer.setClearColor(0x0a0e14, 0);
// 灯光：所有物件是 MeshLambertMaterial（受光材质），没有灯光整场景渲染为纯黑。
// 低强度环境光 + 单方向主光，保持「过分完美的冷调花园」氛围同时保证可读。
scene.add(new THREE.AmbientLight(0x7d8fb3, 0.65));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
keyLight.position.set(5, 12, 3);
scene.add(keyLight);
const camera = createCamera();
scene.userData.camera = camera;

const uiRoot = document.getElementById('ui');
const story = new StoryUI(uiRoot, machine, caseView, input);
const statementUI = new StatementUI(uiRoot, machine, caseView);

// 速度线（掌声加速的视觉反馈，机制即隐喻：被夸=被推着走）
const speedLines = document.createElement('div');
speedLines.className = 'speed-lines';
uiRoot.appendChild(speedLines);
speedLines.toggle = (on) => speedLines.classList.toggle('on', on);

// 只读遥测（供真实键鼠验收观察，不含任何可写状态）
const telemetry = document.createElement('div');
telemetry.id = 'telemetry';
telemetry.style.display = 'none';
uiRoot.appendChild(telemetry);

let activeScene = null;
let lastFrameStats = { calls: 0, triangles: 0 };
let providerClient = resolveProviderClient();

function resolveProviderClient() {
  // 解析顺序：?provider= > VITE_GHOST_PROVIDER_URL > 未配置（固定回退）
  const q = new URLSearchParams(location.search).get('provider');
  const url = q || import.meta.env.VITE_GHOST_PROVIDER_URL || '';
  if (!url) return null;
  return {
    request: async (body, { signal } = {}) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });
      if (!resp.ok) throw new Error(`http_${resp.status}`);
      const text = await resp.text();
      if (text.length > 64 * 1024) throw new Error('too_large_body');
      return JSON.parse(text);
    }
  };
}

function clearScene() {
  if (activeScene) {
    activeScene.dispose();
    activeScene = null;
  }
  scene.children.slice().forEach((c) => {
    // 全局照明跨节拍保留；仅清理场景内容。
    if (c.isLight) return;
    scene.remove(c);
    disposeObject(c);
  });
  speedLines.toggle(false);
}

// 表态统一管线：UI 提交与测试钩子共用
async function submitPipeline(res) {
  const raw = await requestFeedback({
    provider: providerClient,
    request: {
      statement: res.statement,
      evidence_ids: res.evidence_ids,
      allowed_results: caseView.contract.allowedResults
    },
    validate: (body) => validateProviderResponse(body, {
      templates: caseView.feedbackTemplates,
      unlocked: [...machine.unlockedCards]
    }),
    fallbacks: caseView.fallbacks,
    timeoutMs: 8000
  });
  const fb = resolveFeedback(raw, caseView);
  machine.applyFeedback(fb);
  statementUI.showFeedback(machine.feedback, {
    onContinue: () => {
      statementUI.destroy();
      machine.advance('epilogue');
    }
  });
}

// 每幕目标（顶部目标条）：让「现在要做什么、离终点还有多远」始终可见
const OBJECTIVES = {
  boot: '',
  life_slice: '目标 · 接入林澈的记忆',
  garden: '目标 1/5 · 穿过记忆花园，关闭掌声终端',
  collector: '目标 2/5 · 进入发光安全区躲过两轮祝福弹幕；防御归零后按 E 转化',
  dinner: '目标 3/5 · 观察饭桌回忆，找出谁删了出口',
  pollution: '目标 3/5 · 守住还没被吞掉的选项',
  statement: '目标 4/5 · 用证据说出你自己的判断',
  epilogue: '目标 5/5 · 把答案留给林澈',
  closed: '调理结束 · 感谢试玩'
};

function showTutorialSkip() {
  removeTutorialSkip();
  const btn = document.createElement('button');
  btn.id = 'tutorial-skip';
  btn.textContent = '跳过教学 »';
  btn.addEventListener('click', () => activeScene?.skipTutorial?.());
  uiRoot.appendChild(btn);
}
function removeTutorialSkip() {
  document.getElementById('tutorial-skip')?.remove();
}

function onBeatChange(m) {
  setBeatBackdrop(m.beat);
  removeTutorialSkip();
  story.beatLabel({
    life_slice: '序 · 生活切片',
    garden: '一幕 · 完美花园',
    collector: '战斗 · 赞许收集者',
    dinner: '二幕 · 饭桌裂缝',
    pollution: '污染 · 正确答案污染',
    statement: '表态点',
    epilogue: '尾声 · 我不知道',
    closed: '结案',
    boot: ''
  }[m.beat] ?? '');
  story.setObjective(OBJECTIVES[m.beat] ?? '');

  if (m.beat === 'life_slice') {
    clearScene();
    story.ghostHud('');
    story.showOpening();
  } else if (m.beat === 'garden') {
    clearScene();
    removeTutorialSkip();
    story.ghostHud(caseView.ghostLines.garden_enter);
    activeScene = new GardenScene({
      scene, machine, input, audio, speedLines,
      hud: (t) => story.ghostHud(t),
      objective: (t) => story.setObjective(t),
      onTutorialEnd: () => removeTutorialSkip()
    });
    showTutorialSkip();
    story._overlay?.remove(); story._overlay = null;
  } else if (m.beat === 'collector') {
    clearScene();
    // 协作过（clue_observed）→ Ghost 进场词切换到轻微回暖变体（工具渐暖弧线内的后段语气变化）
    const gl = caseView.ghostLines;
    activeScene = new CollectorScene({
      scene, machine, input, audio,
      hud: { setDefense: (v) => story.ghostHud(`Ghost：目标防御值 ${v}。建议保持距离。`) }
    });
    activeScene.start();
    // 先 start（会播防御值 HUD）再放进场词，保证协作语气变体可见
    story.ghostHud(machine.events.has('clue_observed') && gl.collector_enter_assist ? gl.collector_enter_assist : gl.collector_enter);
  } else if (m.beat === 'dinner') {
    clearScene();
    story.ghostHud(caseView.ghostLines.dinner_enter);
    story.showDinner();
  } else if (m.beat === 'pollution') {
    clearScene();
    story.ghostHud(caseView.ghostLines.pollution_enter);
    audio.heartbeatStart();
    story.showPollution();
  } else if (m.beat === 'statement') {
    clearScene();
    audio.heartbeatStop();
    story.ghostHud(caseView.ghostLines.statement_guide);
    statementUI.show({ onSubmit: (res) => submitPipeline(res) });
  } else if (m.beat === 'epilogue') {
    clearScene();
    story.ghostHud(caseView.ghostLines.epilogue_enter);
    story.showEpilogue();
  } else if (m.beat === 'closed') {
    clearScene();
    audio.heartbeatStop();
    story.ghostHud('');
    story.showEnd();
  }
}

// 全部 UI 按钮统一带点击声（事件委托，一处接线）
uiRoot.addEventListener('click', () => audio.click());

let lastBeat = 'boot';
machine.onChange((m) => {
  // unlock 等操作也会 _emit：只有节拍真正变化时才切换场景/重建 UI
  if (m.beat === lastBeat) return;
  lastBeat = m.beat;
  onBeatChange(m);
});

clock.start((dtMs) => {
  activeScene?.update(dtMs / 1000);
  story.tickPollution(dtMs);
  renderer.info.reset();
  renderer.render(scene, camera);
  lastFrameStats = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles
  };
  const p = activeScene?.player?.position;
  telemetry.dataset.beat = machine.beat;
  telemetry.dataset.x = p ? p.x.toFixed(2) : '';
  telemetry.dataset.y = p ? p.y.toFixed(2) : '';
  telemetry.dataset.z = p ? p.z.toFixed(2) : '';
});

function showStart() {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.dataset.story = 'start';
  const card = document.createElement('div');
  card.className = 'card';
  const gl = webglDiagnostics();
  let glWarn = '';
  if (!gl.webgl2) {
    glWarn = gl.webgl1
      ? '<div class="line warn">当前浏览器只支持 WebGL 1，但本作需要 WebGL 2（Three.js r186 起不再支持 WebGL 1）。请改用桌面版 Chrome / Edge 打开本地址。</div>'
      : '<div class="line warn">当前浏览器不支持 WebGL，3D 场景将无法显示。请改用桌面版 Chrome / Edge 打开本地址。</div>';
  } else if (/swiftshader|software/i.test(gl.renderer)) {
    glWarn = `<div class="line warn">当前以软件渲染运行（${gl.renderer}），帧率可能偏低；建议用桌面版 Chrome / Edge 获得完整体验。</div>`;
  }
  card.innerHTML = `<div class="tag">GHOST INSIDE：心灵调理师</div>
    <div class="line">第一章 · 最优人生</div>
    <div class="line small">你是一名心灵调理师。来访者林澈，22 岁——他的记忆被「最优人生系统」修剪过 47 次。</div>
    <div class="line ghost">任务：穿过记忆花园 → 关掉掌声终端 → 让赞许收集者放下防御 → 找出谁删了出口 → 在表态点替他说出真话。</div>
    ${glWarn}
    <div class="small">←→ 移动 · 空格 跳跃 · E 交互（全程只用这三个键）· 建议横屏</div>`;
  const btn = document.createElement('button');
  btn.id = 'btn-start';
  btn.textContent = '开始接入';
  btn.dataset.action = 'start';
  btn.addEventListener('click', () => {
    audio.unlock();
    el.remove();
    machine.start();
  });
  card.appendChild(btn);
  el.appendChild(card);
  uiRoot.appendChild(el);
}
showStart();

// 静音开关（右下角常驻）
const muteBtn = document.createElement('button');
muteBtn.id = 'audio-mute';
muteBtn.textContent = '🔊 声音开';
muteBtn.addEventListener('click', () => {
  audio.unlock();
  muteBtn.textContent = audio.toggleMute() ? '🔇 声音关' : '🔊 声音开';
});
document.body.appendChild(muteBtn);

// 测试钩子：只提供正式输入通道，不提供任何状态直写
const params = new URLSearchParams(location.search);
if (params.get('test') === '1') {
  Object.defineProperty(window, '__game', {
    configurable: false,
    writable: false,
    value: Object.freeze({
      snapshot: () => {
        const s = machine.readSnapshot();
        s.stats = { ...lastFrameStats };
        s.hasPlayer = Boolean(activeScene?.player);
        s.inputActions = [...input.actions];
        if (activeScene?.testState) s.scene = activeScene.testState();
        if (activeScene?.player) {
          s.player = {
            x: activeScene.player.position.x,
            y: activeScene.player.position.y,
            z: activeScene.player.position.z
          };
        }
        return structuredClone(s);
      },
      input: (action, pressed) => input.setAction(action, pressed),
      stepSimulation: (ms) => clock.advanceTestClock(ms),
      submitJudgment: (text, evidenceIds) => {
        const res = machine.submitJudgment(text, evidenceIds);
        if (res.ok) submitPipeline(res);
        return res;
      }
    })
  });
}
