import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { placeholderMesh } from '../assets/manifest.js';
import { CharacterVisual } from '../game/character-visual.js';
import { createPropModel, createDiningSet, createCorridorDetails, createExitGate } from '../assets/prop-factory.js';

const COURSE_GAPS = Object.freeze([
  Object.freeze({ id: 'step_gap_1', startZ: 28, endZ: 30 }),
  Object.freeze({ id: 'step_gap_2', startZ: 39, endZ: 41.2 }),
  Object.freeze({ id: 'step_gap_3', startZ: 51, endZ: 53.2 })
]);
const GAP = Object.freeze({ id: 'hall_gap', startZ: 62, endZ: 67.5 });
const BASE_RUN = 6.8;
const BASE_JUMP = 9.2;
const GRAVITY = 20;

const COLORS = {
  floor: 0x283340, home: 0x6f6251, memory: 0x35507a, cyan: 0x6fd3e8,
  amber: 0xd9a05b, red: 0xd4484f, white: 0xe8edf2, dark: 0x111821
};

function box(w, h, d, color, x, y, z, opacity = 1) {
  const material = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function labelSprite(text, color = '#dbe6ef') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(8,12,18,.82)'; ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 508, 92);
  ctx.fillStyle = color; ctx.font = '26px Microsoft YaHei, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text, 256, 60);
  const texture = new THREE.CanvasTexture(canvas);
  // depthWrite 关闭：标签是半透明公告板，互相之间按深度裁剪会出现“空框”伪影。
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.4, 0.64, 1);
  sprite.userData.labelTexture = texture;
  return sprite;
}

export class ResponsibilityScene {
  constructor({ scene, camera, machine, input, audio, hud }) {
    this.scene = scene; this.camera = camera; this.machine = machine; this.input = input; this.audio = audio; this.hud = hud;
    this.root = new THREE.Group(); scene.add(this.root);
    this.player = new THREE.Group();
    this.player.name = 'lin_che_player_root';
    this.player.position.set(0, 1, 0);
    this.root.add(this.player);
    this.characterVisual = new CharacterVisual(this.player);
    this.velocityY = 0; this.grounded = true; this.wasGrounded = true;
    this.checkpoint = { id: 'memory_hub', x: 0, y: 1, z: 24.5 };
    this.courseCheckpoint = { id: 'course_start', x: 0, y: 1, z: 24.5 };
    this.courseRespawns = 0; this.coursePasses = 0; this.coursePassArmed = true; this.fallKind = null; this.pendingRespawn = null;
    this.respawnTimer = 0; this.interactWasDown = false; this.jumpWasDown = false;
    this.subtitleTimer = 0; this.activeInteractable = null; this.finalGapCrossed = false; this.endingMessageRead = false;
    this.carriedVisuals = new Map(); this.beams = new Map(); this.discardTimer = 0;
    this.elapsed = 0; this.disposed = false; this.ghostAssetLoaded = false; this.ghostAssetFailed = false; this.ghostVisualSize = 0;
    this._buildWorld();
    this._createGhostCompanion();
    this._show('母亲：菜好了，叫你爸和弟弟来吧。', 3.2);
    this.hud.objective('把碗、水果和水放到餐桌');
  }

  _buildWorld() {
    const floorSegment = (startZ, endZ) => this.root.add(box(22, .5, endZ - startZ, COLORS.floor, 0, -.25, (startZ + endZ) / 2));
    floorSegment(-4, 28); floorSegment(30, 39); floorSegment(41.2, 51); floorSegment(53.2, 62); floorSegment(67.5, 90);
    const home = box(14, .12, 9, COLORS.home, 0, .04, 4, .72); this.root.add(home);
    const dining = createDiningSet(); dining.position.set(0, 0, 5); this.root.add(dining);
    this._addLabel('家的餐桌', 0, 2.4, 5);

    this.tutorialObjects = [
      this._marker('bowl', '碗', -3.6, 1, 1.5, COLORS.white),
      this._marker('fruit', '水果', 0, 1, 1.5, COLORS.amber),
      this._marker('water', '一杯水', 3.6, 1, 1.5, COLORS.cyan)
    ];
    this.responsibilityObjects = [
      this._marker('phone', '父亲的手机', -2.6, 1, 11, 0x7aa6d8),
      this._marker('medicine', '母亲的药盒', 0, 1, 15, 0xe78d8d),
      this._marker('application', '弟弟的申请表', 2.6, 1, 19, 0xe2c178)
    ];
    this.responsibilityObjects.forEach((marker) => { marker.visible = false; });

    this.root.add(createCorridorDetails());
    this.movingObstacle = new THREE.Group(); this.movingObstacle.position.set(0, 0, 35.2); this.root.add(this.movingObstacle);
    this.movingObstacle.add(box(4.2, 1.55, .82, COLORS.red, 0, .78, 0, .86));
    const obstacleGlow = box(4.55, .09, 1.08, COLORS.amber, 0, 1.58, 0, .9); this.movingObstacle.add(obstacleGlow);
    this._addLabel('移动的催促 · 绕开或跳过', 0, 2.55, 35.2);
    COURSE_GAPS.forEach((gap, index) => {
      const edgeA = box(18, .32, .22, index % 2 ? COLORS.amber : COLORS.cyan, 0, .08, gap.startZ); this.root.add(edgeA);
      const edgeB = box(18, .32, .22, index % 2 ? COLORS.cyan : COLORS.amber, 0, .08, gap.endZ); this.root.add(edgeB);
    });
    const leftEdge = box(22, .8, .35, COLORS.red, 0, .1, GAP.startZ); this.root.add(leftEdge);
    const rightEdge = box(22, .8, .35, COLORS.cyan, 0, .1, GAP.endZ); this.root.add(rightEdge);
    this.otherSideLabel = this._addLabel('走廊另一边', 0, 2.3, 71.5);

    this.memoryGroup = new THREE.Group(); this.memoryGroup.visible = false; this.root.add(this.memoryGroup);
    this.memoryMarkers = [
      this._marker('family_calendar', '全家可见的提醒板', -7, 1, 24, 0xe78d8d, this.memoryGroup),
      this._marker('father_return', '把手机还给父亲', 0, 1, 22, 0x7aa6d8, this.memoryGroup),
      this._marker('father_hint', '站在旁边指给他看', 2.2, 1, 25, COLORS.cyan, this.memoryGroup),
      this._marker('brother_return', '把申请表还给弟弟', 7, 1, 24, 0xe2c178, this.memoryGroup)
    ];

    this.noticeGroup = new THREE.Group(); this.noticeGroup.visible = false; this.root.add(this.noticeGroup);
    this.noticeMarker = this._marker('notice', '林澈的调动通知', 0, 1, 26, COLORS.white, this.noticeGroup);
    this.discardMarker = this._marker('discard', '放下', -4.5, 1, 23, COLORS.red, this.noticeGroup);
    this.keepMarker = this._marker('keep', '林澈的位置', 4.5, 1, 23, COLORS.amber, this.noticeGroup);

    this.endingGroup = new THREE.Group(); this.endingGroup.visible = false; this.root.add(this.endingGroup);
    this.endingMarker = this._marker('brother_message', '弟弟发来的消息 · 按 E 回复', 0, 1, 74.5, COLORS.cyan, this.endingGroup);
    const gate = createExitGate(); gate.position.set(0, 0, 78); this.root.add(gate); this.endGate = gate;
    this.exitGlow = box(8, .08, 12, COLORS.cyan, 0, .08, 84, .42); this.exitGlow.visible = false; this.root.add(this.exitGlow);
    this.endLabel = this._addLabel('出口已开启 · 向前走', 0, 3.2, 82); this.endLabel.visible = false;
  }

  _createGhostCompanion() {
    this.ghostAnchor = new THREE.Group();
    this.root.add(this.ghostAnchor);
    this.ghostFallback = placeholderMesh('ghost');
    this.ghostFallback.scale.setScalar(.72);
    this.ghostAnchor.add(this.ghostFallback);
    const glow = new THREE.PointLight(COLORS.cyan, 1.8, 6);
    this.ghostAnchor.add(glow);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(.13, 16, 12),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: .92, depthTest: false })
    );
    core.renderOrder = 8;
    this.ghostAnchor.add(core);

    const url = `${import.meta.env.BASE_URL}assets/models/ghost.glb`;
    new GLTFLoader().load(url, (gltf) => {
      if (this.disposed) return;
      const model = gltf.scene;
      const initial = new THREE.Box3().setFromObject(model);
      const size = initial.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(1.05 / longest);
      const fitted = new THREE.Box3().setFromObject(model);
      const fittedSize = fitted.getSize(new THREE.Vector3());
      this.ghostVisualSize = Math.max(fittedSize.x, fittedSize.y, fittedSize.z);
      const center = fitted.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = false; node.receiveShadow = false;
        if (node.material) {
          node.material = node.material.clone();
          if ('emissive' in node.material) node.material.emissive.setHex(0x0b6f96);
          if ('emissiveMap' in node.material && node.material.map) node.material.emissiveMap = node.material.map;
          if ('emissiveIntensity' in node.material) node.material.emissiveIntensity = .85;
          node.material.needsUpdate = true;
        }
      });
      this.ghostAnchor.add(model);
      this.ghostAnchor.remove(this.ghostFallback);
      this.ghostFallback.geometry?.dispose(); this.ghostFallback.material?.dispose();
      this.ghostFallback = null;
      this.ghostAssetLoaded = true;
    }, undefined, () => { this.ghostAssetFailed = true; });
  }

  _marker(id, text, x, y, z, color, parent = this.root) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.userData.id = id;
    const model = createPropModel(id); group.add(model);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.78, .035, 8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .78 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -.86; group.add(ring);
    const label = labelSprite(text, `#${color.toString(16).padStart(6, '0')}`); label.position.set(0, 1.35, 0); group.add(label);
    parent.add(group); return group;
  }

  _addLabel(text, x, y, z) { const l = labelSprite(text); l.position.set(x, y, z); this.root.add(l); return l; }

  _show(text, seconds = 2.8) { this.hud.subtitle(text); this.subtitleTimer = seconds; }

  _attachItem(id) {
    const source = this.responsibilityObjects.find((o) => o.userData.id === id);
    if (source) source.visible = false;
    const m = createPropModel(id); m.userData.id = id; m.scale.setScalar(.46);
    this.characterVisual.attachCarry(m, id); this.carriedVisuals.set(id, m);
    this._layoutLoad();
  }

  _layoutLoad() {
    [...this.carriedVisuals.values()].forEach((mesh, i) => mesh.position.set((i - 1) * .38, i * .16, 0));
  }

  _detachItem(id, target) {
    const m = this.carriedVisuals.get(id); if (!m) return;
    const world = new THREE.Vector3(); target.getWorldPosition(world);
    this.characterVisual.detachCarry(m, id); this.root.add(m); m.position.copy(world); m.position.y = .65;
    this.carriedVisuals.delete(id); this._layoutLoad();
  }

  _activeMarkers() {
    const phase = this.machine.phase;
    if (phase === 'TUTORIAL') return this.tutorialObjects.filter((o) => !this.machine.tutorial.has(o.userData.id));
    if (phase === 'COLLECT_RESPONSIBILITIES') {
      const ids = ['phone', 'medicine', 'application'];
      const next = ids[this.machine.carriedResponsibilityCount];
      return this.responsibilityObjects.filter((o) => o.userData.id === next && o.visible);
    }
    if (phase === 'MEMORY_HUB') {
      const out = [];
      if (this.machine.items.medicine.currentState === 'Carried') out.push(this.memoryMarkers.find((o) => o.userData.id === 'family_calendar'));
      if (this.machine.items.phone.currentState === 'Carried') out.push(this.memoryMarkers.find((o) => o.userData.id === 'father_return'));
      if (this.machine.items.phone.currentState === 'ReturnedPending') out.push(this.memoryMarkers.find((o) => o.userData.id === 'father_hint'));
      if (this.machine.items.application.currentState === 'Carried') out.push(this.memoryMarkers.find((o) => o.userData.id === 'brother_return'));
      return out;
    }
    if (phase === 'TRANSFER_NOTICE_REVEAL') {
      return this.machine.history.some((e) => e.type === 'notice_picked') ? [this.discardMarker, this.keepMarker] : [this.noticeMarker];
    }
    if (phase === 'FINAL_JUMP' && !this.endingMessageRead) return [this.endingMarker];
    return [];
  }

  _updateInteraction() {
    const markers = this._activeMarkers();
    let best = null, bestD = 1.9;
    for (const marker of markers) {
      const p = new THREE.Vector3(); marker.getWorldPosition(p);
      const d = Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z);
      if (d < bestD) { bestD = d; best = marker; }
    }
    this.activeInteractable = best?.userData.id ?? null;
    this.hud.prompt(best ? `E · ${best.children[1]?.material?.map ? '互动' : '互动'}` : '');
    const down = this.input.isDown('interact');
    if (down && !this.interactWasDown && best) this._interact(best.userData.id, best);
    this.interactWasDown = down;
  }

  _interact(id, marker) {
    this.characterVisual.triggerInteract();
    this.audio.click();
    if (this.machine.phase === 'TUTORIAL' && this.machine.finishTutorial(id)) {
      marker.visible = false;
      const placed = createPropModel(id); placed.scale.setScalar(.62);
      const slotX = { bowl: -1.25, fruit: 0, water: 1.25 }[id] ?? 0;
      placed.position.set(slotX, 1.28, 5); this.root.add(placed);
      const done = this.machine.tutorial.size;
      this._show(done === 3 ? '母亲：还是小澈最省心。' : '林澈把东西放到了桌上。');
      if (done === 3) this.hud.objective('沿走廊过去，看看家人需要什么');
      if (done === 3) this.responsibilityObjects[0].visible = true;
      return;
    }
    if (this.machine.phase === 'COLLECT_RESPONSIBILITIES' && this.machine.collect(id)) {
      this._attachItem(id);
      const nextIndex = this.machine.carriedResponsibilityCount;
      if (nextIndex < this.responsibilityObjects.length) this.responsibilityObjects[nextIndex].visible = true;
      const lines = { phone: '父亲：我就差最后一步。你帮我弄吧，你熟。', medicine: '母亲：你帮我记一下，我怕忘。', application: '弟弟：哥，这两个我该选哪个？你先替我看看吧。' };
      this._show(lines[id]);
      this.hud.objective(this.machine.carriedResponsibilityCount === 3 ? '穿过责任走廊，抵达最远处的断层' : '继续向前');
      return;
    }
    if (this.machine.phase === 'MEMORY_HUB') {
      const map = { family_calendar: 'medicine', father_return: 'phone', father_hint: 'phone', brother_return: 'application' };
      const item = map[id];
      if (this.machine.resolve(item, id)) {
        if (id !== 'father_return') this._detachItem(item, marker);
        const lines = {
          family_calendar: '母亲：我也设个闹钟。　父亲：晚上我提醒你。',
          father_return: '父亲：好像就差这一步。你在旁边指给我看。',
          father_hint: '父亲：哦，是这里。下次我自己试试。',
          brother_return: '弟弟：我想先去看看外地那所，看完再决定。'
        };
        this._show(lines[id]);
        if (this.machine.phase === 'RESPONSIBILITIES_RESOLVED') {
          this.memoryGroup.visible = false;
          this.hud.objective('再走一次那条路');
        } else this.hud.objective('再看看另一段记忆');
      }
      return;
    }
    if (this.machine.phase === 'TRANSFER_NOTICE_REVEAL') {
      if (id === 'notice') {
        this.machine.event('notice_picked'); marker.visible = false;
        this._show('记忆里的他：「这个家离不开我。」　通知上写：异地调动 · 第三次获批 · 均由本人撤回。', 7);
        this.hud.objective('处理这张通知');
      } else if (id === 'discard' && this.machine.rejectNotice()) {
        this.discardTimer = 1.0;
        this._show('电话：机会给你留到今晚。去不去，你自己想好。');
        this.hud.objective('这一次，没有人在等他处理');
      } else if (id === 'keep' && this.machine.keepNotice()) {
        this._show('Ghost：不是删除什么，而是把它放回属于他的位置。'); this.noticeGroup.visible = false;
        this.player.position.copy(new THREE.Vector3(this.courseCheckpoint.x, this.courseCheckpoint.y, this.courseCheckpoint.z));
        this.velocityY = 0; this.grounded = true; this.coursePassArmed = true;
        this.hud.objective('走廊再次复原 · 带着自己的选择跑到终点'); this.audio.success();
      }
      return;
    }
    if (this.machine.phase === 'FINAL_JUMP' && id === 'brother_message' && !this.endingMessageRead) {
      this.endingMessageRead = true;
      this.endingGroup.visible = false;
      this.endGate.visible = false;
      this.exitGlow.visible = true;
      this.endLabel.visible = true;
      this.machine.event('brother_message_replied');
      this._show('林澈删掉“我觉得你应该……”，回复：你自己比较想去哪？', 5);
      this.hud.objective('回复已发送 · 沿亮起的路向前走');
      this.audio.success();
    }
  }

  update(dt) {
    dt = Math.min(dt, .05);
    this.elapsed += dt;
    if (this.ghostAnchor) {
      this.ghostAnchor.position.set(this.player.position.x + 1.25, this.player.position.y + 1.25 + Math.sin(this.elapsed * 2.2) * .12, this.player.position.z - .8);
      this.ghostAnchor.rotation.y += dt * .35;
    }
    if (this.subtitleTimer > 0 && (this.subtitleTimer -= dt) <= 0) this.hud.subtitle('');
    if (this.discardTimer > 0) this.discardTimer -= dt;
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._finishRespawn();
      this._camera(); return;
    }

    const phase = this.machine.phase;
    const courseActive = this._courseActive();
    if (this.movingObstacle) {
      this.movingObstacle.visible = courseActive;
      this.movingObstacle.position.x = Math.sin(this.elapsed * 1.35) * 6.2;
    }
    // 相机朝 +Z 观察，Three.js 右手系下屏幕右侧是世界 -X，因此 D 应对应 -X。
    const dx = Number(this.input.isDown('left')) - Number(this.input.isDown('right'));
    const dz = Number(this.input.isDown('forward')) - Number(this.input.isDown('back'));
    const len = Math.hypot(dx, dz) || 1;
    const run = BASE_RUN * this.machine.runMultiplier;
    this.player.position.x += dx / len * run * dt;
    this.player.position.z += dz / len * run * dt;
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -10, 10);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -4, 90);
    if (this.machine.phase === 'FINAL_JUMP' && !this.endingMessageRead) this.player.position.z = Math.min(this.player.position.z, 77.25);

    if (courseActive && this.movingObstacle && Math.abs(this.player.position.z - 35.2) < .72 && Math.abs(this.player.position.x - this.movingObstacle.position.x) < 2.55 && this.player.position.y < 1.68) {
      this._beginCourseRespawn('moving_obstacle');
      this.characterVisual.update(dt, { moving: false, grounded: false, velocityY: 0, direction: { x: 0, z: 0 } });
      this._camera(); return;
    }

    const jumpDown = this.input.isDown('jump');
    if (jumpDown && !this.jumpWasDown && this.grounded) {
      this.velocityY = BASE_JUMP * this.machine.jumpMultiplier;
      this.grounded = false; this.audio.jump();
    }
    this.jumpWasDown = jumpDown;
    if (!this.grounded) {
      this.velocityY -= GRAVITY * dt;
      this.player.position.y += this.velocityY * dt;
    }

    const inGap = this.player.position.z > GAP.startZ && this.player.position.z < GAP.endZ;
    const activeMicroGap = courseActive ? COURSE_GAPS.find((gap) => this.player.position.z > gap.startZ && this.player.position.z < gap.endZ) : null;
    const overAnyGap = inGap || Boolean(activeMicroGap);
    const onFloor = !overAnyGap;
    // 从边缘直接走下去也必须开始坠落，不能以 grounded 状态踏空走过断层。
    if (overAnyGap && this.grounded) {
      this.fallKind = inGap ? 'final' : activeMicroGap.id;
      this.grounded = false;
      this.velocityY = Math.min(this.velocityY, 0);
    }
    // 只有从平台上方接触表面才算落地；低于台面掠过边缘不能被“吸”上平台。
    if (onFloor && this.player.position.y <= 1 && this.player.position.y >= .45 && this.velocityY <= 0) {
      this.player.position.y = 1; this.velocityY = 0; this.grounded = true;
      if (!this.wasGrounded) { this.audio.hit(); this.characterVisual.triggerLand(); }
      this.fallKind = null;
    }
    this.wasGrounded = this.grounded;

    if (phase === 'RESPONSIBILITIES_RESOLVED' && inGap && this.player.position.z > 64.4 && this.player.position.y > 1.2) {
      this.velocityY = Math.min(this.velocityY, -5.5);
      if (!this.machine.history.some((e) => e.type === 'notice_tether_seen')) {
        this.machine.event('notice_tether_seen'); this._show('一张被压在最里面的纸，忽然拽住了他。');
      }
    }

    if (this.player.position.y < -2) {
      if (this.fallKind && this.fallKind !== 'final') this._beginCourseRespawn(this.fallKind);
      else this._beginRespawn();
    }

    if (courseActive && this.coursePassArmed && this.player.position.z >= 54) {
      this.coursePassArmed = false; this.coursePasses += 1;
      this._show(this.machine.carriedResponsibilityCount > 0 ? '负重让每一步都更迟缓。' : '同一条路，现在身体跟得上自己的决定。', 2.4);
    }

    if (!this.finalGapCrossed && phase === 'FINAL_RUN' && this.player.position.z >= GAP.endZ && this.grounded) {
      this.finalGapCrossed = true; this.machine.finalLand(); this.audio.success();
      this.otherSideLabel.visible = false;
      this._show('弟弟：哥，你觉得我应该选哪个？', 3.2);
      this.endingGroup.visible = true;
      this.hud.objective('走近发光的手机，按 E 回复弟弟');
    }
    if (this.machine.phase === 'FINAL_JUMP' && this.endingMessageRead && this.player.position.z > 83) {
      this.machine.end();
      this.hud.objective('第一关｜留一个位置');
    }

    this.characterVisual.update(dt, { moving: Math.hypot(dx, dz) > .05, grounded: this.grounded, velocityY: this.velocityY, direction: { x: dx, z: dz }, speed: Math.hypot(dx, dz) > .05 ? run : 0 });
    this._updateInteraction(); this._camera();
  }

  _beginRespawn() {
    if (this.respawnTimer > 0) return;
    const which = this.machine.failGap();
    if (!which) { this.respawnTimer = .65; return; }
    this.coursePassArmed = true; this.pendingRespawn = this.checkpoint; this.respawnTimer = .85; this.audio.hit();
    if (which === 'first') {
      this._show('Ghost：路没有变。他替每个人拿起来的，都还背在身上。');
      this.hud.objective('看看这些东西从哪里来的');
      this.memoryGroup.visible = true;
    } else {
      this._show('Ghost：东西都还回去了，他还是跳不过。压住他的，在更里面。', 4.2);
      this.hud.objective('捡起那张纸');
      this.noticeGroup.visible = true;
    }
  }

  _courseActive() {
    return ['COLLECT_RESPONSIBILITIES', 'RESPONSIBILITIES_RESOLVED', 'FINAL_RUN'].includes(this.machine.phase);
  }

  _beginCourseRespawn(hazard) {
    if (this.respawnTimer > 0) return;
    this.courseRespawns += 1; this.coursePassArmed = true; this.pendingRespawn = this.courseCheckpoint;
    this.respawnTimer = .55; this.velocityY = 0; this.audio.hit();
    this.machine.event('parkour_failed', { hazard });
    this._show(hazard === 'moving_obstacle' ? '催促把他撞回了起点。看准节奏。' : '脚下一空。责任还在，重新来。', 2.1);
  }

  _finishRespawn() {
    const point = this.pendingRespawn || this.checkpoint;
    this.player.position.set(point.x, point.y, point.z); this.pendingRespawn = null; this.fallKind = null;
    this.velocityY = 0; this.grounded = true; this.wasGrounded = true;
  }

  _camera() {
    const target = new THREE.Vector3(this.player.position.x * .55, this.player.position.y + 5.8, this.player.position.z - 9.5);
    this.camera.position.lerp(target, .12);
    this.camera.lookAt(this.player.position.x * .35, 1.1, this.player.position.z + 3.5);
  }

  testState() {
    return {
      controls: ['left', 'right', 'forward', 'back', 'jump', 'interact'],
      player: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
      activeInteractable: this.activeInteractable,
      activeInteractables: this._activeMarkers().map((m) => ({ id: m.userData.id, x: m.getWorldPosition(new THREE.Vector3()).x, z: m.getWorldPosition(new THREE.Vector3()).z })),
      playerGrounded: this.grounded,
      checkpoint: { ...this.checkpoint },
      gap: { ...GAP },
      course: {
        active: this._courseActive(),
        microGaps: COURSE_GAPS.map((gap) => ({ ...gap })),
        obstacle: { x: this.movingObstacle?.position.x ?? 0, z: 35.2, active: Boolean(this.movingObstacle?.visible) },
        respawns: this.courseRespawns,
        passes: this.coursePasses
      },
      finalGapCrossed: this.finalGapCrossed,
      endingMessageRead: this.endingMessageRead,
      ghostAssetLoaded: this.ghostAssetLoaded,
      ghostAssetFailed: this.ghostAssetFailed,
      ghostVisualSize: this.ghostVisualSize,
      ghostToCharacterRatio: this.characterVisual.metrics.modelBoxHeight > 0 ? this.ghostVisualSize / this.characterVisual.metrics.modelBoxHeight : 0,
      visibleCarriedItems: [...this.carriedVisuals.keys()],
      connectionCount: this.carriedVisuals.size
      ,character: this.characterVisual.getTestState()
    };
  }

  dispose() {
    this.disposed = true;
    this.characterVisual.dispose();
    this.root.traverse((o) => {
      if (o.userData.labelTexture) o.userData.labelTexture.dispose();
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => { m.map?.dispose(); m.dispose(); });
      else { o.material?.map?.dispose(); o.material?.dispose(); }
    });
    this.scene.remove(this.root);
  }
}
