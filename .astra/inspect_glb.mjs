import fs from 'node:fs';
const file = process.argv[2];
const data = fs.readFileSync(file);
if (data.readUInt32LE(0) !== 0x46546c67) throw new Error('Not GLB');
const jsonLength = data.readUInt32LE(12);
const jsonType = data.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) throw new Error('Missing JSON chunk');
const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8').trimEnd());
const nodes = (gltf.nodes || []).map((node, index) => ({ index, name: node.name || '', mesh: node.mesh, skin: node.skin, children: node.children || [] }));
const skins = (gltf.skins || []).map((skin) => ({ name: skin.name || '', joints: skin.joints.map((joint) => nodes[joint]?.name) }));
const animations = (gltf.animations || []).map((animation) => ({
  name: animation.name,
  channels: animation.channels.length,
  inputs: [...new Set(animation.samplers.map((sampler) => sampler.input))].map((index) => ({ index, count: gltf.accessors[index]?.count, min: gltf.accessors[index]?.min, max: gltf.accessors[index]?.max })),
  targets: [...new Set(animation.channels.map((channel) => nodes[channel.target.node]?.name))]
}));
console.log(JSON.stringify({ nodes, skins, animations }, null, 2));
