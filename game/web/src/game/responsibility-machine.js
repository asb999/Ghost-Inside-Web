const RESPONSIBILITY_ORDER = ['phone', 'medicine', 'application'];

export const ITEM_DEFINITIONS = Object.freeze({
  phone: { id: 'phone', type: 'device', owner: 'father', weight: 1, currentState: 'Available', validTargets: ['father_return', 'father_hint'] },
  medicine: { id: 'medicine', type: 'medicine', owner: 'mother', weight: 1, currentState: 'Available', validTargets: ['family_calendar'] },
  application: { id: 'application', type: 'document', owner: 'brother', weight: 1, currentState: 'Available', validTargets: ['brother_return'] },
  notice: { id: 'notice', type: 'document', owner: 'lin_che', weight: 0, currentState: 'Hidden', validTargets: ['discard', 'keep'] }
});

const RUN = [1, 0.97, 0.93, 0.88];
const JUMP = [1, 0.96, 0.90, 0.81];

export class ResponsibilityMachine {
  constructor() {
    this.phase = 'INTRO';
    this.items = structuredClone(ITEM_DEFINITIONS);
    this.tutorial = new Set();
    this.phoneHinted = false;
    this.jumpAttempts = 0;
    this.history = [];
    this.closed = false;
  }

  event(type, data = {}) {
    this.history.push({ type, ...data });
  }

  start() {
    if (this.phase !== 'INTRO') return false;
    this.phase = 'TUTORIAL';
    this.event('started');
    return true;
  }

  finishTutorial(id) {
    if (this.phase !== 'TUTORIAL' || !['bowl', 'fruit', 'water'].includes(id)) return false;
    this.tutorial.add(id);
    this.event('tutorial_item', { id });
    if (this.tutorial.size === 3) {
      this.phase = 'COLLECT_RESPONSIBILITIES';
      this.event('tutorial_complete');
    }
    return true;
  }

  collect(id) {
    if (this.phase !== 'COLLECT_RESPONSIBILITIES') return false;
    const next = RESPONSIBILITY_ORDER[this.carriedResponsibilityCount];
    if (id !== next || this.items[id].currentState !== 'Available') return false;
    this.items[id].currentState = 'Carried';
    this.event('responsibility_collected', { id });
    return true;
  }

  failGap() {
    const full = this.carriedResponsibilityCount === 3;
    if (this.phase === 'COLLECT_RESPONSIBILITIES' && full) {
      this.jumpAttempts += 1;
      this.phase = 'FIRST_JUMP_FAIL';
      this.event('gap_attempt_1_failed');
      this.phase = 'MEMORY_HUB';
      this.event('memory_hub_opened');
      return 'first';
    }
    if (this.phase === 'RESPONSIBILITIES_RESOLVED') {
      this.jumpAttempts += 1;
      this.phase = 'SECOND_JUMP_FAIL';
      this.event('gap_attempt_2_interrupted');
      this.items.notice.currentState = 'Revealed';
      this.phase = 'TRANSFER_NOTICE_REVEAL';
      this.event('notice_revealed');
      return 'second';
    }
    return false;
  }

  resolve(id, target) {
    if (this.phase !== 'MEMORY_HUB') return false;
    const item = this.items[id];
    if (!item || !['Carried', 'ReturnedPending'].includes(item.currentState)) return false;
    if (id === 'medicine' && target === 'family_calendar') item.currentState = 'Shared';
    else if (id === 'phone' && target === 'father_return') {
      item.currentState = 'ReturnedPending';
      this.event('phone_returned');
      return true;
    } else if (id === 'phone' && target === 'father_hint' && item.currentState === 'ReturnedPending') {
      item.currentState = 'Returned';
      this.phoneHinted = true;
    } else if (id === 'application' && target === 'brother_return') item.currentState = 'Returned';
    else return false;
    this.event('responsibility_resolved', { id, state: item.currentState });
    if (this.resolvedCount === 3) {
      this.phase = 'RESPONSIBILITIES_RESOLVED';
      this.event('responsibilities_resolved');
    }
    return true;
  }

  rejectNotice() {
    if (this.phase !== 'TRANSFER_NOTICE_REVEAL' || this.items.notice.currentState !== 'Revealed') return false;
    this.event('notice_discard_rejected');
    return true;
  }

  keepNotice() {
    if (this.phase !== 'TRANSFER_NOTICE_REVEAL' || this.items.notice.currentState !== 'Revealed') return false;
    this.items.notice.currentState = 'Kept';
    this.phase = 'TRANSFER_NOTICE_KEPT';
    this.event('notice_kept');
    this.phase = 'FINAL_RUN';
    return true;
  }

  finalLand() {
    if (this.phase !== 'FINAL_RUN') return false;
    this.jumpAttempts += 1;
    this.phase = 'FINAL_JUMP';
    this.event('final_jump_landed');
    return true;
  }

  end() {
    if (this.phase !== 'FINAL_JUMP') return false;
    this.phase = 'ENDING';
    this.event('ending_message_sent');
    this.closed = true;
    return true;
  }

  get carriedResponsibilityCount() {
    return RESPONSIBILITY_ORDER.filter((id) => ['Carried', 'ReturnedPending'].includes(this.items[id].currentState)).length;
  }

  get resolvedCount() {
    return Number(this.items.medicine.currentState === 'Shared') +
      Number(this.items.phone.currentState === 'Returned') +
      Number(this.items.application.currentState === 'Returned');
  }

  get runMultiplier() { return RUN[this.carriedResponsibilityCount]; }
  get jumpMultiplier() { return JUMP[this.carriedResponsibilityCount]; }

  readSnapshot() {
    return {
      phase: this.phase,
      closed: this.closed,
      carriedResponsibilityCount: this.carriedResponsibilityCount,
      resolvedCount: this.resolvedCount,
      runMultiplier: this.runMultiplier,
      jumpMultiplier: this.jumpMultiplier,
      jumpAttempts: this.jumpAttempts,
      items: structuredClone(this.items),
      history: structuredClone(this.history)
    };
  }
}
