// feedback.js — 把 provider 结果或固定回退解析成最终反馈（模板匹配 + 证据核对）
export function resolveFeedback(result, caseView) {
  if (result.source === 'provider') {
    const tpl = caseView.feedbackTemplates[result.template_key];
    if (!tpl || tpl.verdict !== result.verdict) {
      const fb = caseView.fallbacks.hold;
      return { source: 'invalid_or_unavailable', verdict: 'hold', response: fb.response, evidence_ids: fb.evidence_ids };
    }
    return {
      source: result.source,
      verdict: tpl.verdict,
      response: tpl.response,
      evidence_ids: result.evidence_ids ?? tpl.evidence_ids
    };
  }
  // unconfigured / timeout / invalid_or_unavailable：response 已在 provider 中取自固定回退
  return { ...result };
}
