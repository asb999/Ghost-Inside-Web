// main.js — 装配：启动页 → 状态机驱动的节拍切换 → 测试钩子（仅正式输入）
import * as THREE from 'three';
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
import { placeholderMesh } from './assets/manifest.js';

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

// 速度线（掌声加速的视觉反馈）
const speedLines = document.createElement('div');
speedLines.className = 'speed-lines';
uiRoot.appendChild(speedLines);
speedLines.toggle = (on) => speedLines.classList.toggle('on', on);

let activeScene = null; // GardenScene | CollectorScene
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
      const text = await resp.text(); // 有限大小读取在 validate 中再卡
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
    activeScene = new GardenScene({ scene, machine, input, audio, speedLines });
    story._overlay?.remove(); story._overlay = null;
  } else if (m.beat === 'collector') {
    clearScene();
    story.ghostHud(caseView.ghostLines.collector_enter);
    activeScene = new CollectorScene({ scene, machine, input, audio, hud: { setDefense: (v) => { story.ghostHud(`Ghost：目标防御值 ${v}。建议保持距离。`); } } });
    activeScene.start();
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
    statementUI.show({
      onSubmit: async (res) => {
        const raw = await requestFeedback({
          provider: providerClient,
          request: { statement: res.statement, evidence_ids: res.evidence_ids, allowed_results: caseView.contract.allowedResults },
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
    });
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

machine.onChange(onBeatChange);

// 主循环：3D 场景更新 + 渲染统计 + 污染时钟
clock.start((dt) => {
  activeScene?.update(dt / 1000);
  story.tickPollution(dt);
  renderer.info.reset();
  renderer.render(scene, camera);
  lastFrameStats = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles
  };
});

// 启动页（首次用户点击：解锁音频 + 启动状态机）
function showStart() {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.dataset.story = 'start';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<div class="tag">GHOST INSIDE：心灵调理师</div>
    <div class="line">第一章 · 最优人生</div>
    <div class="line ghost">情绪调试系统 · 情绪调试师在线</div>
    <div class="small">WebGL 演示 · 键盘 ←→ 移动 / 空格 跳跃 / E 交互 · 建议横屏</div>`;
  const btn = document.createElement('button');
  btn.id = 'btn-start';
  btn.textContent = '开始接入';
  btn.dataset.action = 'start';
  btn.addEventListener('click', () => {
    audio.unlock();
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
        s.rendererMode = 'webgl2';
        return structuredClone(s);
      },
      input: (action, pressed) => input.setAction(action, pressed),
      stepSimulation: (ms) => clock.advanceTestClock(ms),
      submitJudgment: (text, evidenceIds) => machine.submitJudgment(text, evidenceIds)
    })
  });
}

void placeholderMesh;
void THREE;
