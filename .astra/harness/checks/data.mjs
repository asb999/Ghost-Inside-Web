// checks/data.mjs — 独立数据检查：H05_CASE_CONTRACT / H07_COPY_LINT / H08_BEAT_BUDGET
// 只用原始 JSON、基线与 contract-map 独立断言，不调用应用自身的 validate()。
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url)); // 仓库根
const NEW = 'game/data/cases/case_001_optimal_life.json';
const OLD = 'game/data/cases/white_corridor.json';

const map = JSON.parse(readFileSync(new URL('../contract-map.json', import.meta.url), 'utf8'));

function loadBytes(rel) {
  return fs.readFileSync(`${ROOT}${rel}`);
}
function loadJson(rel) {
  return JSON.parse(loadBytes(rel).toString('utf8').replace(/^\uFEFF/, ''));
}

// ── H05_CASE_CONTRACT ──
export function h05CaseContract() {
  const oldBytes = loadBytes(OLD);
  const oldSha = crypto.createHash('sha256').update(oldBytes).digest('hex');
  const baseline = JSON.parse(loadBytes(map.baseline_pointer).toString('utf8'));
  assert.equal(oldSha, baseline.sha256, '旧案例文件与基线不一致');

  const oldJson = loadJson(OLD);
  for (const [ptr, val] of baseline.forbidden.flatMap((f) =>
    f.value.map((v, i) => [`${f.pointer}/${i}`, v])
  )) {
    const part = ptr.replace(/^\/agent_contract\//, '').split('/');
    const actual = oldJson.agent_contract?.[part[0]]?.[Number(part[1])];
    assert.equal(actual, val, `基线指针失配: ${ptr}`);
  }

  const c = loadJson(NEW);
  assert.equal(c.case_id, 'case_001_optimal_life');
  // 旧结构继承：三个核心键存在且结构一致
  for (const key of ['agent_contract', 'fallbacks', 'cards']) {
    assert.ok(c[key], `新案例缺少 ${key}`);
  }
  assert.deepEqual(c.agent_contract.allowed_results, oldJson.agent_contract.allowed_results);
  assert.deepEqual(c.agent_contract.forbidden_actions, oldJson.agent_contract.forbidden_actions);
  assert.equal(c.agent_contract.max_free_text_chars, oldJson.agent_contract.max_free_text_chars);
  // 四种回退齐全
  for (const k of ['accept', 'revise', 'hold', 'timeout']) {
    const fb = c.fallbacks[k];
    assert.ok(fb && Array.isArray(fb.evidence_ids) && fb.evidence_ids.length > 0 && typeof fb.response === 'string' && fb.response.length > 0, `fallbacks.${k} 不完整`);
  }
  // 卡片 ID 唯一
  const ids = ['facts', 'feelings', 'boundaries'].flatMap((t) => c.cards[t].map((x) => x.id));
  assert.equal(new Set(ids).size, ids.length, '卡片 ID 重复');
  assert.ok(ids.includes('R01'), '缺少揭示记录卡 R01');
  // 47 条记录，修改人全部是林澈
  assert.equal(c.reveal.records.length, 47, '修改记录不是 47 条');
  const recIds = c.reveal.records.map((r) => r.id);
  assert.equal(new Set(recIds).size, 47, '记录 ID 重复');
  for (const r of c.reveal.records) {
    assert.equal(r.editor_id, 'lin_che', `记录 ${r.id} 修改人不是林澈`);
  }
  // 回退引用的证据在合法路径上均已解锁（unlock_event 不是 none）
  const unlockMap = new Map(ids.map((id) => [id, true]));
  const cardBy = Object.fromEntries(
    ['facts', 'feelings', 'boundaries'].flatMap((t) => c.cards[t].map((x) => [x.id, x]))
  );
  const alwaysUnlocked = new Set(['R01', 'F02', 'F03', 'F01', 'E01', 'E02', 'E03', 'B01']); // 主路径完成时全部解锁
  for (const [k, fb] of Object.entries(c.fallbacks)) {
    for (const id of fb.evidence_ids) {
      assert.ok(unlockMap.has(id), `fallbacks.${k} 引用未知证据 ${id}`);
      assert.ok(alwaysUnlocked.has(id), `fallbacks.${k} 引用了主路径不解锁的证据 ${id}`);
      assert.equal(cardBy[id].unlock_event !== 'none', true, `fallbacks.${k} 引用了永不解锁的证据 ${id}`);
    }
  }
  return { records: c.reveal.records.length };
}

// ── H07_COPY_LINT ──
const BANNED = ['\u6cbb\u7597', '\u6cbb\u6108', '\u7642\u6548', '\u8bca\u65ad', '\u6291\u90c1', '\u7126\u8651\u75c7', '\u6cbb\u7652', '\u7642\u7652'];
// 治疗治瘳/治愈/疗效/诊断/抑郁/焦虑症 + 繁体 治療/治癒/療效/診斷/抑鬱
export function h07CopyLint() {
  const excluded = new Set(map.lint.exclude_pointers);
  const hits = [];
  let scanned = 0;

  function scanValue(value, pointer) {
    if (typeof value === 'string') {
      scanned += 1;
      // DECISIONS #7 唯一豁免：agent_contract.forbidden_actions 及其元素（AI 规则字段，永不渲染）
      if ([...excluded].some((p) => pointer === p || pointer.startsWith(`${p}/`))) return;
      for (const word of BANNED) {
        if (value.includes(word)) hits.push({ pointer, word });
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((v, i) => scanValue(v, `${pointer}/${i}`));
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) scanValue(v, `${pointer}/${k}`);
    }
  }
  scanValue(loadJson(NEW), '');

  // 豁免指针必须真实存在于基线（防止用豁免掩盖违规）
  const baseline = JSON.parse(loadBytes(map.baseline_pointer).toString('utf8'));
  const baselinePointer = '/agent_contract/forbidden_actions';
  assert.ok(baseline.forbidden.some((f) => f.pointer === baselinePointer), '豁免指针不在基线中');

  // 网页发布文案（src 全部源文件 + index.html + README + 走查表）
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(js|mjs|html|md|css|json)$/.test(e.name) && !/node_modules|dist/.test(p)) files.push(p);
    }
  };
  walk(`${ROOT}game/web/src`);
  files.push(`${ROOT}game/web/index.html`, `${ROOT}game/web/README.md`, `${ROOT}DEMO_CHECKLIST.md`);
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    scanned += 1;
    const text = fs.readFileSync(f, 'utf8');
    for (const word of BANNED) {
      if (text.includes(word)) hits.push({ pointer: f.replace(ROOT, ''), word });
    }
  }
  assert.ok(scanned > 0, '扫描数为零');
  assert.deepEqual(hits, [], `禁词命中: ${JSON.stringify(hits)}`);
  return { scanned };
}

// ── H08_BEAT_BUDGET ──
export function h08BeatBudget() {
  const c = loadJson(NEW);
  const expected = ['life_slice', 'garden', 'collector', 'dinner', 'pollution', 'statement', 'epilogue'];
  assert.deepEqual(c.beats.map((b) => b.id), expected, '节拍顺序不符');
  let total = 0;
  for (const b of c.beats) {
    assert.equal(typeof b.budget_seconds, 'number');
    assert.ok(Number.isFinite(b.budget_seconds) && b.budget_seconds > 0, `${b.id} 预算非法`);
    total += b.budget_seconds;
  }
  assert.ok(total >= 300 && total <= 420, `总预算 ${total} 不在 [300,420]`);
  assert.equal(c.statement.no_auto_submit !== false, true, '表态不允许自动提交');
  return { total };
}
