import * as THREE from 'three';

const MAT = {
  dark: new THREE.MeshStandardMaterial({ color: 0x151c26, roughness: .62, metalness: .28 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x5d6a79, roughness: .38, metalness: .72 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6f4a32, roughness: .82 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xf1eee3, roughness: .92 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x48c9e8, emissive: 0x0b5268, emissiveIntensity: .55, roughness: .4 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xe4a14f, emissive: 0x59320b, emissiveIntensity: .35, roughness: .56 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd95860, emissive: 0x4a0d14, emissiveIntensity: .32, roughness: .58 }),
  white: new THREE.MeshStandardMaterial({ color: 0xdce6ed, roughness: .7 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xa8e5ee, transparent: true, opacity: .42, roughness: .12, transmission: .28, depthWrite: false })
};

const mesh = (geometry, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); return m; };
const cube = (w, h, d, material, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
const group = (name) => { const g = new THREE.Group(); g.name = name; return g; };

function paperSheet(kind = 'application') {
  const g = group(kind); g.add(cube(.92, .035, 1.18, MAT.paper, 0, 0, 0));
  const header = kind === 'notice' ? MAT.red : MAT.amber;
  g.add(cube(.66, .018, .12, header, 0, .03, -.42));
  for (let i = 0; i < 4; i += 1) g.add(cube(.62 - i * .06, .014, .035, MAT.metal, -.05, .032, -.2 + i * .16));
  if (kind === 'notice') {
    const stamp = mesh(new THREE.TorusGeometry(.11, .025, 8, 20), MAT.red, .28, .04, .34); stamp.rotation.x = Math.PI / 2; g.add(stamp);
  } else g.add(cube(.16, .026, .16, MAT.amber, .36, .035, .43));
  return g;
}

function phone() {
  const g = group('phone'); g.rotation.x = -.18;
  g.add(cube(.56, .12, .92, MAT.dark)); g.add(cube(.46, .02, .63, MAT.cyan, 0, .071, -.06));
  g.add(mesh(new THREE.CylinderGeometry(.055, .055, .025, 16), MAT.white, 0, .075, .36)); return g;
}

function medicine() {
  const g = group('medicine'); g.add(cube(.86, .48, .58, MAT.white));
  g.add(cube(.36, .035, .09, MAT.red, 0, .26, 0)); g.add(cube(.09, .035, .34, MAT.red, 0, .26, 0));
  g.add(cube(.72, .02, .06, MAT.cyan, 0, .255, -.2)); return g;
}

function bowl() {
  const profile = [new THREE.Vector2(.18, 0), new THREE.Vector2(.43, .08), new THREE.Vector2(.55, .32), new THREE.Vector2(.58, .38)];
  const g = group('bowl'); g.add(mesh(new THREE.LatheGeometry(profile, 32), MAT.white, 0, -.28, 0));
  const rim = mesh(new THREE.TorusGeometry(.58, .035, 8, 32), MAT.cyan, 0, .1, 0); rim.rotation.x = Math.PI / 2; g.add(rim); return g;
}

function fruit() {
  const g = group('fruit'); g.add(mesh(new THREE.CylinderGeometry(.65, .48, .12, 28), MAT.white, 0, -.3, 0));
  [[-.24,0,.05,0xe37c42],[.2,.03,.08,0xe6b44f],[0,.12,-.18,0xc95b56]].forEach(([x,y,z,c]) => g.add(mesh(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshStandardMaterial({ color:c, roughness:.72 }), x, y, z)));
  const leaf = cube(.18, .025, .09, new THREE.MeshStandardMaterial({ color:0x6f9a62 }), .12, .31, -.14); leaf.rotation.y = .5; g.add(leaf); return g;
}

function water() {
  const g = group('water'); g.add(mesh(new THREE.CylinderGeometry(.31, .27, .72, 24, 1, true), MAT.glass));
  g.add(mesh(new THREE.CylinderGeometry(.27, .25, .46, 24), new THREE.MeshPhysicalMaterial({ color:0x50cde8, transparent:true, opacity:.55, depthWrite:false }), 0, -.1, 0)); return g;
}

function reminderBoard() {
  const g = group('family_calendar'); g.add(cube(1.32, .88, .12, MAT.wood, 0, .12, 0));
  for (let i = 0; i < 4; i += 1) g.add(cube(.29, .24, .025, i % 2 ? MAT.amber : MAT.cyan, (i % 2 - .5) * .48, .28 - Math.floor(i / 2) * .35, .08));
  return g;
}

function tray(which) { const g = group(which); g.add(cube(1.2, .12, .76, MAT.wood, 0, -.3, 0)); const item = which === 'father_return' ? phone() : paperSheet(); item.scale.setScalar(.72); item.position.y = -.12; g.add(item); return g; }

function hintPanel() {
  const g = group('father_hint'); g.add(cube(1.1, .68, .07, new THREE.MeshPhysicalMaterial({ color:0x64d8ef, transparent:true, opacity:.34, emissive:0x0e6678, emissiveIntensity:.7 }), 0, .05, 0));
  g.add(cube(.62, .04, .02, MAT.white, 0, .18, .05)); g.add(cube(.42, .04, .02, MAT.white, -.1, 0, .05)); return g;
}

function shredder() { const g = group('discard'); g.add(cube(.86, .78, .7, MAT.dark, 0, -.05, 0)); g.add(cube(.58, .04, .12, MAT.red, 0, .36, 0)); for (let i=0;i<3;i+=1) g.add(cube(.12,.3,.03,MAT.paper,(i-1)*.18,-.55,.05)); return g; }

function chair() {
  const g = group('keep'); g.add(cube(.82, .13, .78, MAT.wood, 0, -.05, 0)); g.add(cube(.82, .92, .13, MAT.wood, 0, .43, .33));
  [[-.32,-.52,-.28],[.32,-.52,-.28],[-.32,-.52,.28],[.32,-.52,.28]].forEach(([x,y,z]) => g.add(cube(.1,.88,.1,MAT.wood,x,y,z)));
  const halo = mesh(new THREE.TorusGeometry(.68,.035,8,32),MAT.amber,0,.08,0); halo.rotation.x=Math.PI/2; g.add(halo); return g;
}

export function createPropModel(id) {
  const makers = {
    bowl, fruit, water, phone, medicine,
    application: () => paperSheet('application'), notice: () => paperSheet('notice'),
    family_calendar: reminderBoard, father_return: () => tray('father_return'), father_hint: hintPanel,
    brother_return: () => tray('brother_return'), discard: shredder, keep: chair, brother_message: phone
  };
  const model = (makers[id] || (() => { const g=group(id); g.add(cube(.8,.5,.8,MAT.white)); return g; }))();
  model.userData.propId = id; return model;
}

export function createDiningSet() {
  const g = group('dining_set'); g.add(cube(6.2,.08,4.1,new THREE.MeshStandardMaterial({color:0x58463c,roughness:.92}),0,.03,0));
  g.add(cube(4.6,.18,2.25,MAT.wood,0,1.02,0)); [[-1.85,.5,-.78],[1.85,.5,-.78],[-1.85,.5,.78],[1.85,.5,.78]].forEach(([x,y,z])=>g.add(cube(.18,1,.18,MAT.wood,x,y,z)));
  [[-2.7,0],[2.7,0],[0,-1.7],[0,1.7]].forEach(([x,z],i)=>{const c=chair();c.scale.setScalar(.72);c.position.set(x,.5,z);c.rotation.y=i<2?Math.PI/2:0;g.add(c);}); return g;
}

export function createCorridorDetails() {
  const g = group('corridor_details');
  const gaps = [[28,30],[39,41.2],[51,53.2],[62,67.5]];
  const overlapsGap = (z, half) => gaps.some(([a,b]) => z + half > a && z - half < b);
  for (let z=-1;z<89;z+=3) {
    if (overlapsGap(z, 1.36)) continue;
    const tile=cube(18,.035,2.72,new THREE.MeshStandardMaterial({color:z<9?0x5c554b:0x263645,roughness:.75,metalness:.12}),0,.02,z); g.add(tile);
  }
  for (let z=10;z<89;z+=4) {
    if (overlapsGap(z, 1.1)) continue;
    g.add(cube(.08,.05,2.2,MAT.cyan,-8.75,.08,z),cube(.08,.05,2.2,MAT.cyan,8.75,.08,z));
  }
  for (const z of [27.75,30.25,38.75,41.45,50.75,53.45,61.75,67.75]) for(let i=-4;i<=4;i+=1){const shard=cube(1.7,.24,.5,i%2?MAT.dark:MAT.metal,i*1.8,.05,z);shard.rotation.y=(i%3-.8)*.18;g.add(shard);} return g;
}

export function createExitGate() {
  const g = group('exit_gate'); g.add(cube(.45,4.5,.5,MAT.metal,-5.6,2.25,0),cube(.45,4.5,.5,MAT.metal,5.6,2.25,0),cube(11.65,.45,.5,MAT.metal,0,4.3,0));
  const core=cube(10.4,3.55,.12,new THREE.MeshPhysicalMaterial({color:0x17303d,transparent:true,opacity:.78,emissive:0x0b5468,emissiveIntensity:.35}),0,2.1,0);g.add(core);return g;
}
