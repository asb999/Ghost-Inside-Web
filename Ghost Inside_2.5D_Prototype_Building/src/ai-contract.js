export const FALLBACK_MODE_LABEL = '备用互动';

export const EVIDENCE_IDS = Object.freeze([
  'M01',
  'M02',
  'M03',
  'M04',
  'M05',
  'M06',
]);

export const ALLOWED_EFFECTS = Object.freeze([
  'release_voice',
  'release_exit',
]);

export const ALLOWED_ACTIONS = Object.freeze([
  'speak',
  'pause',
]);

export const ALLOWED_INFERENCES = Object.freeze([
  'silence_means_disappointment',
  'worth_depends_on_performance',
]);

export const FIXED_FACTS = Object.freeze({
  M01: '19:10，成绩低于林澈自己的预期；成绩单没有对人格价值作出评价。',
  M02: '19:11，父亲看过成绩单后沉默；记录没有说明他的全部动机。',
  M03: '林澈记得父亲整晚没有再理他，并把沉默理解为失望、不够好和不配坐在这里。',
  M04: '19:12，手机显示工作消息：“今晚再确认一下返工方案。”这不能证明沉默只是因为工作。',
  M05: '19:13，父亲推近餐盘，说：“先吃，明天再说成绩。”林澈回答：“我不饿。”',
  M06: '林澈说：“我以为必须一直达标，才值得被爱。”这是他的自我报告。',
});

const ALLOWED_CHECKS = new Set([
  'report',
  'father',
  'linche',
  'phone',
  'plate',
  'replay_1910',
  'replay_1911',
  'replay_1912',
  'replay_1913',
  'evidence',
  'belief',
]);

const FORBIDDEN_CLAIMS = [
  /父亲.{0,8}(道歉|后悔|生病|患病|去世|抛弃|从未爱|不爱他|无条件接纳)/u,
  /(只是|完全是|肯定是|一定是).{0,10}(工作|失望|担忧|疲惫)/u,
  /(第二天|后来).{0,10}(道歉|和好|原谅|惩罚|修复)/u,
  /(治愈|治好|心理诊断|保证康复)/u,
];

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const unique = (items) => [...new Set(items)];

export function cleanText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return [...value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '').trim()]
    .slice(0, maxLength)
    .join('');
}

export function normalizeEvidenceIds(value) {
  if (!Array.isArray(value)) return [];
  return unique(value.filter((id) => EVIDENCE_IDS.includes(id)));
}

export function validateRequest(payload) {
  const errors = [];
  if (!isPlainObject(payload)) return { ok: false, errors: ['请求必须是 JSON 对象。'] };

  const mode = payload.mode;
  if (mode !== 'inquire' && mode !== 'reconstruct') {
    errors.push('mode 必须是 inquire 或 reconstruct。');
  }

  const rawText = mode === 'inquire' ? payload.question : (payload.text ?? payload.explanation);
  const text = cleanText(rawText);
  if (!text) errors.push(mode === 'inquire' ? '请输入想问的问题。' : '请写下你想尝试的新解释。');
  if (typeof rawText === 'string' && [...rawText].length > 200) errors.push('输入不能超过 200 个字。');

  const submittedUnlocked = Array.isArray(payload.unlockedEvidence)
    ? payload.unlockedEvidence
    : payload.unlockedEvidenceIds;
  const unlockedEvidence = normalizeEvidenceIds(submittedUnlocked);
  if (Array.isArray(submittedUnlocked) && submittedUnlocked.some((id) => !EVIDENCE_IDS.includes(id))) {
    errors.push('包含不存在的证据编号。');
  }

  const value = { mode, text, unlockedEvidence };

  if (mode === 'inquire') {
    const target = payload.target;
    if (target !== 'father' && target !== 'linche' && target !== 'ghost') {
      errors.push('询问对象必须是 father、linche 或 ghost。');
    }
    value.target = target;
    value.moment = ['19:10', '19:11', '19:12', '19:13'].includes(payload.moment)
      ? payload.moment
      : null;
  }

  if (mode === 'reconstruct') {
    const selectedEvidence = normalizeEvidenceIds(payload.selectedEvidence);
    if (!Array.isArray(payload.selectedEvidence) || selectedEvidence.length < 1 || selectedEvidence.length > 2) {
      errors.push('请选择一至两条证据。');
    }
    if (Array.isArray(payload.selectedEvidence) && payload.selectedEvidence.some((id) => !EVIDENCE_IDS.includes(id))) {
      errors.push('引用了不存在的证据。');
    }
    if (selectedEvidence.some((id) => !unlockedEvidence.includes(id))) {
      errors.push('只能引用已经发现的证据。');
    }
    if (!ALLOWED_INFERENCES.includes(payload.inference)) {
      errors.push('请选择要检查的推断。');
    }
    if (payload.action != null && !ALLOWED_ACTIONS.includes(payload.action)) {
      errors.push('行动超出本关范围。');
    }
    value.selectedEvidence = selectedEvidence;
    value.inference = payload.inference;
    value.action = payload.action ?? null;
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], value };
}

export function eligibleEvidenceForInquiry(request) {
  if (!request || request.mode !== 'inquire') return [];
  const q = request.text.toLocaleLowerCase('zh-CN');
  const eligible = new Set();

  if (request.target === 'ghost') return [];

  if (request.moment === '19:10' || /成绩|考[试得分]|分数|成绩单/u.test(q)) eligible.add('M01');
  if (request.moment === '19:11' || /沉默|没说话|不说话/u.test(q)) eligible.add('M02');
  if (request.moment === '19:12' || /手机|消息|返工|工作/u.test(q)) eligible.add('M04');
  if (request.moment === '19:13' || /餐盘|吃饭|先吃|不饿|推.{0,3}(盘|饭)|有没有.{0,4}(理|回应)|整晚.{0,6}(没|没有).{0,4}(理|回应)/u.test(q)) eligible.add('M05');

  if (request.target === 'linche') {
    if (/记得|当时|怎样对你|整晚|失望|不够好|不配/u.test(q)) eligible.add('M03');
    if (/最怕|害怕|再考差|达标|值得|爱|失去什么/u.test(q)) eligible.add('M06');
  }

  if (request.target === 'father') {
    eligible.delete('M03');
    eligible.delete('M06');
  }

  return [...eligible];
}

function defaultInquiry(request) {
  const eligible = eligibleEvidenceForInquiry(request);
  const next = eligible.find((id) => !request.unlockedEvidence.includes(id));

  if (request.target === 'ghost') {
    return {
      reply: '可以把“现场发生了什么”和“林澈由此想到什么”分开核对。需要更明确的位置时，可以查看分层提示。',
      unlockEvidence: [],
      citedEvidence: [],
      suggestedChecks: ['evidence', 'belief'],
    };
  }

  if (next === 'M01') return { reply: FIXED_FACTS.M01, unlockEvidence: ['M01'], citedEvidence: ['M01'], suggestedChecks: ['report'] };
  if (next === 'M02') return { reply: '这段记录里，父亲看过成绩单后没有立即说话。沉默是真的，但记录没有告诉我们他的全部想法。', unlockEvidence: ['M02'], citedEvidence: ['M02'], suggestedChecks: ['replay_1911'] };
  if (next === 'M03') return { reply: '林澈记得那段沉默像过了很久。他当时把它理解成失望，并觉得自己不够好、不配坐在这里。', unlockEvidence: ['M03'], citedEvidence: ['M03'], suggestedChecks: ['linche', 'replay_1913'] };
  if (next === 'M04') return { reply: '19:12 的手机上有一条返工消息。它提供了额外背景，却不能说明沉默只有这一个原因。', unlockEvidence: ['M04'], citedEvidence: ['M04'], suggestedChecks: ['phone', 'replay_1912'] };
  if (next === 'M05') return { reply: '19:13，记录里父亲推近餐盘，说“先吃，明天再说成绩”，林澈回答“我不饿”。这和“整晚都没再理我”值得放在一起看。', unlockEvidence: ['M05'], citedEvidence: ['M05'], suggestedChecks: ['plate', 'replay_1913'] };
  if (next === 'M06') return { reply: '林澈最怕的不只是一次成绩。他说，自己当时以为必须一直达标，才值得被爱。', unlockEvidence: ['M06'], citedEvidence: ['M06'], suggestedChecks: ['belief'] };

  if (request.target === 'father') {
    return {
      reply: '这段回放只留下了当时的动作和话，不能替父亲补出没有记录的内心想法。可以指定一个时刻或物件继续核对。',
      unlockEvidence: [],
      citedEvidence: [],
      suggestedChecks: ['replay_1911', 'replay_1913'],
    };
  }
  return {
    reply: '林澈能说出自己的感受和当时的理解，但记忆中的概括仍可以和现场时刻逐一核对。',
    unlockEvidence: [],
    citedEvidence: [],
    suggestedChecks: ['linche', 'replay_1913'],
  };
}

function conflictsWithFixedWorld(text) {
  return FORBIDDEN_CLAIMS.some((pattern) => pattern.test(text));
}

function backupReconstruction(request) {
  const text = request.text;
  if (conflictsWithFixedWorld(text)) {
    return {
      reply: '这个解释加入了现场没有记录的结论。可以保留你的感受，但请把结论缩小到现有证据能支持的范围。',
      validation: 'hold',
      paraphrase: text,
      supportedActions: [],
      effects: [],
      issues: ['解释包含现场无法确认的新事实。'],
      citedEvidence: request.selectedEvidence,
      unlockEvidence: [],
      suggestedChecks: ['evidence'],
    };
  }

  const hasBoundary = /不能.{0,8}(证明|代表|说明|定义)|不等于|还不能确定|无法确定|不一定|即使|一次.{0,8}(不能|不代表)|不想原谅/u.test(text);
  const deniesFeeling = /不该.{0,5}(难过|害怕|在意)|想太多|都是你.{0,4}(误会|错)/u.test(text);
  const evidenceRelevant = request.inference === 'silence_means_disappointment'
    ? request.selectedEvidence.some((id) => ['M02', 'M03', 'M04', 'M05'].includes(id))
    : request.selectedEvidence.some((id) => ['M01', 'M03', 'M06'].includes(id));

  if (!evidenceRelevant || deniesFeeling || !hasBoundary) {
    return {
      reply: !evidenceRelevant
        ? '这些线索还没有直接接到你选择的那一步推断。可以换一条依据，或说明它怎样限制这个结论。'
        : '我听见了你的方向，但还需要保留林澈当时的感受，并说清哪些结论不能由这些证据直接推出。',
      validation: 'needs_clarification',
      paraphrase: text,
      supportedActions: [],
      effects: [],
      issues: [!evidenceRelevant ? '所选证据与当前推断的关系不够明确。' : '解释需要更清楚地区分感受与结论。'],
      citedEvidence: request.selectedEvidence,
      unlockEvidence: [],
      suggestedChecks: ['evidence', 'belief'],
    };
  }

  const supportedActions = request.action ? [request.action] : [...ALLOWED_ACTIONS];
  const effects = request.action === 'speak'
    ? ['release_voice']
    : request.action === 'pause'
      ? ['release_exit']
      : [];
  return {
    reply: '这个解释承认了发生过的事，也把一次表现、他人的反应和你的全部价值分开了。你可以选择一次小行动来试试。',
    validation: 'supported',
    paraphrase: text,
    supportedActions,
    effects,
    issues: [],
    citedEvidence: request.selectedEvidence,
    unlockEvidence: [],
    suggestedChecks: [],
  };
}

export function buildBackupResponse(request, reason = 'not_configured') {
  const body = request.mode === 'inquire' ? defaultInquiry(request) : backupReconstruction(request);
  return {
    source: 'backup',
    modeLabel: FALLBACK_MODE_LABEL,
    mode: request.mode,
    fallbackReason: reason,
    ...body,
  };
}

export function validateAIResponse(payload, context = {}) {
  const errors = [];
  if (!isPlainObject(payload)) return { ok: false, errors: ['AI 返回值必须是 JSON 对象。'] };

  const reply = cleanText(payload.reply, 180);
  if (!reply) errors.push('AI 回应缺少 reply。');
  if (typeof payload.reply === 'string' && [...payload.reply].length > 180) errors.push('AI 回应超过 180 个字。');
  if (reply && conflictsWithFixedWorld(reply)) errors.push('AI 回应加入了固定世界之外的事实。');

  const unlocked = normalizeEvidenceIds(context.unlockedEvidenceIds ?? context.unlockedEvidence ?? []);
  const eligible = normalizeEvidenceIds(context.eligibleUnlockEvidenceIds ?? []);
  const unlockEvidence = normalizeEvidenceIds(payload.unlockEvidence);
  const citedEvidence = normalizeEvidenceIds(payload.citedEvidence);
  if (Array.isArray(payload.unlockEvidence) && payload.unlockEvidence.some((id) => !EVIDENCE_IDS.includes(id))) errors.push('AI 返回了不存在的证据。');
  if (Array.isArray(payload.citedEvidence) && payload.citedEvidence.some((id) => !EVIDENCE_IDS.includes(id))) errors.push('AI 引用了不存在的证据。');
  if (unlockEvidence.some((id) => !eligible.includes(id))) errors.push('AI 解锁了当前询问不能取得的证据。');
  const availableAfterResponse = new Set([...unlocked, ...unlockEvidence]);
  const unavailableCitations = citedEvidence.filter((id) => !availableAfterResponse.has(id));
  if (unavailableCitations.length) errors.push(`AI 引用了未解锁的证据：${unavailableCitations.join('、')}。`);

  const effects = Array.isArray(payload.effects) ? unique(payload.effects) : [];
  if (effects.some((effect) => !ALLOWED_EFFECTS.includes(effect))) errors.push('AI 返回了范围外的场景变化。');
  if (effects.length > 1) errors.push('一次重构只能改变一道场景限制。');
  if (context.mode === 'inquire' && effects.length) errors.push('询问阶段不能改变场景限制。');
  if (context.action === 'speak' && effects.some((effect) => effect !== 'release_voice')) errors.push('行动与场景变化不一致。');
  if (context.action === 'pause' && effects.some((effect) => effect !== 'release_exit')) errors.push('行动与场景变化不一致。');

  const supportedActions = Array.isArray(payload.supportedActions) ? unique(payload.supportedActions) : [];
  if (supportedActions.some((action) => !ALLOWED_ACTIONS.includes(action))) errors.push('AI 返回了范围外的行动。');
  const suggestedChecks = Array.isArray(payload.suggestedChecks) ? unique(payload.suggestedChecks) : [];
  if (suggestedChecks.some((check) => !ALLOWED_CHECKS.has(check))) errors.push('AI 返回了不存在的检查位置。');

  const facts = Array.isArray(payload.facts) ? payload.facts : [];
  if (facts.some((fact) => !EVIDENCE_IDS.includes(fact))) errors.push('AI 返回了固定事实白名单之外的内容。');

  const validation = payload.validation == null ? undefined : payload.validation;
  if (validation !== undefined && !['supported', 'needs_clarification', 'hold'].includes(validation)) {
    errors.push('AI 返回了未知的判断状态。');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      reply,
      unlockEvidence,
      citedEvidence,
      suggestedChecks,
      validation,
      paraphrase: cleanText(payload.paraphrase, 200),
      supportedActions,
      effects,
      issues: Array.isArray(payload.issues)
        ? payload.issues.map((issue) => cleanText(issue, 100)).filter(Boolean).slice(0, 3)
        : [],
    },
  };
}

export function providerContext(request) {
  return {
    task: request.mode,
    playerText: request.text,
    target: request.target,
    moment: request.moment,
    inference: request.inference,
    action: request.action,
    unlockedEvidenceIds: request.unlockedEvidence,
    selectedEvidenceIds: request.selectedEvidence,
    fixedFacts: FIXED_FACTS,
    allowedEffects: ALLOWED_EFFECTS,
    rules: [
      '只使用 fixedFacts，不补写父亲动机或片段之后的事件。',
      '推测必须明确标为未知；感受不能被否定。',
      '只引用玩家已发现的证据；询问新增证据须与问题、对象和时刻对应。',
      '重构只能建议 speak 或 pause；对应效果只能是 release_voice 或 release_exit。',
      'reply 使用中文且不超过 90 个汉字。',
    ],
  };
}
