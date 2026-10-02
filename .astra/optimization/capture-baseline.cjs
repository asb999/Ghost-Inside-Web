const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const assert = require('assert');

const output = '.astra/optimization/baseline.json';
const addedHarness = '.astra/harness/check-optimization-plan.sh';
const roots = ['game/web/src', '.astra/harness'];
const fixed = [
  '.astra/PLAN.md',
  '.astra/DECISIONS.md',
  '_gdd_import.md',
  '.workbuddy/memory/MEMORY.md',
  'game/data/cases/case_001_optimal_life.json',
  'game/web/package.json'
];

function walk(dir) {
  return fs.readdirSync(dir).sort().reduce((out, name) => {
    const file = path.posix.join(dir, name);
    if (file === addedHarness) return out;
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Review symlink before capture: ' + file);
    return out.concat(stat.isDirectory() ? walk(file) : [file]);
  }, []);
}

const paths = Array.from(new Set(fixed.concat(...roots.map(walk)))).sort();
const files = {};
for (const file of paths) {
  files[file] = crypto.createHash('sha256')
    .update(fs.readFileSync(file)).digest('hex');
}

fs.mkdirSync('.astra/optimization', { recursive: true });

if (fs.existsSync(output)) {
  const prior = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.deepStrictEqual(prior.files, files, 'Baseline changed; do not overwrite');
} else {
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim();
  fs.writeFileSync(output, JSON.stringify({
    schemaVersion: 1,
    head,
    files
  }, null, 2) + '\n', { flag: 'wx' });
}
