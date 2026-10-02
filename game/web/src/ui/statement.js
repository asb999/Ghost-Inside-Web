// statement.js — 表态点：一句判断（≤60 字）+ 已解锁证据引用；反馈后必须给继续入口
export class StatementUI {
  constructor(root, machine, caseView) {
    this.root = root;
    this.machine = machine;
    this.cv = caseView;
    this.selected = new Set();
  }

  show({ onSubmit }) {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.dataset.story = 'statement';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="tag">表态点 · 一句判断</div>
      <div class="line ghost">${this.cv.ghostLines.statement_guide}</div>
      <div class="line">${this.cv.statement.prompt}</div>`;
    const ta = document.createElement('textarea');
    ta.dataset.story = 'statement-input';
    ta.maxLength = this.cv.statement.max_chars + 10; // 允许超输，由状态机拒绝并提示
    const count = document.createElement('div');
    count.className = 'char-count';
    ta.addEventListener('input', () => {
      count.textContent = `${Array.from(ta.value.trim()).length} / ${this.cv.statement.max_chars}`;
    });
    const chips = document.createElement('div');
    chips.className = 'evidence-chips';
    chips.dataset.story = 'evidence';
    for (const cardItem of this.cv.cards) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.cardId = cardItem.id;
      const unlocked = this.machine.isUnlocked(cardItem.id);
      chip.textContent = unlocked ? `${cardItem.id} ${cardItem.title}` : `${cardItem.id} ██████`;
      if (!unlocked) chip.classList.add('locked');
      else chip.addEventListener('click', () => {
        chip.classList.toggle('on');
        if (chip.classList.contains('on')) this.selected.add(cardItem.id);
        else this.selected.delete(cardItem.id);
      });
      chips.appendChild(chip);
    }
    const err = document.createElement('div');
    err.className = 'sys-toast';
    err.dataset.story = 'statement-error';
    const submit = document.createElement('button');
    submit.textContent = this.cv.statement.submit_label;
    submit.dataset.action = 'statement-submit';
    submit.addEventListener('click', () => {
      err.textContent = '';
      const res = this.machine.submitJudgment(ta.value, [...this.selected]);
      if (!res.ok) {
        err.textContent = {
          bad_length: `请输入 1–${this.cv.statement.max_chars} 字。`,
          no_evidence: '至少引用一条已解锁的证据。',
          unknown_evidence: '引用了未知的证据。',
          locked_evidence: '引用了尚未解锁的证据。',
          too_many_submissions: '本关最多提交两次。',
          already_submitted: '正在等待回应。'
        }[res.reason] ?? '无法提交。';
        return;
      }
      ta.disabled = true;
      submit.disabled = true;
      onSubmit(res);
    });
    card.append(ta, count, chips, err, submit);
    el.appendChild(card);
    this.root.appendChild(el);
    this.el = el;
  }

  showFeedback(fb, { onContinue }) {
    this.el?.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const card = this.el.querySelector('.card');
    const fbDiv = document.createElement('div');
    fbDiv.className = 'feedback';
    fbDiv.dataset.story = 'feedback';
    const verdict = document.createElement('div');
    verdict.className = 'verdict';
    verdict.textContent = `[${String(fb.verdict).toUpperCase()} · 来源:${fb.source}]`;
    const resp = document.createElement('div');
    resp.textContent = fb.response;
    const ev = document.createElement('div');
    ev.className = 'small';
    ev.textContent = `引用：${(fb.evidence_ids ?? []).join('、')}`;
    fbDiv.append(verdict, resp, ev);
    card.appendChild(fbDiv);
    const go = document.createElement('button');
    go.textContent = '继续'; // revise / hold / timeout 同样给继续入口：拒绝是导航，不是惩罚
    go.dataset.action = 'feedback-continue';
    go.addEventListener('click', () => {
      go.disabled = true;
      onContinue?.();
    });
    card.appendChild(go);
  }

  destroy() {
    this.el?.remove();
    this.el = null;
    this.selected.clear();
  }
}
