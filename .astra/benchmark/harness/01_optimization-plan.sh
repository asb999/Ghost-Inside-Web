#!/usr/bin/env bash
#!/usr/bin/env bash
set -u

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '[FAIL] C00 inputs'
  exit 1
fi

node --input-type=commonjs <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

let failed = false;
let baseline = {};
let contract = {};
let document = '';

function check(name, fn) {
  try {
    fn();
    console.log('[PASS] ' + name);
  } catch (_) {
    failed = true;
    console.log('[FAIL] ' + name);
  }
}
function text(value) {
  return typeof value === 'string' && value.trim().length >= 8;
}
function unique(values) {
  return new Set(values).size === values.length;
}
function hash(file) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(file)).digest('hex');
}
function walk(dir) {
  return fs.readdirSync(dir).sort().reduce((out, name) => {
    const file = path.posix.join(dir, name);
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink());
    return out.concat(stat.isDirectory() ? walk(file) : [file]);
  }, []);
}
function anchor(value) {
  assert(value && Object.prototype.hasOwnProperty.call(
    baseline.files, value.path
  ));
  assert(text(value.quote));
  assert(fs.readFileSync(value.path, 'utf8').includes(value.quote));
}
function sameSet(a, b) {
  assert(unique(a));
  assert(unique(b));
  assert.deepStrictEqual(a.slice().sort(), b.slice().sort());
}

const headers = [
  '## [S1] 傻瓜级步骤 Fool-proof Steps',
  '## [S2] 工具预调清单 Tool Preflight',
  '## [S3] 知识库检索清单 Knowledge Retrieval',
  '## [S4] 技术细节 Technical Details',
  '## [S5] 模具清单 Templates',
  '## [S6] 自检 Harness Self-check Harness',
  '## [S7] 成功标准 Success Criteria',
  '## [S8] 风险与回滚 Risks & Rollback'
];
const checkIds = [
  'C00', 'C01', 'C02', 'C03', 'C04',
  'C05', 'C06', 'C07', 'C08', 'C09'
];

check('C00 inputs', () => {
  assert(fs.statSync('game/web/src').isDirectory());
  baseline = JSON.parse(fs.readFileSync(
    '.astra/optimization/baseline.json', 'utf8'
  ));
  contract = JSON.parse(fs.readFileSync(
    '.astra/optimization/contract.json', 'utf8'
  ));
  document = fs.readFileSync('.astra/optimization/plan.md', 'utf8');
  assert.strictEqual(baseline.schemaVersion, 1);
  assert.strictEqual(contract.schemaVersion, 1);
  assert(baseline.files && /^[a-f0-9]{40,64}$/.test(baseline.head));
});

check('C01 layout', () => {
  assert(/^# PLAN\r?\n/.test(document));
  const found = document.split(/\r?\n/).filter(line => /^## /.test(line));
  assert.deepStrictEqual(found, headers);
  const section = document.split(headers[6])[1].split(headers[7])[0];
  const ids = [];
  const pattern = /^\| `(C\d\d)` \|/gm;
  let match;
  while ((match = pattern.exec(section))) ids.push(match[1]);
  assert.deepStrictEqual(ids, checkIds);
});

check('C02 baseline', () => {
  const required = [
    '.astra/PLAN.md', '.astra/DECISIONS.md', '_gdd_import.md',
    '.workbuddy/memory/MEMORY.md',
    'game/data/cases/case_001_optimal_life.json',
    'game/web/package.json'
  ];
  for (const file of required) assert(baseline.files[file]);
  for (const file of Object.keys(baseline.files)) {
    assert.strictEqual(hash(file), baseline.files[file]);
  }
  const actual = walk('game/web/src').concat(walk('.astra/harness'))
    .filter(file => file !== '.astra/harness/check-optimization-plan.sh');
  const recorded = Object.keys(baseline.files).filter(file =>
    file.startsWith('game/web/src/') || file.startsWith('.astra/harness/')
  );
  assert(actual.some(file => file.startsWith('game/web/src/')));
  assert(actual.some(file => file.startsWith('.astra/harness/')));
  sameSet(actual, recorded);
});

check('C03 evidence', () => {
  assert.strictEqual(contract.status, 'ready');
  sameSet(contract.readEvidence.map(row => row.path),
    Object.keys(baseline.files));
  for (const row of contract.readEvidence) {
    assert.strictEqual(row.sha256, baseline.files[row.path]);
    assert(text(row.summary));
    if (row.kind !== 'asset') anchor(row);
  }
});

check('C04 locks_inventory', () => {
  assert.strictEqual(contract.locks.length, 16);
  assert.strictEqual(contract.redlines.length, 3);
  assert.strictEqual(contract.legacyChecks.length, 17);
  const rules = contract.locks.concat(contract.redlines);
  assert(unique(rules.map(row => row.id)));
  rules.forEach(anchor);
  assert(unique(contract.legacyChecks.map(row => row.id)));
  assert(unique(contract.legacyChecks.map(row =>
    row.anchor.path + '\n' + row.anchor.quote
  )));
  for (const row of contract.legacyChecks) {
    anchor(row.anchor);
    assert(row.anchor.path.startsWith('.astra/harness/'));
    assert(Array.isArray(row.command) && row.command.length > 0);
    assert(row.command.every(value =>
      typeof value === 'string' && value.length > 0));
    assert(typeof row.cwd === 'string' && row.cwd.length > 0);
  }
});

check('C05 sources', () => {
  assert(unique(contract.sources.map(row => row.id)));
  for (const row of contract.sources) {
    assert(/^https:\/\//.test(row.url));
    assert(['verified', 'unavailable'].includes(row.status));
    assert(text(row.note));
  }
  for (const game of ['It Takes Two', 'Split Fiction']) {
    assert(contract.sources.some(row =>
      row.game === game && row.status === 'verified'));
  }
  for (const code of [
    '9TDVyK2JGmy', 'DpsnqRN9bo', '9QJIRS0u2xK',
    '7dMDmabcj5d', '7HOPhvthlIK', 'Ap5nKkogoHR', '2BjnG9fthbJ'
  ]) {
    assert(contract.sources.some(row =>
      row.url === 'https://xhslink.cn/o/' + code));
  }
});

check('C06 traceability', () => {
  assert(contract.items.length > 0);
  assert(unique(contract.items.map(row => row.id)));
  const ruleIds = contract.locks.concat(contract.redlines).map(row => row.id);
  for (const row of contract.items) {
    assert(['retain', 'enhance', 'defer'].includes(row.classification));
    for (const key of ['design', 'translation', 'delta']) assert(text(row[key]));
    assert(typeof row.beat === 'string' && row.beat.trim().length > 0);
    anchor(row.current);
    assert(row.sourceIds.length > 0);
    for (const id of row.sourceIds) {
      assert(contract.sources.some(source =>
        source.id === id && source.status === 'verified'));
    }
    sameSet(row.compatibility.map(rule => rule.id), ruleIds);
    for (const rule of row.compatibility) {
      assert.strictEqual(rule.result, 'preserved');
      assert(text(rule.reason));
    }
  }
});

check('C07 feasibility', () => {
  const rank = { P0: 0, P1: 1, P2: 2 };
  const items = new Map(contract.items.map(row => [row.id, row]));
  for (const priority of Object.keys(rank)) {
    assert(contract.items.some(row => row.priority === priority));
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    assert(items.has(id) && !visiting.has(id));
    if (visited.has(id)) return;
    visiting.add(id);
    const row = items.get(id);
    assert(Object.prototype.hasOwnProperty.call(rank, row.priority));
    assert(Array.isArray(row.hours) && row.hours.length === 2);
    assert(row.hours.every(Number.isFinite));
    assert(row.hours[0] >= 0 && row.hours[1] >= row.hours[0]);
    if (row.classification === 'enhance') assert(row.hours[1] > 0);
    assert(typeof row.selected === 'boolean');
    if (row.selected) {
      assert.strictEqual(row.classification, 'enhance');
      assert(row.priority !== 'P2');
    }
    assert(Array.isArray(row.dependsOn));
    for (const dependency of row.dependsOn) {
      assert(items.has(dependency));
      const prior = items.get(dependency);
      assert(rank[prior.priority] <= rank[row.priority]);
      if (row.selected) assert(prior.selected || prior.classification === 'retain');
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of items.keys()) visit(id);
  const budget = contract.budget;
  assert([budget.availableHours, budget.verificationHours, budget.reserveHours]
    .every(Number.isFinite));
  assert(budget.availableHours > 0);
  assert(budget.verificationHours > 0 && budget.reserveHours > 0);
  const upper = contract.items.filter(row => row.selected)
    .reduce((sum, row) => sum + row.hours[1], 0);
  assert(upper + budget.verificationHours + budget.reserveHours
    <= budget.availableHours);
});

check('C08 acceptance', () => {
  const ids = [];
  for (const row of contract.items) {
    assert(row.acceptance.length > 0);
    for (const criterion of row.acceptance) {
      ids.push(criterion.id);
      assert(typeof criterion.id === 'string' && criterion.id.length > 0);
      assert(['machine', 'manual'].includes(criterion.kind));
      for (const key of ['setup', 'action', 'expected']) assert(text(criterion[key]));
      if (criterion.kind === 'machine') assert(text(criterion.command));
    }
  }
  assert(unique(ids));
  assert.strictEqual(contract.review.confirmed, true);
  assert(typeof contract.review.reviewer === 'string');
  assert(contract.review.reviewer.trim().length >= 2);
});

check('C09 gdd', () => {
  const gdd = contract.gdd;
  assert.strictEqual(gdd.tensions.length, 4);
  assert.strictEqual(gdd.acts.length, 5);
  const tensions = gdd.tensions.map(row => row.id);
  const acts = gdd.acts.map(row => row.id);
  assert(unique(tensions) && unique(acts));
  for (const row of gdd.tensions.concat(gdd.acts)) {
    assert.strictEqual(row.path, '_gdd_import.md');
    anchor(row);
  }
  assert.strictEqual(gdd.matrix.length, 20);
  assert(unique(gdd.matrix.map(row => row.tensionId + ':' + row.actId)));
  for (const row of gdd.matrix) {
    assert(tensions.includes(row.tensionId));
    assert(acts.includes(row.actId));
    assert(text(row.coverage));
  }
  for (const row of contract.items.filter(item => item.priority === 'P2')) {
    assert(row.gddAnchors.length > 0);
    for (const reference of row.gddAnchors) {
      assert.strictEqual(reference.path, '_gdd_import.md');
      anchor(reference);
    }
  }
});

process.exitCode = failed ? 1 : 0;
NODE
