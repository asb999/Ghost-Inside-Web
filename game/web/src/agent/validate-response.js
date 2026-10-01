// validate-response.js — provider 受限输出的严格校验
// 合法输出：{ verdict, feedback_key, evidence_ids }，无任何额外字段。
export function validateProviderResponse(raw, { templates, unlocked, maxBytes = 16 * 1024 } = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('not_object');
  }
  const keys = Object.keys(raw).sort();
  const expected = ['evidence_ids', 'feedback_key', 'verdict'].sort();
  if (keys.length !== 3 || keys.some((k, i) => k !== expected[i])) {
    throw new Error('unexpected_fields');
  }
  const { verdict, feedback_key, evidence_ids } = raw;
  if (typeof verdict !== 'string' || !['accept', 'revise', 'hold'].includes(verdict)) {
    throw new Error('bad_verdict');
  }
  if (typeof feedback_key !== 'string') throw new Error('bad_key');
  const tpl = templates[feedback_key];
  if (!tpl || tpl.verdict !== verdict) throw new Error('template_mismatch');
  if (!Array.isArray(evidence_ids) || evidence_ids.length === 0) {
    throw new Error('no_evidence');
  }
  const seen = new Set();
  for (const id of evidence_ids) {
    if (typeof id !== 'string' || seen.has(id)) throw new Error('bad_evidence');
    seen.add(id);
    if (!unlocked.includes(id)) throw new Error('locked_evidence');
  }
  if (JSON.stringify(raw).length > maxBytes) throw new Error('too_large');
  return { verdict, feedback_key, evidence_ids: [...seen] };
}
