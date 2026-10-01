// collector.js — 赞许收集者战斗：三轮祝福弹幕（有预告与安全区），
// 防御值随轮次完成而下降（不按击杀），归零后接近交互 → 转化 → 记忆入口。
import * as THREE from 'three';
import { placeholderMesh } from '../assets/manifest.js';

const ARENA_R = 7;
const GRAVITY = 22;
const JUMP_V = 8;

export class CollectorScene {
  constructor({ scene, machine, input, audio, hud }) {
    this.scene = scene;
    this.machine = machine;
    this.input = input;
    this.audio = audio;
    this.hud = hud;
    this.group = new THREE.Group();
    this.projectiles = [];
    this.round = 0;
    this.roundTimer = 0;
    this.defense = machine.caseView.collector.defense_start;
    this.done = false;
    this.hitFlash = 0;
    this._spawnPlan = [];

    this._buildArena();
    scene.add(this.group);
  }

  _buildArena() {
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_R + 2, ARENA_R + 2, 0.5, 28),
      new THREE.MeshLambertMaterial({ color: 0x101a26 })
    );
    floor.position.y = -0.25;
    this.group.add(floor);

    this.monster = placeholderMesh('collector');
    this.monster.position.set(0, 1.6, 0);
    this.group.add(this.monster);

    this.portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.18, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xd9a05b, transparent: true, opacity: 0 })
    );
    this.portal.position.set(0, 2, -5);
    this.group.add(this.portal);
  }

  _buildPlayer() {
    this.player = placeholderMesh('lin_che');
    this.player.position.set(0, 1, 5);
    this.group.add(this.player);
    this.vy = 0;
    this.onGround = true;
  }

  start() {
    this._buildPlayer();
    this.machine.events.push('collector_round_start', { round: 1 });
    this.round = 1;
    this.roundTimer = 0;
    this._spawnPlan = this._planRound(1);
    this.hud?.setDefense(this.defense);
  }

  // 每轮的弹幕计划（可读预告 + 安全区缺口）
  _planRound(n) {
    const plan = [];
    const count = 6 + n * 2;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + n;
      plan.push({ at: i * 0.7 + 0.5, angle, safe: i % 4 === 3 });
    }
    return plan;
  }

  _telegraph(angle) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.9, 16),
      new THREE.MeshBasicMaterial({ color: 0xd4484f, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(Math.cos(angle) * ARENA_R, 0.05, 5 + Math.sin(angle) * ARENA_R);
    this.group.add(ring);
    setTimeout(() => {
      this.group.remove(ring);
      ring.geometry.dispose(); ring.material.dispose();
    }, 600);
  }

  _fire(angle) {
    const mesh = placeholderMesh('projectile');
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    mesh.position.set(-dir.x * ARENA_R, 1, 5 - dir.z * ARENA_R);
    this.group.add(mesh);
    this.projectiles.push({ mesh, dir: dir.clone() });
  }

  update(dt) {
    if (this.done) return;
    const p = this.player.position;

    if (this.input.isDown('left')) p.x = Math.max(-ARENA_R, p.x - 7 * dt);
    if (this.input.isDown('right')) p.x = Math.min(ARENA_R, p.x + 7 * dt);
    if (this.input.isDown('jump') && this.onGround) { this.vy = JUMP_V; this.onGround = false; }
    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (p.y <= 1) { p.y = 1; this.vy = 0; this.onGround = true; }

    // 圆形场地约束
    const r = Math.hypot(p.x, p.z - 5);
    if (r > ARENA_R) { p.x *= (ARENA_R / r); p.z = 5 + (p.z - 5) * (ARENA_R / r); }

    // 弹幕推进与命中
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.mesh.position.addScaledVector(pr.dir, 6.5 * dt);
      if (pr.mesh.position.distanceTo(p) < 0.7) {
        this.group.remove(pr.mesh);
        pr.mesh.geometry.dispose(); pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
        this.hitFlash = 0.35; // 受击只影响短暂移动与视觉，不封锁故事
        this.machine.events.push('collector_hit', {});
        continue;
      }
      if (Math.abs(pr.mesh.position.x) > 12 || Math.abs(pr.mesh.position.z - 5) > 12) {
        this.group.remove(pr.mesh);
        pr.mesh.geometry.dispose(); pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // 当前轮推进
    const cfg = this.machine.caseView.collector;
    if (this.round >= 1 && this.round <= 3) {
      this.roundTimer += dt;
      for (const s of this._spawnPlan) {
        if (!s.fired && this.roundTimer >= s.at) {
          s.fired = true;
          if (!s.safe) { this._telegraph(s.angle); this._fire(s.angle); }
        }
      }
      if (this.roundTimer > 6 + this.round) {
        // 该轮存活完成 → 防御按轮下降
        this.defense = Math.max(0, this.defense - cfg.defense_per_round[this.round - 1]);
        this.hud?.setDefense(this.defense);
        this.monster.scale.setScalar(1 - (100 - this.defense) / 200);
        this.machine.events.push('collector_defense_drop', { round: this.round, defense: this.defense });
        if (this.round < 3) {
          this.round += 1;
          this.roundTimer = 0;
          this._spawnPlan = this._planRound(this.round);
          this.machine.events.push('collector_round_start', { round: this.round });
        } else {
          this.round = 4; // 全部完成
        }
      }
    }

    // 防御归零 → 接近并交互 → 转化（不击杀）
    if (this.defense <= 0 && !this.converted) {
      this.portal.material.opacity = 0.5 + Math.sin(this.roundTimer * 4) * 0.2;
      if (p.distanceTo(this.monster.position) < 2.4 && this.input.isDown('interact')) {
        this.converted = true;
        this.done = true;
        this.machine.conversionDone = true;
        this.machine.events.push('collector_converted', {});
        this.machine.unlock('F02');
        this.machine.unlock('E01');
        this.machine.advance('dinner');
      }
    }

    // 相机
    const cam = this.scene.userData.camera;
    if (cam) cam.position.set(p.x * 0.5, 4.2, p.z + 7.5);
    if (cam) cam.lookAt(0, 1.4, 0);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose?.();
    });
  }
}
