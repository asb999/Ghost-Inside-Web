// renderer.js — Three.js 渲染器；DPR 上限、真实渲染统计、资源释放
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.info.autoReset = false;
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.getCanvasView?.();
  });
  return renderer;
}

export function createScene({ fogColor = 0x0a0e14, fogNear = 20, fogFar = 90, bg = 0x0a0e14 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
  return scene;
}

export function createCamera({ fov = 62, pos = [0, 3.4, -8] } = {}) {
  const cam = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 300);
  cam.position.set(...pos);
  window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
  });
  return cam;
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      }
    }
  });
}
