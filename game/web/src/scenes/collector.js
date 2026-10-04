// collector.js — 赞许收集者战斗：两轮安全区弹幕。
// 玩家必须主动进入安全区并无伤完成当前轮，怪物才会放下防御；
// 连续失败两次后扩大安全区，但不会替玩家完成操作。
import * as THREE from 'three';
import { placeholderMesh } from '../assets/manifest.js';

const ARENA_CENTER = Object.freeze({ x: 0, z: 0 });
const ARENA_R = 7;
const PLAYER_Z = ARENA_CENTER.z + 5;
const PLAYER_SPEED = 7;
const GRAVITY = 22;
const JUMP_V = 8;
const ROUND_COUNT = 2;
const ROUND_DURATION = 6.2;
const RETRY_LOCK_SECONDS = 0.65;
const BASE_SAFE_RADIUS = 1.35;
const ASSIST_SAFE_RADIUS = 2.35;
const PROJECTILE_SPEED = 9;
const SAFE_X = [-3.4, 3.4];
const PROJECTILE_LANES = [-6, -4, -2, 0, 2, 4, 6];
const BURST_TIMES = [0.65, 2.05, 3.45, 4.85];

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
    this.converted = false;
    this.hitFlash = 0;
    this.retryLock = 0;
    this.cameraShake = 0;
    this.failuresThisRound = 0;
    this.roundHit = false;
    this.safeVisited = false;
    this._spawnPlan = [];

    this._buildArena();
    scene.add(this.group);
  }

  _buildArena() {
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_R + 2, ARENA_R + 2, 0.5, 28),
      new THREE.MeshLambertMaterial({ color: 0x101a26 })
    );
    floor.position.set(ARENA_CENTER.x, -0.25, ARENA_CENTER.z);
    this.group.add(floor);

    this.monster = placeholderMesh('collector');
    this.monster.position.set(ARENA_CENTER.x, 1.6, ARENA_CENTER.z);
    this.group.add(this.monster);

    this.portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.18, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xd9a05b, transparent: true, opacity: 0 })
    );
    this.portal.position.set(ARENA_CENTER.x, 2, ARENA_CENTER.z - 3.5);
    this.group.add(this.portal);

    this.safeZone = new THREE.Group();
    this.safeFill = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.06, 32),
      new THREE.MeshBasicMaterial({ color: 0x69e0c2, transparent: true, opacity: 0.22 })
    );
    this.safeRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.1, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x9ff2e0, transparent: true, opacity: 0.95 })
    );
    this.safeRing.rotation.x = Math.PI / 2;
    this.safeZone.add(this.safeFill, this.safeRing);
    this.safeZone.position.set(0, 0.04, PLAYER_Z);
    this.group.add(this.safeZone);
  }

  _buildPlayer() {
    this.player = placeholderMesh('lin_che');
    this.player.position.set(ARENA_CENTER.x, 1, PLAYER_Z);
    this.player.material.transparent = true;
    this.group.add(this.player);
    this.vy = 0;
    this.onGround = true;
  }

  start() {
    this._buildPlayer();
    this._startRound(1);
    this.hud?.setDefense(this.defense);
  }

  _safeRadius() {
    return this.failuresThisRound >= 2 ? ASSIST_SAFE_RADIUS : BASE_SAFE_RADIUS;
  }

  _safeX() {
    return SAFE_X[Math.max(0, this.round - 1)] ?? SAFE_X[SAFE_X.length - 1];
  }

  _isInSafeZone() {
    if (!this.player || this.round < 1 || this.round > ROUND_COUNT) return false;
    return Math.abs(this.player.position.x - this._safeX()) <= this._safeRadius();
  }

  _startRound(n) {
    this.round = n;
    this.roundTimer = 0;
    this.retryLock = 0;
    this.roundHit = false;
    this.safeVisited = false;
    this._spawnPlan = BURST_TIMES.map((at) => ({ at, fired: false }));
    this._clearProjectiles();
    this._updateSafeZoneVisual();
    this.machine.events.push('collector_round_start', {
      round: n,
      failures: this.failuresThisRound,
      assisted: this.failuresThisRound >= 2
    });
  }

  _updateSafeZoneVisual() {
    const radius = this._safeRadius();
    this.safeZone.position.x = this._safeX();
    this.safeFill.scale.set(radius, 1, radius);
    this.safeRing.scale.set(radius, radius, radius);
    const assisted = this.failuresThisRound >= 2;
    this.safeFill.material.color.setHex(assisted ? 0xffd27a : 0x69e0c2);
    this.safeRing.material.color.setHex(assisted ? 0xffd27a : 0x9ff2e0);
  }

  _fireWall() {
    const safeX = this._safeX();
    const radius = this._safeRadius();
    for (const x of PROJECTILE_LANES) {
      // 安全区留出清楚的缺口；扩大辅助仍保留 x=0 的危险，零输入不能通关。
      if (Math.abs(x - safeX) <= radius) continue;
      const mesh = placeholderMesh('projectile');
      mesh.position.set(x, 1, ARENA_CENTER.z - ARENA_R - 1);
      this.group.add(mesh);
      this.projectiles.push({ mesh });
    }
    this.audio?.whoosh();
    this.machine.events.push('collector_wall_fired', {
      round: this.round,
      safe_x: safeX,
      safe_radius: radius
    });
  }

  _clearProjectiles() {
    for (const pr of this.projectiles) {
      this.group.remove(pr.mesh);
      pr.mesh.geometry.dispose();
      pr.mesh.material.dispose();
    }
    this.projectiles = [];
  }

  _failRound(reason) {
    if (this.retryLock > 0 || this.round < 1 || this.round > ROUND_COUNT) return;
    this.roundHit = reason === 'hit';
    this.failuresThisRound += 1;
    this.retryLock = RETRY_LOCK_SECONDS;
    this.hitFlash = RETRY_LOCK_SECONDS;
    this.cameraShake = 0.35;
    this.vy = 0;
    this.onGround = true;
    this._clearProjectiles();
    this._updateSafeZoneVisual();
    this.audio?.hit();
    this.machine.events.push('collector_round_failed', {
      round: this.round,
      reason,
      failures: this.failuresThisRound,
      assisted: this.failuresThisRound >= 2
    });
  }

  _retryRound() {
    this.player.position.set(ARENA_CENTER.x, 1, PLAYER_Z);
    this._startRound(this.round);
    this.machine.events.push('collector_round_retry', {
      round: this.round,
      failures: this.failuresThisRound
    });
  }

  _completeRound() {
    const defenseDrop = this.round === ROUND_COUNT
      ? this.defense
      : Math.ceil(this.machine.caseView.collector.defense_start / ROUND_COUNT);
    this.defense = Math.max(0, this.defense - defenseDrop);
    this.hud?.setDefense(this.defense);
    this.monster.scale.setScalar(1 - (100 - this.defense) / 200);
    this.machine.events.push('collector_defense_drop', {
      round: this.round,
      defense: this.defense,
      safe_zone_completed: true
    });

    if (this.round < ROUND_COUNT) {
      this.failuresThisRound = 0;
      this._startRound(this.round + 1);
    } else {
      this.round = ROUND_COUNT + 1;
      this.roundTimer = 0;
      this.safeZone.visible = false;
      this._clearProjectiles();
    }
  }

  update(dt) {
    if (this.done) return;
    const p = this.player.position;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt);
    this.player.visible = Math.floor(this.hitFlash * 20) % 2 === 0;

    if (this.retryLock > 0) {
      this.retryLock = Math.max(0, this.retryLock - dt);
      if (this.retryLock === 0) this._retryRound();
      this._updateCamera();
      return;
    }

    // 战斗与整局承诺一致：只使用左右、跳跃与 E；不读取 forward/back。
    if (this.input.isDown('left')) p.x = Math.max(-ARENA_R, p.x - PLAYER_SPEED * dt);
    if (this.input.isDown('right')) p.x = Math.min(ARENA_R, p.x + PLAYER_SPEED * dt);
    if (this.input.isDown('jump') && this.onGround) {
      this.vy = JUMP_V;
      this.onGround = false;
      this.audio?.jump();
    }
    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (p.y <= 1) { p.y = 1; this.vy = 0; this.onGround = true; }
    p.z = PLAYER_Z;

    if (this.round >= 1 && this.round <= ROUND_COUNT) {
      this.roundTimer += dt;
      if (this._isInSafeZone()) this.safeVisited = true;
      const pulse = 0.9 + Math.sin(this.roundTimer * 5) * 0.08;
      this.safeRing.scale.setScalar(this._safeRadius() * pulse);

      for (const burst of this._spawnPlan) {
        if (!burst.fired && this.roundTimer >= burst.at) {
          burst.fired = true;
          this._fireWall();
        }
      }

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.mesh.position.z += PROJECTILE_SPEED * dt;
        if (pr.mesh.position.distanceTo(p) < 0.72 && p.y < 1.7) {
          this.group.remove(pr.mesh);
          pr.mesh.geometry.dispose();
          pr.mesh.material.dispose();
          this.projectiles.splice(i, 1);
          this.machine.events.push('collector_hit', { round: this.round });
          this._failRound('hit');
          break;
        }
        if (pr.mesh.position.z > ARENA_CENTER.z + ARENA_R + 4) {
          this.group.remove(pr.mesh);
          pr.mesh.geometry.dispose();
          pr.mesh.material.dispose();
          this.projectiles.splice(i, 1);
        }
      }

      if (this.retryLock === 0 && this.roundTimer >= ROUND_DURATION) {
        if (this.safeVisited && this._isInSafeZone() && !this.roundHit) this._completeRound();
        else this._failRound(this.safeVisited ? 'left_safe_zone' : 'safe_zone_missed');
      }
    }

    // 防御归零后仍需玩家靠近并按 E，完成“转化”而非自动击杀。
    if (this.defense <= 0 && !this.converted) {
      this.portal.material.opacity = 0.5 + Math.sin(this.roundTimer * 4) * 0.2;
      if (p.distanceTo(this.monster.position) < 6.2 && this.input.isDown('interact')) {
        this.converted = true;
        this.done = true;
        this.machine.conversionDone = true;
        this.audio?.success();
        this.machine.events.push('collector_converted', {});
        this.machine.unlock('F02');
        this.machine.unlock('E01');
        this.machine.advance('dinner');
      }
    }

    this._updateCamera();
  }

  _updateCamera() {
    const cam = this.scene.userData.camera;
    if (!cam) return;
    const shake = this.cameraShake > 0 ? Math.sin(this.cameraShake * 90) * 0.12 : 0;
    cam.position.set(this.player.position.x * 0.25 + shake, 4.2 + shake, PLAYER_Z + 7.5);
    cam.lookAt(ARENA_CENTER.x, 1.4, ARENA_CENTER.z);
  }

  // 测试与演示只读状态；不暴露任何状态写入口。
  testState() {
    return {
      round: this.round,
      roundCount: ROUND_COUNT,
      roundTimer: this.roundTimer,
      defense: this.defense,
      failures: this.failuresThisRound,
      assisted: this.failuresThisRound >= 2,
      safeX: this._safeX(),
      safeRadius: this._safeRadius(),
      inSafeZone: this._isInSafeZone(),
      safeVisited: this.safeVisited,
      roundHit: this.roundHit,
      retryLocked: this.retryLock > 0,
      hitFlash: this.hitFlash,
      cameraShake: this.cameraShake,
      projectileCount: this.projectiles.length,
      arenaCenter: { ...ARENA_CENTER },
      playerZ: PLAYER_Z,
      controls: ['left', 'right', 'jump', 'interact']
    };
  }

  dispose() {
    this._clearProjectiles();
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose?.();
    });
  }
}
