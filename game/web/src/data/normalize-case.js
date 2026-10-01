// normalize-case.js — 磁盘 snake_case 契约 → 网页 camelCase 内部视图（CaseView）
// 旧字段名（agent_contract / fallbacks / cards）原样读取，不改写磁盘文件。

export function normalizeCase(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('case: not an object');
  for (const key of ['agent_contract', 'fallbacks', 'cards']) {
    if (!(key in raw)) throw new Error(`case: missing ${key}`);
  }

  const unlockByCard = new Map();
  for (const type of ['facts', 'feelings', 'boundaries']) {
    for (const card of raw.cards[type] ?? []) {
      unlockByCard.set(card.id, { ...card, type });
    }
  }

  const beats = (raw.beats ?? []).map((b) => ({
    id: b.id,
    budgetSeconds: b.budget_seconds,
    exitConditions: b.exit_conditions ?? []
  }));

  const records = (raw.reveal?.records ?? []).map((r) => ({
    id: r.id,
    stage: r.stage,
    act: r.act,
    editorId: r.editor_id,
    editorName: raw.reveal?.editor_name ?? '林澈',
    displayBefore: raw.reveal?.display_before ?? '████████'
  }));

  return {
    id: raw.case_id,
    schemaVersion: String(raw.schema_version),
    title: raw.title,
    client: raw.client,
    contract: {
      allowedResults: raw.agent_contract.allowed_results,
      maxSubmissions: raw.agent_contract.max_submissions,
      maxFreeTextChars: raw.agent_contract.max_free_text_chars,
      requiredCardTypes: raw.agent_contract.required_card_types,
      mustCiteUnlockedEvidence: raw.agent_contract.must_cite_unlocked_evidence,
      forbiddenActions: raw.agent_contract.forbidden_actions
    },
    cards: [...unlockByCard.values()],
    unlockByCard,
    beats,
    opening: { steps: normalizeOpening(raw.opening) },
    garden: raw.garden,
    collector: raw.collector,
    dinner: raw.dinner,
    reveal: { ...(raw.reveal ?? {}), records },
    pollution: raw.pollution,
    ghostLines: raw.ghost_lines,
    feedbackTemplates: raw.feedback_templates,
    statement: raw.statement,
    epilogue: raw.epilogue,
    fallbacks: raw.fallbacks
  };
}

function normalizeOpening(opening) {
  return (opening?.steps ?? []).map((s) => ({
    id: s.id,
    kind: s.kind,
    from: s.from,
    text: s.text,
    line: s.line,
    lines: s.lines,
    seconds: s.seconds
  }));
}
