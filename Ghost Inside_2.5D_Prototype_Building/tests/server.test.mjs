import test from 'node:test';
import assert from 'node:assert/strict';

import { createAppServer } from '../server.mjs';

// 这些是服务端接口集成测试：用注入的 mock fetch 模拟 provider，
// 覆盖正常、超时、非法引用、越界动作与未配置回退。
// mock 结果不代表真实 LLM 已验证；真实 provider 行为仍需人工检查（见 MANUAL_CHECKLIST.md）。

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen(`http://127.0.0.1:${server.address().port}`));
  });
}

async function post(url, payload) {
  const response = await fetch(`${url}/api/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

const inquirePayload = {
  mode: 'inquire',
  target: 'father',
  question: '你当时为什么不说话？',
  moment: '19:11',
  unlockedEvidence: ['M01', 'M02'],
};

const reconstructPayload = {
  mode: 'reconstruct',
  text: '即使这次没有达到期待，也不能说明我不值得被爱。',
  unlockedEvidence: ['M01', 'M03'],
  selectedEvidence: ['M01', 'M03'],
  inference: 'worth_depends_on_performance',
  action: 'speak',
};

test('未配置 provider 时返回备用互动并明确标识，自由追问可解锁 M05', async () => {
  const server = createAppServer({ env: {} });
  const url = await listen(server);
  try {
    const inquiry = await post(url, {
      mode: 'inquire',
      target: 'linche',
      question: '他是不是整晚都没有理我？餐盘那边还有别的记录吗？',
      moment: '19:13',
      unlockedEvidence: ['M01'],
    });
    assert.equal(inquiry.status, 200);
    assert.equal(inquiry.body.source, 'backup');
    assert.equal(inquiry.body.modeLabel, '备用互动');
    assert.equal(inquiry.body.fallbackReason, 'not_configured');
    assert.ok(inquiry.body.unlockEvidence.includes('M05'), '针对性追问应解锁 M05');

    const status = await (await fetch(`${url}/api/status`)).json();
    assert.equal(status.providerConfigured, false);
    assert.equal(status.mode, 'backup');
  } finally {
    server.close();
  }
});

test('mock provider 正常回应时通过校验并以实时 AI 标识返回', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      reply: '记录只能确认我沉默了，不能说明我的全部想法。',
      citedEvidence: ['M02'],
      unlockEvidence: [],
      effects: [],
      validation: 'supported',
    }),
  });
  const server = createAppServer({ env: { GHOST_AI_URL: 'http://mock-provider.local' }, fetch: fetchImpl });
  const url = await listen(server);
  try {
    const result = await post(url, inquirePayload);
    assert.equal(result.status, 200);
    assert.equal(result.body.source, 'live');
    assert.equal(result.body.modeLabel, '实时 AI');
    assert.equal(result.body.reply, '记录只能确认我沉默了，不能说明我的全部想法。');
  } finally {
    server.close();
  }
});

test('provider 超时时回退备用互动，不丢请求状态', async () => {
  let aborted = false;
  const fetchImpl = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      aborted = true;
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
  const server = createAppServer({
    env: { GHOST_AI_URL: 'http://mock-provider.local', GHOST_AI_TIMEOUT_MS: '50' },
    fetch: fetchImpl,
  });
  const url = await listen(server);
  try {
    const result = await post(url, reconstructPayload);
    assert.equal(result.body.source, 'backup');
    assert.equal(result.body.fallbackReason, 'timeout');
    assert.ok(aborted, '超时后应真正中断对 provider 的请求');
    assert.ok(result.body.reply.length > 0, '备用回应应有内容');
  } finally {
    server.close();
  }
});

test('provider 引用未解锁证据时被拒绝并回退，不写入玩家选择', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      reply: '看看 19:13 的餐盘吧。',
      citedEvidence: ['M05'],
      unlockEvidence: ['M05'],
      effects: [],
    }),
  });
  const server = createAppServer({ env: { GHOST_AI_URL: 'http://mock-provider.local' }, fetch: fetchImpl });
  const url = await listen(server);
  try {
    const result = await post(url, inquirePayload);
    assert.equal(result.body.source, 'backup');
    assert.equal(result.body.fallbackReason, 'invalid_provider_response');
    assert.ok(Array.isArray(result.body.providerErrors) && result.body.providerErrors.length > 0);
    assert.ok(!result.body.unlockEvidence?.includes('M05'), '非法解锁不得生效');
  } finally {
    server.close();
  }
});

test('provider 越界动作与双效果同时开启时被拒绝并回退', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      reply: '两道门都打开，过去也改变了。',
      citedEvidence: ['M01', 'M03'],
      effects: ['release_voice', 'release_exit', 'rewrite_past'],
      supportedActions: ['speak', 'pause', 'hug'],
    }),
  });
  const server = createAppServer({ env: { GHOST_AI_URL: 'http://mock-provider.local' }, fetch: fetchImpl });
  const url = await listen(server);
  try {
    const result = await post(url, reconstructPayload);
    assert.equal(result.body.source, 'backup');
    assert.equal(result.body.fallbackReason, 'invalid_provider_response');
    assert.ok(result.body.providerErrors.some((message) => /范围外|一次重构只能/.test(message)), JSON.stringify(result.body.providerErrors));
  } finally {
    server.close();
  }
});

test('provider 回应包含固定世界之外的事实时被拒绝', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      reply: '其实父亲第二天就道歉了，他只是工作忙。',
      citedEvidence: [],
      effects: [],
    }),
  });
  const server = createAppServer({ env: { GHOST_AI_URL: 'http://mock-provider.local' }, fetch: fetchImpl });
  const url = await listen(server);
  try {
    const result = await post(url, inquirePayload);
    assert.equal(result.body.source, 'backup');
    assert.equal(result.body.fallbackReason, 'invalid_provider_response');
  } finally {
    server.close();
  }
});

test('非法请求返回 400 且不触发 provider', async () => {
  let providerCalled = false;
  const fetchImpl = async () => { providerCalled = true; return { ok: true, json: async () => ({}) }; };
  const server = createAppServer({ env: { GHOST_AI_URL: 'http://mock-provider.local' }, fetch: fetchImpl });
  const url = await listen(server);
  try {
    const result = await post(url, { mode: 'inquire', target: 'lin', question: '测试', unlockedEvidence: [] });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'invalid_request');
    assert.equal(providerCalled, false, '非法请求不得转发给 provider');

    const oversize = await post(url, { ...reconstructPayload, text: '长'.repeat(201) });
    assert.equal(oversize.status, 400);
  } finally {
    server.close();
  }
});

test('重构请求引用未发现证据时被服务端拒绝（浏览器字段不可信）', async () => {
  const server = createAppServer({ env: {} });
  const url = await listen(server);
  try {
    const result = await post(url, { ...reconstructPayload, unlockedEvidence: ['M01'], selectedEvidence: ['M01', 'M05'] });
    assert.equal(result.status, 400);
    assert.ok(JSON.stringify(result.body.errors).match(/已经发现的证据/));
  } finally {
    server.close();
  }
});
