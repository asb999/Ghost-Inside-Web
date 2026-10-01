import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const source = 'game/data/cases/white_corridor.json';
const target = '.astra/baselines/ghost-mvp.json';
const bytes = fs.readFileSync(source);
const data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const forbidden = [];

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function walk(value, pointer = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const path = `${pointer}/${escapePointer(key)}`;
    if (key === 'forbidden_actions') {
      forbidden.push({ pointer: path, value: child });
    }
    walk(child, path);
  }
}

for (const key of ['agent_contract', 'fallbacks', 'cards']) {
  assert.ok(Object.hasOwn(data, key), `Missing ${key}`);
}
walk(data);
assert.ok(forbidden.length > 0, 'No forbidden_actions found');

const current = { source, sha256, forbidden };

if (fs.existsSync(target)) {
  const baseline = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepEqual(current, baseline, 'Baseline mismatch');
  console.log('[baseline] verified:', sha256.slice(0, 12));
} else {
  fs.mkdirSync('.astra/baselines', { recursive: true });
  fs.writeFileSync(target, JSON.stringify(current, null, 2) + '\n', {
    flag: 'wx'
  });
  console.log('[baseline] created:', sha256.slice(0, 12));
}
