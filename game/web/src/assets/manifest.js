// manifest.js — 资产清单：Tripo 模型未就绪时用几何体占位（mode: placeholder）
import * as THREE from 'three';

export const ASSET_MODE = 'placeholder';

export const MANIFEST = {
  lin_che: { geometry: 'capsule', color: 0x9fc9d6 },
  ghost: { geometry: 'octahedron', color: 0x6fd3e8 },
  collector: { geometry: 'cluster', color: 0xd4484f },
  applause_terminal: { geometry: 'box', color: 0x35507a },
  projectile: { geometry: 'sphere', color: 0xd9a05b }
};

export function placeholderMesh(key) {
  const desc = MANIFEST[key];
  if (!desc) throw new Error(`manifest: unknown key ${key}`);
  let geo;
  switch (desc.geometry) {
    case 'capsule': geo = new THREE.CapsuleGeometry(0.4, 1.1, 4, 10); break;
    case 'octahedron': geo = new THREE.OctahedronGeometry(0.5, 0); break;
    case 'sphere': geo = new THREE.SphereGeometry(0.3, 12, 10); break;
    case 'cluster': geo = new THREE.IcosahedronGeometry(1.3, 1); break;
    default: geo = new THREE.BoxGeometry(1, 1.6, 1);
  }
  const mat = new THREE.MeshLambertMaterial({ color: desc.color });
  return new THREE.Mesh(geo, mat);
}
