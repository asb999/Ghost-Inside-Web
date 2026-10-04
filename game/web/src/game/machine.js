// machine.js — 唯一有权转场、解锁卡片、改变怪物状态的地方
// 严格顺序：life_slice → garden → collector → dinner → pollution → statement → epilogue → closed
import { EventLog } from './events.js';

const ORDER = [
  'life_slice', 'garden', 'collector', 'dinner',
  'pollution', 'statement', 'epilogue', 'closed'
];

export class Machine {
  constructor(caseView) {
    this.caseView = caseView;
    this.beat = 'boot';          // boot | ORDER 值
    this.unlockedCards = new Set();
    this.events = new EventLog();
    this.conversionDone = false;
    this.terminalClosed = false;
    this.dinnerCycle = 0;
    this.revealDone = false;
    this.pollutionStep = 0;      // 0..5
    this.pollutionResists = new Set();
    this.pollutionWindow = null; // {step, mode, open, resisted}
    this.pollutionReadyToExit = false;
    this.feedback = null;        // {source, verdict, response, evidence_ids}
    this.submissions = 0;
    this.captured = false;       // 迟到响应/重复提交防护
    this._listeners = new Set();
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  start() {
    this.beat = 'life_slice';
    this.events.push('beat_enter', { beat: this.beat });
    this._emit();
  }

  canAdvance(to) {
    const i = ORDER.indexOf(this.beat);
    return i >= 0 && ORDER[i + 1] === to;
  }

  // 只有状态机可以转场；前置条件不满足则拒绝
  advance(to) {
    if (to === 'garden' && !this._openingRead()) return false;
    if (to === 'collector' && !this.terminalClosed) return false;
    if (to === 'dinner' && !this.conversionDone) return false;
    if (to === 'pollution' && this.dinnerCycle < 3) return false;
    if (to === 'statement' && (
      this.pollutionStep < 5
      || !this.pollutionReadyToExit
      || !this.events.has('pollution_exit_opened')
    )) return false;
    if (to === 'epilogue' && !this.feedback) return false;
    if (to === 'closed' && this.beat !== 'epilogue') return false;
    if (!this.canAdvance(to)) return false;
    this.beat = to;
    this.events.push('beat_enter', { beat: to });
    this._emit();
    return true;
  }

  _openingRead() {
    return this.events.has('opening_read');
  }

  unlock(cardId) {
    const card = this.caseView.unlockByCard.get(cardId);
    if (!card) return false;
    if (this.unlockedCards.has(cardId)) return false;
    this.unlockedCards.add(cardId);
    this.events.push('card_unlocked', { card: cardId });
    this._emit();
    return true;
  }

  isUnlocked(cardId) {
    return this.unlockedCards.has(cardId);
  }

  unlockedCardsList() {
    return [...this.unlockedCards].map((id) => this.caseView.unlockByCard.get(id));
  }

  recordPollutionEvent() {
    if (this.beat !== 'pollution') return false;
    if (this.pollutionStep >= 5) return false;
    const expectedStep = this.pollutionStep + 1;
    if (this.pollutionWindow?.step === expectedStep) this.pollutionWindow = null;
    this.pollutionStep += 1;
    const ev = this.caseView.pollution.events[this.pollutionStep - 1];
    this.events.push(`pollution_${ev.kind}`, { id: ev.id });
    if (ev.kind === 'only_a') this.unlock('B01');
    if (this.pollutionStep === 5) {
      this.events.push('pollution_done', {});
      this.unlock('E03');
      this.pollutionReadyToExit = this.pollutionResists.size > 0;
    }
    this._emit();
    return true;
  }

  openPollutionWindow(step, mode = 'event') {
    if (this.beat !== 'pollution') return false;
    if (!Number.isInteger(step) || step < 1 || step > 5) return false;
    const isEventWindow = mode === 'event' && step === this.pollutionStep + 1;
    const isRecoveryWindow = mode === 'recovery'
      && this.pollutionStep === 5
      && this.pollutionResists.size === 0
      && step === 5;
    if (!isEventWindow && !isRecoveryWindow) return false;
    this.pollutionWindow = {
      step,
      mode,
      open: true,
      resisted: this.pollutionResists.has(step)
    };
    this._emit();
    return true;
  }

  closePollutionWindow(step) {
    if (!this.pollutionWindow?.open || this.pollutionWindow.step !== step) return false;
    this.pollutionWindow = null;
    this._emit();
    return true;
  }

  recordPollutionResist(step) {
    if (this.beat !== 'pollution') return false;
    if (!this.pollutionWindow?.open || this.pollutionWindow.step !== step) return false;
    if (this.pollutionResists.has(step)) return false;
    this.pollutionResists.add(step);
    this.pollutionWindow = { ...this.pollutionWindow, resisted: true };
    this.events.push('pollution_resist', { step });
    if (this.pollutionStep >= 5) this.pollutionReadyToExit = true;
    this._emit();
    return true;
  }

  openPollutionExit() {
    if (this.beat !== 'pollution') return false;
    if (this.pollutionStep < 5 || this.pollutionResists.size < 1) return false;
    this.pollutionReadyToExit = true;
    this.pollutionWindow = null;
    this.events.push('pollution_exit_opened', {
      resists: this.pollutionResists.size
    });
    return this.advance('statement');
  }

  recordDinnerCycle(n) {
    if (this.beat !== 'dinner' || n !== this.dinnerCycle + 1) return false;
    this.dinnerCycle = n;
    const cyc = this.caseView.dinner.cycles[n - 1];
    this.events.push(`dinner_cycle_${n}`, {});
    const unlockMap = { 1: 'E02', 2: 'F03', 3: 'F01' };
    this.unlock(unlockMap[n]);
    void cyc;
    return true;
  }

  recordReveal() {
    if (this.beat !== 'dinner' || this.dinnerCycle < 3 || this.revealDone) return false;
    this.revealDone = true;
    this.events.push('dinner_reveal', {});
    this.unlock('R01');
    this._emit();
    return true;
  }

  submitJudgment(text, evidenceIds) {
    if (this.beat !== 'statement') return { ok: false, reason: 'wrong_beat' };
    if (this.captured) return { ok: false, reason: 'already_submitted' };
    const trimmed = [...String(text ?? '')].length
      ? String(text).trim()
      : '';
    const chars = Array.from(trimmed).length;
    const max = this.caseView.contract.maxFreeTextChars;
    if (chars < 1 || chars > max) return { ok: false, reason: 'bad_length' };
    const ids = [...new Set(evidenceIds ?? [])];
    if (ids.length === 0) return { ok: false, reason: 'no_evidence' };
    for (const id of ids) {
      if (!this.caseView.unlockByCard.has(id)) return { ok: false, reason: 'unknown_evidence' };
      if (!this.isUnlocked(id)) return { ok: false, reason: 'locked_evidence' };
    }
    this.submissions += 1;
    if (this.submissions > this.caseView.contract.maxSubmissions) {
      return { ok: false, reason: 'too_many_submissions' };
    }
    this.events.push('statement_submitted', { chars, evidence: ids });
    this.captured = true;
    return { ok: true, statement: trimmed, evidence_ids: ids };
  }

  // 反馈落地（provider 或固定回退都走这里；迟到响应被 captured 挡掉）
  applyFeedback(result) {
    if (!this.captured) return false;
    this.feedback = result;
    this.events.push('feedback_shown', { source: result.source, verdict: result.verdict });
    this.captured = false;
    this._emit();
    return true;
  }

  closeCase() {
    if (this.beat !== 'epilogue') return false;
    this.beat = 'closed';
    this.events.push('case_closed', {});
    this._emit();
    return true;
  }

  readSnapshot() {
    return {
      beat: this.beat,
      simReady: true,
      unlockedCards: [...this.unlockedCards],
      terminalClosed: this.terminalClosed,
      conversionDone: this.conversionDone,
      dinnerCycle: this.dinnerCycle,
      revealDone: this.revealDone,
      pollutionStep: this.pollutionStep,
      pollutionResists: [...this.pollutionResists].sort((a, b) => a - b),
      pollutionWindow: this.pollutionWindow ? { ...this.pollutionWindow } : null,
      pollutionReadyToExit: this.pollutionReadyToExit,
      feedback: this.feedback ? { ...this.feedback } : null,
      submissions: this.submissions,
      history: this.events.history()
    };
  }
}
