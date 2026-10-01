// garden.js — 一幕「完美花园」：固定镜头自动前进，左右/跳跃，检查点，
// 掌声加速区（机制即隐喻：被夸=被推着走），终点掌声终端（关闭后延迟 500ms 静音）。
import * as THREE from 'three';
import { placeholderMesh } from '../assets/manifest.js';

const LANE = 4;          // |x| 上限
const GRAVITY = 20;
const JUMP_V = 9;
const BASE_SPEED = 6;
const APPLAUSE_SPEED = 9.6;   // 掌声加速（机制即隐喻）
const COURSE_END = 96;
const TERMINAL_Z = 96;

export class GardenScene {
  constructor({ scene, machine, input, audio, speedLines }) {
    this.scene = scene;
    this.machine = machine;
    this.input = input;
    this.audio = audio;
    this.speedLines = speedLines;
    this.group = new THREE.Group();
    this.done = false;
    this._timers = [];

    this._buildCourse();
    this._buildPlayer();
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

    // 三个空间障碍（跨栏）
    this.obstacles = [];
    const obsMat = new THREE.MeshLambertMaterial({ color: 0x51708f });
    for (let i = 0; i < 3; i++) {
      const z = 24 + i * 18;
      const obs = new THREE.Mesh(new THREE.BoxGeometry(8, 0.9, 0.6), obsMat);
      obs.position.set(0, 0.45, z);
      this.group.add(obs);
      this.obstacles.push({ z, mesh: obs });
    }

    // 掌声加速区（两条）：站在里面会被「夸」得更快、更难控制
    this.applauseZones = [
      { from: 14, to: 20 },
      { from: 40, to: 48 }
    ];

    // 检查点（掉落/碰撞后回到这里，不重播整章）
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

  update(dt) {
    if (this.done) return;
    const p = this.player.position;

    // 自动前进 + 掌声加速（机制即隐喻）
    const speed = this._inApplause(p.z) ? APPLAUSE_SPEED : BASE_SPEED;
    this.speedLines?.toggle(this._inApplause(p.z));
    p.z += speed * dt;

    // 左右
    if (this.input.isDown('left')) p.x = Math.max(-LANE, p.x - 7 * dt);
    if (this.input.isDown('right')) p.x = Math.min(LANE, p.x + 7 * dt);

    // 跳跃
    if (this.input.isDown('jump') && this.onGround) {
      this.vy = JUMP_V;
      this.onGround = false;
    }
    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (p.y <= 1) { p.y = 1; this.vy = 0; this.onGround = true; }

    // 障碍碰撞 → 回检查点
    for (const o of this.obstacles) {
      if (Math.abs(p.z - o.z) < 0.6 && p.y < 1.5) {
        this._respawn();
        break;
      }
    }

    // 相机跟随
    const cam = this.scene.userData.camera;
    if (cam) cam.position.set(p.x * 0.4, 3.6, p.z - 8.5);

    // 终点终端：抵达后交互关闭
    if (p.z >= TERMINAL_Z - 2 && !this.machine.terminalClosed) {
      if (this.input.isDown('interact')) {
        this.machine.terminalClosed = true;
        this.machine.events.push('terminal_closed', {});
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

  _respawn() {
    const p = this.player.position;
    let best = this.checkpoints[0];
    for (const c of this.checkpoints) if (c <= p.z + 0.5) best = c;
    this.checkpointZ = best;
    this.machine.events.push('garden_respawn', { z: this.checkpointZ, hitZ: +p.z.toFixed(2), hitY: +p.y.toFixed(2), jumpDown: this.input.isDown('jump') });
    p.set(0, 1, this.checkpointZ);
    this.vy = 0;
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
