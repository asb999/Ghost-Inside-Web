import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ACTIONS = ['idle', 'run', 'jump', 'fall', 'land', 'interact'];
const MODEL_FORWARD = new THREE.Vector3(0, 0, 1);
const MODEL_FORWARD_YAW = 0;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function fallbackBody() {
  const group = new THREE.Group();
  group.name = 'lin_che_fallback';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, 1.05, 8, 14), new THREE.MeshStandardMaterial({ color: 0xcbd6df, roughness: .66 }));
  const face = new THREE.Mesh(new THREE.SphereGeometry(.27, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd6b49d, roughness: .8 }));
  face.position.y = .9; group.add(body, face); return group;
}

export class CharacterVisual {
  constructor(playerRoot, { url = `${import.meta.env.BASE_URL}assets/models/lin-che/lin-che-rigged.glb` } = {}) {
    this.root = playerRoot;
    this.pivot = new THREE.Group(); this.pivot.name = 'lin_che_facing_pivot'; this.root.add(this.pivot);
    this.motion = new THREE.Group(); this.motion.name = 'lin_che_motion_pivot'; this.pivot.add(this.motion);
    this.fallback = fallbackBody(); this.fallback.visible = false; this.motion.add(this.fallback);
    this.carrySocket = new THREE.Group(); this.carrySocket.name = 'lin_che_carry_socket'; this.carrySocket.position.set(0, .32, -.56); this.pivot.add(this.carrySocket);
    this.model = null; this.assetLoaded = false; this.assetFailed = false; this.disposed = false; this.elapsed = 0;
    this.currentAction = 'idle'; this.actionHistory = ['idle']; this.interactTimer = 0; this.landTimer = 0;
    this.gaitPhase = 0; this.motionStrength = 0; this.gaitPose = { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 }; this.targetFacingYaw = MODEL_FORWARD_YAW;
    this.targetFacingQuaternion = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, MODEL_FORWARD_YAW);
    this.lastMoveDirection = new THREE.Vector3(0, 0, 1);
    this.metrics = { skinnedMeshCount: 0, boneCount: 0, modelBoxHeight: 0, triangleCount: 0, drawCalls: 0, maxTextureSize: 0 };
    this.attachments = new Set(); this.bones = {}; this._load(url);
  }

  _load(url) {
    new GLTFLoader().load(url, (gltf) => {
      if (this.disposed) return;
      const model = gltf.scene;
      const source = new THREE.Box3().setFromObject(model); const size = source.getSize(new THREE.Vector3());
      model.scale.setScalar(1.8 / Math.max(size.y, .001));
      const fitted = new THREE.Box3().setFromObject(model); const center = fitted.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -fitted.min.y - 1, -center.z);
      // Tripo GLB uses +X as the exported front axis. Normalize the visual model
      // once so the gameplay pivot can consistently treat local +Z as forward.
      model.rotation.y = -Math.PI / 2;
      model.name = 'lin_che_formal_model';
      const bones = [];
      model.traverse((node) => {
        if (node.isMesh) {
          this.metrics.drawCalls += 1;
          this.metrics.triangleCount += node.geometry?.index ? node.geometry.index.count / 3 : (node.geometry?.attributes?.position?.count || 0) / 3;
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.filter(Boolean).forEach((m) => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach((key) => {
            const image = m[key]?.image; if (image) this.metrics.maxTextureSize = Math.max(this.metrics.maxTextureSize, image.width || 0, image.height || 0);
          }));
        }
        if (node.isSkinnedMesh) this.metrics.skinnedMeshCount += 1;
        if (node.isBone) { node.name = node.name.replace(/^mixamorig[:_]?/, ''); bones.push(node); }
      });
      this.metrics.boneCount = bones.length; this.metrics.modelBoxHeight = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
      const normalized = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
      const bone = (name) => bones.find((candidate) => normalized(candidate.name).endsWith(normalized(name)));
      Object.assign(this.bones, {
        hips: bone('Hips'), spine: bone('Spine2'),
        leftArm: bone('LeftArm'), rightArm: bone('RightArm'),
        leftForeArm: bone('LeftForeArm'), rightForeArm: bone('RightForeArm'),
        leftUpLeg: bone('LeftUpLeg'), rightUpLeg: bone('RightUpLeg'),
        leftLeg: bone('LeftLeg'), rightLeg: bone('RightLeg'),
        leftFoot: bone('LeftFoot'), rightFoot: bone('RightFoot')
      });
      Object.values(this.bones).filter(Boolean).forEach((b) => {
        b.userData.restQuaternion = b.quaternion.clone();
        b.userData.restPosition = b.position.clone();
      });
      this.model = model; this.motion.add(model); this.motion.remove(this.fallback); this._disposeObject(this.fallback); this.fallback = null; this.assetLoaded = true;
    }, undefined, () => {
      this.assetFailed = true;
      if (this.fallback) this.fallback.visible = true;
    });
  }

  _disposeObject(object) {
    object?.traverse((node) => { node.geometry?.dispose(); (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((m) => m.dispose()); });
  }
  _setAction(action) { if (this.currentAction === action) return; this.currentAction = action; this.actionHistory.push(action); if (this.actionHistory.length > 40) this.actionHistory.shift(); }
  triggerInteract() { this.interactTimer = .65; this._setAction('interact'); }
  triggerLand() { this.landTimer = .24; this._setAction('land'); }
  attachCarry(object, id = object?.userData?.id || object?.name || 'item') { if (!object) return; this.carrySocket.add(object); object.position.set((this.attachments.size - .5) * .32, this.attachments.size * .12, 0); this.attachments.add(id); }
  detachCarry(object, id = object?.userData?.id || object?.name || 'item') { if (object?.parent === this.carrySocket) this.carrySocket.remove(object); this.attachments.delete(id); }

  update(dt, { moving = false, grounded = true, velocityY = 0, direction = null, speed = 0 } = {}) {
    this.elapsed += dt; this.interactTimer = Math.max(0, this.interactTimer - dt); this.landTimer = Math.max(0, this.landTimer - dt);
    let action = 'idle';
    if (this.interactTimer > 0) action = 'interact'; else if (this.landTimer > 0) action = 'land'; else if (!grounded) action = velocityY > 0 ? 'jump' : 'fall'; else if (moving) action = 'run';
    this._setAction(action);
    if (direction && Math.hypot(direction.x, direction.z) > .01) {
      this.lastMoveDirection.set(direction.x, 0, direction.z).normalize();
      this.targetFacingYaw = Math.atan2(this.lastMoveDirection.x, this.lastMoveDirection.z) + MODEL_FORWARD_YAW;
      this.targetFacingQuaternion.setFromAxisAngle(WORLD_UP, this.targetFacingYaw);
    }
    this.pivot.quaternion.slerp(this.targetFacingQuaternion, 1 - Math.exp(-dt * 15));
    const targetStrength = moving && grounded ? 1 : 0;
    this.motionStrength += (targetStrength - this.motionStrength) * (1 - Math.exp(-dt * (targetStrength > this.motionStrength ? 11 : 8)));
    if (moving && grounded) this.gaitPhase = (this.gaitPhase + Math.max(0, speed) * dt * 1.95) % (Math.PI * 2);
    const t = this.elapsed;
    const locomotion = grounded && action !== 'interact' && action !== 'land' ? this.motionStrength : 0;
    this.motion.position.y = locomotion > .001 ? Math.abs(Math.sin(this.gaitPhase)) * .016 * locomotion : action === 'idle' ? Math.sin(t * 2.2) * .008 : 0;
    this.motion.rotation.x = action === 'jump' ? -.1 : action === 'fall' ? .075 : action === 'interact' ? -.12 : -.028 * locomotion;
    this.motion.rotation.z = locomotion > .001 ? Math.sin(this.gaitPhase) * .012 * locomotion : 0;
    const squash = action === 'land' ? .93 + .07 * (1 - this.landTimer / .24) : 1; this.motion.scale.set(1 + (1 - squash) * .22, squash, 1 + (1 - squash) * .22);
    const controlled = Object.values(this.bones).filter(Boolean);
    controlled.forEach((bone) => {
      bone.quaternion.copy(bone.userData.restQuaternion);
      bone.position.copy(bone.userData.restPosition);
    });
    const rotateX = (bone, value) => bone?.rotateX(value);
    const rotateY = (bone, value) => bone?.rotateY(value);
    const rotateZ = (bone, value) => bone?.rotateZ(value);
    if (locomotion > .001) {
      const stride = Math.sin(this.gaitPhase);
      const leftSwing = Math.max(0, stride);
      const rightSwing = Math.max(0, -stride);
      const leftToeOff = Math.max(0, -Math.sin(this.gaitPhase + .42));
      const rightToeOff = Math.max(0, Math.sin(this.gaitPhase + .42));
      const leftRecovery = Math.max(0, Math.cos(this.gaitPhase));
      const rightRecovery = Math.max(0, -Math.cos(this.gaitPhase));
      // Readable four-stage gait: the airborne leg folds clearly, while the
      // supporting leg stays almost straight until toe-off.
      const kneeL = .08 + Math.pow(leftRecovery, 1.25) * .82;
      const kneeR = .08 + Math.pow(rightRecovery, 1.25) * .82;
      const elbowL = .3 + leftSwing * .22;
      const elbowR = .3 + rightSwing * .22;
      this.gaitPose = { kneeL: kneeL * locomotion, kneeR: kneeR * locomotion, elbowL: elbowL * locomotion, elbowR: elbowR * locomotion };
      rotateX(this.bones.leftUpLeg, stride * .48 * locomotion);
      rotateX(this.bones.rightUpLeg, -stride * .48 * locomotion);
      rotateX(this.bones.leftLeg, -kneeL * locomotion);
      rotateX(this.bones.rightLeg, -kneeR * locomotion);
      rotateX(this.bones.leftFoot, (-stride * .16 + leftSwing * .22 - leftToeOff * .18) * locomotion);
      rotateX(this.bones.rightFoot, (stride * .16 + rightSwing * .22 - rightToeOff * .18) * locomotion);
      // This rig's arm hinge is local Z (local X twists the arm).
      rotateZ(this.bones.leftArm, -stride * .38 * locomotion);
      rotateZ(this.bones.rightArm, -stride * .38 * locomotion);
      // Keep a visible relaxed elbow bend. The rear arm folds more than the
      // forward arm, rather than rotating the whole arm as one rigid rod.
      rotateZ(this.bones.leftForeArm, -elbowL * locomotion);
      rotateZ(this.bones.rightForeArm, elbowR * locomotion);
      rotateY(this.bones.spine, -stride * .055 * locomotion);
      if (this.bones.hips) {
        this.bones.hips.position.y += Math.abs(Math.sin(this.gaitPhase)) * .024 * locomotion;
        this.bones.hips.position.x += Math.cos(this.gaitPhase) * .012 * locomotion;
      }
    } else if (action === 'jump') {
      this.gaitPose = { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 };
      rotateX(this.bones.leftUpLeg, -.17); rotateX(this.bones.rightUpLeg, -.17);
      rotateX(this.bones.leftLeg, .28); rotateX(this.bones.rightLeg, .28);
      rotateX(this.bones.leftArm, -.55); rotateX(this.bones.rightArm, -.55);
      rotateX(this.bones.spine, -.08);
    } else if (action === 'fall') {
      this.gaitPose = { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 };
      rotateX(this.bones.leftUpLeg, .1); rotateX(this.bones.rightUpLeg, -.08);
      rotateX(this.bones.leftLeg, .1); rotateX(this.bones.rightLeg, .16);
      rotateZ(this.bones.leftArm, -.22); rotateZ(this.bones.rightArm, .22);
    } else if (action === 'land') {
      this.gaitPose = { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 };
      const strength = Math.max(0, this.landTimer / .24);
      rotateX(this.bones.leftUpLeg, .24 * strength); rotateX(this.bones.rightUpLeg, .24 * strength);
      rotateX(this.bones.leftLeg, .38 * strength); rotateX(this.bones.rightLeg, .38 * strength);
      rotateX(this.bones.spine, .09 * strength);
      if (this.bones.hips) this.bones.hips.position.y -= .065 * strength;
    } else if (action === 'interact') {
      this.gaitPose = { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 };
      rotateX(this.bones.leftArm, -.54); rotateX(this.bones.rightArm, -.72);
      rotateX(this.bones.leftForeArm, -.42); rotateX(this.bones.rightForeArm, -.56);
      rotateX(this.bones.spine, .1);
    } else {
      this.gaitPose = { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 };
      rotateX(this.bones.spine, Math.sin(t * 2.2) * .012);
      if (this.bones.hips) this.bones.hips.position.y += Math.sin(t * 2.2) * .008;
    }
  }

  getTestState() {
    const facing = MODEL_FORWARD.clone().applyQuaternion(this.pivot.quaternion).normalize();
    const target = this.lastMoveDirection.clone().normalize();
    const facingErrorDegrees = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(facing.dot(target), -1, 1)));
    const boneMotion = Object.fromEntries(Object.entries(this.bones).filter(([, bone]) => Boolean(bone?.userData?.restQuaternion)).map(([name, bone]) => [name, bone.quaternion.angleTo(bone.userData.restQuaternion)]));
    return { assetLoaded: this.assetLoaded, assetFailed: this.assetFailed, fallbackVisible: Boolean(this.fallback?.parent && this.fallback.visible), ...this.metrics, semanticActions: [...ACTIONS], currentAction: this.currentAction, actionHistory: [...this.actionHistory], animatedBones: Object.entries(this.bones).filter(([, bone]) => Boolean(bone)).map(([name]) => name), gaitPhase: this.gaitPhase, gaitPose: { ...this.gaitPose }, motionStrength: this.motionStrength, facingYaw: Math.atan2(facing.x, facing.z), targetFacingYaw: Math.atan2(target.x, target.z), facingDirection: { x: facing.x, z: facing.z }, targetDirection: { x: target.x, z: target.z }, facingErrorDegrees, boneMotion, attachments: [...this.attachments] };
  }
  dispose() { this.disposed = true; this._disposeObject(this.pivot); this.pivot.removeFromParent(); }
}
