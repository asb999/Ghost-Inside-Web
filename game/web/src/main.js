// main.js — 装配：启动页 → 状态机驱动的节拍切换 → 测试钩子（仅正式输入）
import rawCase from '../../data/cases/case_001_optimal_life.json';
import { normalizeCase } from './data/normalize-case.js';
import { Machine } from './game/machine.js';
import { GameClock } from './game/clock.js';
import { Input } from './game/input.js';
import { createRenderer, createScene, createCamera, disposeObject } from './render/renderer.js';
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

const canvas = document.getElementById('stage');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = createCamera();
scene.userData.camera = camera;

const uiRoot = document.getElementById('ui');
const story = new StoryUI(uiRoot, machine, caseView);
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

function onBeatChange(m) {
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

  if (m.beat === 'life_slice') {
    clearScene();
    story.ghostHud('');
    story.showOpening();
  } else if (m.beat === 'garden') {
    clearScene();
    story.ghostHud(caseView.ghostLines.garden_enter);
    activeScene = new GardenScene({ scene, machine, input, audio, speedLines, hud: (t) => story.ghostHud(t) });
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
    story.showPollution();
  } else if (m.beat === 'statement') {
    clearScene();
    story.ghostHud(caseView.ghostLines.statement_guide);
    statementUI.show({ onSubmit: (res) => submitPipeline(res) });
  } else if (m.beat === 'epilogue') {
    clearScene();
    story.ghostHud(caseView.ghostLines.epilogue_enter);
    story.showEpilogue();
  } else if (m.beat === 'closed') {
    clearScene();
    story.ghostHud('');
    story.showEnd();
  }
}

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
  card.innerHTML = `<div class="tag">GHOST INSIDE：心灵调理师</div>
    <div class="line">第一章 · 最优人生</div>
    <div class="line ghost">情绪调试系统 · 情绪调试师在线</div>
    <div class="small">WebGL 演示 · ←→ 移动 / 空格 跳跃 / ↑↓ 前后（战斗）/ E 交互 / Q 请求 Ghost 支援 · 建议横屏</div>`;
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
