// renderer.js — Three.js 渲染器；DPR 上限、真实渲染统计、资源释放
import * as THREE from 'three';

// 探测 WebGL 可用性（内嵌浏览器可能禁用硬件加速导致拿不到上下文 → 全黑）
export function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// 精确探测：Three.js r186 只支持 WebGL2；内嵌视图可能只给 WebGL1
export function webglDiagnostics() {
  const out = { webgl2: false, webgl1: false, renderer: '' };
  try {
    const c = document.createElement('canvas');
    const g2 = c.getContext('webgl2');
    if (g2) {
      out.webgl2 = true;
      const dbg = g2.getExtension('WEBGL_debug_renderer_info');
      out.renderer = dbg ? String(g2.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '(无调试信息)';
    } else {
      const g1 = c.getContext('webgl');
      if (g1) {
        out.webgl1 = true;
        const dbg = g1.getExtension('WEBGL_debug_renderer_info');
        out.renderer = dbg ? String(g1.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '(无调试信息)';
      }
    }
  } catch {
    out.renderer = '';
  }
  return out;
}

export function createRenderer(canvas) {
  // failIfMajorPerformanceCaveat:false —— 显式允许软件渲染回退（SwiftShader），
  // 内嵌视图拿不到 GPU 时仍可出画面；不指定 powerPreference 以避免被绑到独显/核显某一侧
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, failIfMajorPerformanceCaveat: false });
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
