import * as THREE from 'three';
import './styles.css';
import { ResponsibilityMachine } from './game/responsibility-machine.js';
import { GameClock } from './game/clock.js';
import { Input } from './game/input.js';
import { createRenderer, createScene, createCamera, webglDiagnostics } from './render/renderer.js';
import { Audio } from './audio/audio.js';
import { ResponsibilityScene } from './scenes/responsibility.js';

let machine = new ResponsibilityMachine();
const clock = new GameClock();
const input = new Input();
const audio = new Audio();
const uiRoot = document.getElementById('ui');
const backdrop = document.getElementById('scene-backdrop');
const dinnerBackdrop = new URL('./assets/scenes/dinner.png', import.meta.url).href;
backdrop.style.setProperty('--scene-image', `url("${dinnerBackdrop}")`);
backdrop.dataset.beat = 'leave-a-place';

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = createRenderer(canvas);
} catch (error) {
  uiRoot.innerHTML = `<div class="overlay"><div class="card"><div class="tag">GHOST INSIDE</div><div class="line warn">3D 场景无法启动：${String(error?.message || error)}</div></div></div>`;
  throw error;
}

const scene = createScene({ fogColor: 0x111821, fogNear: 20, fogFar: 78 });
scene.background = null;
scene.add(new THREE.HemisphereLight(0xf5d7ad, 0x172231, 1.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(-5, 12, -3); scene.add(keyLight);
const warmLight = new THREE.PointLight(0xffc680, 2.2, 24); warmLight.position.set(0, 6, 5); scene.add(warmLight);
const camera = createCamera({ fov: 58, pos: [0, 6, -9] });

class GreyboxHud {
  constructor(root) {
    this.el = document.createElement('div'); this.el.className = 'greybox-hud';
    this.el.innerHTML = '<div class="gb-title">第一关 · 留一个位置</div><div class="gb-objective"></div><div class="gb-load"></div><div class="gb-subtitle"></div><div class="gb-prompt"></div><div class="gb-finish"><div>第一关完成</div><strong>留一个位置</strong><span>给家人，也给自己。</span><button data-action="restart">重新开始</button></div>';
    root.appendChild(this.el);
    this.objectiveEl = this.el.querySelector('.gb-objective');
    this.subtitleEl = this.el.querySelector('.gb-subtitle');
    this.promptEl = this.el.querySelector('.gb-prompt');
    this.loadEl = this.el.querySelector('.gb-load');
    this.finishEl = this.el.querySelector('.gb-finish');
    this.el.classList.add('inactive');
    this.finishEl.querySelector('[data-action="restart"]').addEventListener('click', () => location.reload());
  }
  objective(text) { this.objectiveEl.textContent = text; }
  subtitle(text) { this.subtitleEl.textContent = text; this.subtitleEl.classList.toggle('visible', Boolean(text)); }
  prompt(text) { this.promptEl.textContent = text; this.promptEl.classList.toggle('visible', Boolean(text)); }
  load(snapshot) {
    const carried = ['phone', 'medicine', 'application'].filter((id) => ['Carried', 'ReturnedPending'].includes(snapshot.items[id].currentState));
    const names = { phone: '父亲的手机', medicine: '母亲的药盒', application: '弟弟的申请表' };
    this.loadEl.textContent = carried.length ? carried.map((id) => `■ ${names[id]}`).join('　') : '';
  }
  finish() { this.finishEl.classList.add('visible'); this.objective(''); this.loadEl.textContent = ''; this.prompt(''); this.subtitle(''); }
  activate() { this.el.classList.remove('inactive'); }
}

const hud = new GreyboxHud(uiRoot);
let activeScene = null;
let lastFrameStats = { calls: 0, triangles: 0 };
let endingShown = false;
let levelLoadingOverlay = null;

function startGame() {
  audio.unlock();
  const overlay = document.querySelector('[data-story="chapter-intro"]');
  const button = overlay?.querySelector('[data-action="start"]');
  if (button) { button.disabled = true; button.textContent = '角色载入中…'; }
  if (!machine.start()) return;
  activeScene = new ResponsibilityScene({ scene, camera, machine, input, audio, hud });
  levelLoadingOverlay = overlay;
}

function revealLevelWhenReady() {
  if (!levelLoadingOverlay || !activeScene) return;
  const state = activeScene.testState();
  const characterReady = state.character?.assetLoaded || state.character?.assetFailed;
  const ghostReady = state.ghostAssetLoaded || state.ghostAssetFailed;
  if (!characterReady || !ghostReady) return;
  levelLoadingOverlay.remove(); levelLoadingOverlay = null; hud.activate();
}

function showChapterIntro() {
  const gl = webglDiagnostics();
  const overlay = document.createElement('div'); overlay.className = 'overlay'; overlay.dataset.story = 'chapter-intro';
  overlay.innerHTML = `<div class="card start-card">
    <div class="tag">GHOST INSIDE：心灵调理师</div>
    <div class="chapter">第一关 · 留一个位置</div>
    <div class="line">林澈总是家里最可靠的那个人。今晚，一封只属于他的通知正在等回复。</div>
    <div class="small">WASD 移动 · Space 跳跃 · E 拿起、放下或互动</div>
    ${gl.webgl2 ? '' : '<div class="line warn">请使用支持 WebGL 2 的桌面版 Chrome 或 Edge。</div>'}
    <button id="btn-start" data-action="start">回到那天晚上</button>
  </div>`;
  overlay.querySelector('button').addEventListener('click', startGame);
  uiRoot.appendChild(overlay);
}

function showGameHome() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay game-home'; overlay.dataset.story = 'game-home';
  overlay.style.backgroundImage = `url("${import.meta.env.BASE_URL}assets/ui/game-start.png")`;
  overlay.innerHTML = '<div class="game-home-panel"><div class="game-home-kicker">GHOST INSIDE</div><button id="btn-game-start" data-action="game-start">开始游戏</button></div>';
  overlay.querySelector('button').addEventListener('click', () => { audio.unlock(); overlay.remove(); showChapterIntro(); });
  uiRoot.appendChild(overlay);
}

showGameHome();

const muteBtn = document.createElement('button');
muteBtn.id = 'audio-mute'; muteBtn.textContent = '🔊 声音开';
muteBtn.addEventListener('click', () => { audio.unlock(); muteBtn.textContent = audio.toggleMute() ? '🔇 声音关' : '🔊 声音开'; });
document.body.appendChild(muteBtn);

clock.start((dtMs) => {
  activeScene?.update(dtMs / 1000);
  revealLevelWhenReady();
  hud.load(machine.readSnapshot());
  renderer.info.reset(); renderer.render(scene, camera);
  lastFrameStats = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  document.body.classList.toggle('ending', machine.phase === 'ENDING');
  if (machine.phase === 'ENDING' && !endingShown) { endingShown = true; hud.finish(); }
});

const params = new URLSearchParams(location.search);
if (params.get('test') === '1') {
  Object.defineProperty(window, '__game', {
    configurable: false, writable: false,
    value: Object.freeze({
      snapshot: () => structuredClone({ ...machine.readSnapshot(), stats: { ...lastFrameStats }, scene: activeScene?.testState() ?? null }),
      input: (action, pressed) => input.setAction(action, pressed),
      stepSimulation: (ms) => clock.advanceTestClock(ms)
    })
  });
}
