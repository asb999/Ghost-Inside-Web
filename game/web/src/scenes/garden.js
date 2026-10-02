// garden.js — 一幕「完美花园」：三阶段机制变奏（引入→新条件→组合），
// 终点「漂移线索」协作点（Ghost 自动固定，玩家按 E 观察→关终端），
// 掌声加速区（机制即隐喻：被夸=被推着走），检查点局部重试。
// 交互原则（最小 MVP）：全程只用 ←→ / 空格 / E，无额外功能键。
import * as THREE from 'three';
import { placeholderMesh } from '../assets/manifest.js';

const LANE = 4;          // |x| 上限
const GRAVITY = 20;
const JUMP_V = 9;
const BASE_SPEED = 6;
const APPLAUSE_SPEED = 9.6;   // 掌声加速（机制即隐喻）
const TERMINAL_Z = 96;

// 三阶段变奏（P0-01）：一阶段 z<32 只引入掌声加速且无操作失败惩罚；
// 二阶段 z<64 新增唯一条件「赞许弹幕」（间歇弹幕墙，可跳跃或等窗口）；
// 三阶段 z≥64 组合前两阶段条件（掌声加速区 + 赞许弹幕）。
const STAGE1_END = 32;
const STAGE2_END = 64;
const STAGE_HINTS = {
  1: '花园里只有掌声——被「夸」着走，会更快、更难控制。',
  2: '赞许弹幕出现了。掌声不会停——看准时机跳过去。',
  3: '它们一起来了：掌声加速，加上赞许弹幕。'
};
// 赞许弹幕（二/三阶段新条件）：全车道间歇弹幕墙，开启期可见（预告），
// 贴地穿过 → 回检查点；跳过或等窗口期通过均可
const WAVES = [
  { z: 50, period: 3.2, duty: 0.5, phase: 0 },
  { z: 84, period: 3.2, duty: 0.5, phase: 1.6 }
];

// 协作点（P0-02，极简版）：线索持续漂移；进入门区后 Ghost 自动固定，
// 玩家在线索旁按 E 观察后才可关闭终端——「伙伴出力 + 玩家确认」缺一不可。
const GATE_Z = 91;
const CLUE_Z = 93;
const GHOST_PIN_DELAY_S = 0.15; // 进入门区后固定前的演出延迟（玩家在移动，延迟必须短于观察窗口）

export class GardenScene {
  constructor({ scene, machine, input, audio, speedLines, hud, objective, onTutorialEnd }) {
    this.scene = scene;
    this.machine = machine;
    this.input = input;
    this.audio = audio;
    this.speedLines = speedLines;
    this.hud = hud;
    this.objective = objective;
    this.onTutorialEnd = onTutorialEnd;
    // 新手教程（只在花园开头出现一次，完成后不再打扰）：0=移动 1=跳跃 2=互动
    this.tutorial = { active: true, step: 0 };
    this.group = new THREE.Group();
    this.done = false;
    this._timers = [];
    this.time = 0;
    this.stage = 0;
    this.pinned = false;
    this.pinnedX = undefined;
    this.clueObserved = false;
    this._gateAnnounced = false;
    this._pinDelay = undefined;
    this._interactDown = false;
    this._lastBlockedAt = -10;

    this._buildCourse();
    this._buildPlayer();
    this._buildGate();
    scene.add(this.group);
  }

  _buildCourse() {
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x14202e });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 130), groundMat);
    ground.position.set(0, -0.25, 55);
    this.group.add(ground);

    // 花园「完美」装饰：低饱和蓝的发光花柱
    const decoMat = new THREE.MeshLambertMaterial({ color: 0x35507a, emissive: 0x1a2c46 });
    for (let i = 0; i < 14; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8), decoMat);
      col.position.set((i % 2 ? 1 : -1) * 5.4, 1.1, 6 + i * 7);
      this.group.add(col);
    }

    // 空间障碍：24 在一阶段（无失败惩罚），44/58 在二阶段（碰撞回检查点）
    this.obstacles = [];
    const obsMat = new THREE.MeshLambertMaterial({ color: 0x51708f });
    for (const z of [24, 44, 58]) {
      const obs = new THREE.Mesh(new THREE.BoxGeometry(8, 0.9, 0.6), obsMat);
      obs.position.set(0, 0.45, z);
      this.group.add(obs);
      this.obstacles.push({ z, mesh: obs });
    }

    // 掌声加速区：一阶段一条 + 三阶段一条（组合条件之一）
    this.applauseZones = [
      { from: 14, to: 20 },
      { from: 70, to: 78 }
    ];

    // 赞许弹幕墙可视化：开启期发光=预告，窗口期近乎透明
    this.waveMeshes = WAVES.map((w) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(12, 1.2, 0.25),
        new THREE.MeshBasicMaterial({ color: 0xd4484f, transparent: true, opacity: 0 })
      );
      mesh.position.set(0, 0.9, w.z);
      this.group.add(mesh);
      return { cfg: w, mesh };
    });

    // 检查点（掉落/碰撞后回到这里，不重播整章；与弹幕保持重试距离）
    this.checkpoints = [0, 36, 72];

    // 掌声终端
    this.terminal = placeholderMesh('applause_terminal');
    this.terminal.position.set(0, 0.8, TERMINAL_Z);
    this.group.add(this.terminal);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0x6fd3e8, transparent: true, opacity: 0.35 })
    );
    glow.position.copy(this.terminal.position);
    this.group.add(glow);
    this.terminalGlow = glow;
  }

  _buildGate() {
    // 漂移线索：观察前一直在 x 方向往复漂移（亮色+自转，保证暗场景中可见）
    this.clue = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshBasicMaterial({ color: 0x9ff2e0, transparent: true, opacity: 0.95 })
    );
    this.clue.position.set(0, 1.2, CLUE_Z);
    this.group.add(this.clue);
  }

  _buildPlayer() {
    this.player = placeholderMesh('lin_che');
    this.player.position.set(0, 1, 2);
    this.group.add(this.player);
    this.vy = 0;
    this.onGround = true;
    this.checkpointZ = 2;
  }

  _inApplause(z) {
    return this.applauseZones.some((a) => z > a.from && z < a.to);
  }

  _waveActive(w) {
    return ((this.time + w.phase) % w.period) < w.period * w.duty;
  }

  _clueX() {
    return this.pinned ? this.pinnedX : Math.sin(this.time * 1.5) * 3;
  }

  update(dt) {
    if (this.done) return;
    const p = this.player.position;
    this.time += dt;

    // 阶段推进（教学期间停在第 0 阶段；每阶段只进入一次）
    const prevStage = this.stage;
    this.stage = this.tutorial.active ? 0 : (p.z < STAGE1_END ? 1 : p.z < STAGE2_END ? 2 : 3);
    if (this.stage !== prevStage) {
      this.machine.events.push('garden_stage', { stage: this.stage });
      this.hud?.(STAGE_HINTS[this.stage]);
    }

    // 自动前进 + 掌声加速（机制即隐喻）；教学第 3 步慢速靠近练习终端，其余教学时间停住
    const inApplause = !this.tutorial.active && this._inApplause(p.z);
    const speed = this.tutorial.active
      ? (this.tutorial.step >= 2 ? 3 : 0)
      : (inApplause ? APPLAUSE_SPEED : BASE_SPEED);
    this.speedLines?.toggle(inApplause);
    p.z += speed * dt;

    // 左右：相机沿 +Z 前视，世界 +X 显示在屏幕左侧——输入按屏幕方向取反
    if (this.input.isDown('left')) p.x = Math.min(LANE, p.x + 7 * dt);
    if (this.input.isDown('right')) p.x = Math.max(-LANE, p.x - 7 * dt);

    // 跳跃
    if (this.input.isDown('jump') && this.onGround) {
      this.vy = JUMP_V;
      this.onGround = false;
    }
    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (p.y <= 1) { p.y = 1; this.vy = 0; this.onGround = true; }

    // 障碍碰撞（教学期间无危险）：一阶段无操作失败惩罚（P0-01）；二/三阶段回检查点（P0-03 局部重试）
    for (const o of this.tutorial.active ? [] : this.obstacles) {
      if (o.z >= STAGE1_END && Math.abs(p.z - o.z) < 0.6 && p.y < 1.5) {
        this._respawn('obstacle');
        break;
      }
    }

    // 赞许弹幕（二/三阶段新条件）：弹幕墙开启期贴地穿过 → 回检查点；
    // 跳过或等窗口期通过均可（开启期弹幕墙可见=预告）
    for (const w of this.tutorial.active ? [] : WAVES) {
      if (Math.abs(p.z - w.z) < 1.0 && p.y < 1.5 && this._waveActive(w)) {
        this._respawn('wave');
        break;
      }
    }
    for (const wm of this.waveMeshes) {
      wm.mesh.material.opacity = this._waveActive(wm.cfg) ? 0.35 : 0.06;
    }

    // 相机跟随（看向前方玩家）
    const cam = this.scene.userData.camera;
    if (cam) {
      cam.position.set(p.x * 0.4, 3.6, p.z - 8.5);
      cam.lookAt(p.x * 0.4, 1.4, p.z + 4);
    }

    if (this.tutorial.active) this._updateTutorial(dt, p);
    else this._updateGate(dt, p);
    this.clue.position.x = this._clueX();
    this.clue.rotation.y += dt * 2;
  }

  // ── 新手教程：三步教完 ←→ / 空格 / E，之后全程不再强加提示 ──
  _updateTutorial(dt, p) {
    const t = this.tutorial;
    if (t.step === 0) {
      this.objective?.('教学 1/3 · 按 ← 或 →（或 A/D）左右移动一下');
      if (this.input.isDown('left') || this.input.isDown('right')) this._advanceTutorial(1);
    } else if (t.step === 1) {
      this.objective?.('教学 2/3 · 按 空格 跳一下');
      if (this.input.isDown('jump')) this._advanceTutorial(2);
    } else {
      this.objective?.('教学 3/3 · 走向发光的练习信标，靠近后按 E');
      if (p.z > 6.8) p.z = 6.8; // 信标前停住，等玩家按 E
      // 交互（边沿触发）与练习信标
      const interactNow = this.input.isDown('interact');
      const interactPressed = interactNow && !this._interactDown;
      this._interactDown = interactNow;
      if (this._practice && interactPressed && p.z > this._practice.position.z - 2.2) {
        this.machine.events.push('tutorial_done', {});
        this._endTutorial();
      }
    }
  }

  _advanceTutorial(n) {
    this.tutorial.step = n;
    this.machine.events.push('tutorial_step', { step: n });
    if (n === 2 && !this._practice) {
      // 练习信标：发光、无危险，走过去按 E 即完成
      this._practice = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55),
        new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 })
      );
      this._practice.position.set(0, 0.9, 7);
      this.group.add(this._practice);
      this.objective?.('教学 3/3 · 走向发光的练习信标，靠近后按 E');
    }
  }

  _endTutorial() {
    if (!this.tutorial.active) return;
    this.tutorial.active = false;
    this.tutorial.step = 3;
    if (this._practice) {
      this.group.remove(this._practice);
      this._practice.geometry.dispose();
      this._practice.material.dispose();
      this._practice = null;
    }
    this.objective?.('目标 · 穿过记忆花园，关闭掌声终端');
    this.hud?.('教学完成。前面有掌声、弹幕和一条被涂改的记录——走吧。');
    this.onTutorialEnd?.();
  }

  skipTutorial() {
    this.machine.events.push('tutorial_skipped', {});
    this._endTutorial();
  }

  _updateGate(dt, p) {
    const gl = this.machine.caseView.ghostLines ?? {};
    const inZone = p.z >= GATE_Z && p.z < TERMINAL_Z;

    if (inZone && !this._gateAnnounced) {
      this._gateAnnounced = true;
      this.machine.events.push('gate_announced', {});
      this.hud?.(gl.garden_gate_drift);
      this.objective?.('靠近漂移的线索，按 E 观察');
      this._pinDelay = GHOST_PIN_DELAY_S;
    }

    // Ghost 自动保持：进入门区稍候即固定，未观察前一直保持（离开门区解除）
    if (this._pinDelay !== undefined) {
      this._pinDelay -= dt;
      if (this._pinDelay <= 0) {
        this._pinDelay = undefined;
        this.machine.events.push('ghost_support', {});
        this.hud?.(gl.garden_gate_pinned);
      }
    }
    this.pinned = inZone && !this.clueObserved && this._pinDelay === undefined;
    if (this.pinned && this.pinnedX === undefined) this.pinnedX = Math.sin(this.time * 1.5) * 3;
    if (!inZone && !this.clueObserved) this.pinnedX = undefined;

    // 边沿触发：一次按压只产生一次动作
    const interactNow = this.input.isDown('interact');
    const interactPressed = interactNow && !this._interactDown;
    this._interactDown = interactNow;

    // 观察：固定期间在线索旁按 E
    if (this.pinned && !this.clueObserved && interactPressed && Math.abs(p.z - CLUE_Z) < 2.5) {
      this.clueObserved = true;
      this.machine.events.push('clue_observed', {});
      this.hud?.(gl.garden_gate_observed);
      this.objective?.('走向掌声终端，按 E 关闭');
    }

    // 终点终端：必须先完成观察；未观察时按 E 只得到提示（不惩罚）
    if (p.z >= TERMINAL_Z - 2 && !this.machine.terminalClosed && interactPressed) {
      if (!this.clueObserved) {
        if (this.time - this._lastBlockedAt > 1) {
          this._lastBlockedAt = this.time;
          this.machine.events.push('terminal_blocked', { rewind_to: 88.5 });
          this.hud?.(gl.garden_gate_blocked);
          this.objective?.('先按提示观察线索，再回来关终端');
          // 不能倒走：把玩家送回门区前，带着提示重跑这段（Ghost 保持状态一并重置）
          p.z = 88.5;
          p.x = 0;
          this.pinned = false;
          this.pinnedX = undefined;
          this._pinDelay = GHOST_PIN_DELAY_S;
        }
      } else {
        this.machine.terminalClosed = true;
        this.machine.events.push('terminal_closed', {});
        // 协作完成回电（后段语气变化的起点：仍然工具腔，但开始记录「你」）
        this.hud?.(gl.garden_gate_callback);
        this.objective?.('赞许收集者出现——保持距离，防御归零后靠近按 E');
        // 掌声延迟 500ms 才停（恐怖来自延迟）
        this.audio?.applauseStart();
        this._timers.push(setTimeout(() => {
          this.audio?.applauseStop();
          this.audio?.breath();
          this.machine.advance('collector');
        }, this.machine.caseView.garden?.applause_delay_ms ?? 500));
        this.done = true;
      }
    }
  }

  // 局部重试（P0-03）：只重置操作暂态（位置/速度/Ghost 保持状态）；
  // 已观察的线索、已推进的节拍与叙事状态一律不回退，无重复奖励/污染。
  _respawn(reason) {
    const p = this.player.position;
    let best = this.checkpoints[0];
    for (const c of this.checkpoints) if (c <= p.z + 0.5) best = c;
    this.checkpointZ = best;
    this.pinned = false;
    this.pinnedX = undefined;
    if (this._gateAnnounced && !this.clueObserved) this._pinDelay = GHOST_PIN_DELAY_S;
    this.machine.events.push('garden_respawn', { reason, z: this.checkpointZ, hitZ: +p.z.toFixed(2), hitY: +p.y.toFixed(2), jumpDown: this.input.isDown('jump') });
    p.set(0, 1, this.checkpointZ);
    this.vy = 0;
  }

  // 测试/演示只读状态（window.__game.snapshot().scene）
  testState() {
    return {
      stage: this.stage,
      cluePinned: this.pinned,
      clueObserved: this.clueObserved,
      tutorialActive: this.tutorial.active,
      waveActive: this._waveActive(WAVES[0])
    };
  }

  dispose() {
    for (const t of this._timers) clearTimeout(t);
    this.speedLines?.toggle(false);
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose?.();
    });
  }
}
