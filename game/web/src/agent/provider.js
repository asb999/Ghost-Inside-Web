// provider.js — 有截止时间的 provider 包装；未配置/超时/非法一律走固定回退
export async function requestFeedback({
  provider,
  request,
  validate,
  fallbacks,
  timeoutMs = 8000
}) {
  if (!provider) {
    return {
      source: 'unconfigured',
      verdict: 'hold',
      response: fallbacks.hold.response,
      evidence_ids: fallbacks.hold.evidence_ids
    };
  }

  const controller = new AbortController();
  const timeoutError = new Error('provider_timeout');
  let timeoutId;

  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(timeoutError);
      controller.abort(timeoutError);
    }, timeoutMs);
  });

  try {
    const raw = await Promise.race([
      Promise.resolve().then(() =>
        provider.request(request, { signal: controller.signal })
      ),
      deadline
    ]);

    const feedback = validate(raw, request);

    return {
      source: 'provider',
      verdict: feedback.verdict,
      feedback_key: feedback.feedback_key,
      response: null, // 由 feedback.js 按模板解析
      template_key: feedback.feedback_key,
      evidence_ids: feedback.evidence_ids
    };
  } catch (error) {
    const timedOut =
      error === timeoutError || controller.signal.reason === timeoutError;

    const fb = timedOut ? fallbacks.timeout : fallbacks.hold;
    return {
      source: timedOut ? 'timeout' : 'invalid_or_unavailable',
      verdict: 'hold',
      response: fb.response,
      evidence_ids: fb.evidence_ids
    };
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}
