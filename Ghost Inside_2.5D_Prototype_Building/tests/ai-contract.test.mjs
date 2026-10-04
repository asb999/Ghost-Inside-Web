import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_EFFECTS,
  FALLBACK_MODE_LABEL,
  validateAIResponse,
} from '../src/ai-contract.js';
import { EVIDENCE, FIXED_FACTS, TIMELINE } from '../src/game-data.js';

test('固定事实包含四个时刻且不把父亲动机写成已知', () => {
  const serialized = JSON.stringify({ FIXED_FACTS, EVIDENCE, TIMELINE });
  for (const time of ['19:10', '19:11', '19:12', '19:13']) {
    assert.match(serialized, new RegExp(time.replace(':', '\\:')));
  }
  assert.match(serialized, /今晚再确认一下返工方案/);
  assert.match(serialized, /先吃，明天再说成绩/);
  assert.doesNotMatch(serialized, /父亲(其实|只是).*(爱|工作忙|失望)/);
  assert.doesNotMatch(serialized, /道歉|疾病|家庭秘密/);
});

test('AI 回应不能引用尚未解锁的证据', () => {
  const result = validateAIResponse(
    { reply: '看看餐盘。', citedEvidence: ['M05'], effects: [] },
    { unlockedEvidenceIds: ['M01', 'M02'] },
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /M05|未解锁|尚未发现/);
});

test('AI 回应拒绝未知效果及同时启用两个结局效果', () => {
  const unknown = validateAIResponse(
    { reply: '完成。', evidenceIds: [], effects: ['rewrite_past'] },
    { unlockedEvidenceIds: [] },
  );
  assert.equal(unknown.ok, false);

  const stacked = validateAIResponse(
    { reply: '完成。', evidenceIds: [], effects: ['release_voice', 'release_exit'] },
    { unlockedEvidenceIds: [] },
  );
  assert.equal(stacked.ok, false);
  assert.deepEqual([...ALLOWED_EFFECTS].sort(), ['release_exit', 'release_voice']);
});

test('备用模式必须持续显示明确标识', () => {
  assert.equal(FALLBACK_MODE_LABEL, '备用互动');
});

