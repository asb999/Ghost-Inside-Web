// statement.js — 表态点：从玩家亲手找到的事实与感受中，组成一句判断。
const SHORT_CLAUSES = {
  F01: '他还想创造能让人相连的东西',
  F02: '他确实喜欢医学',
  F03: '父亲的安排也来自对失败的恐惧',
  R01: '这 47 次放弃都是他亲手确认的',
  E01: '一直被肯定也可能让人被困住',
  E02: '他把感谢背成了亏欠',
  E03: '喜欢医学不等于只能成为医生',
  B01: '感谢家人的付出，不等于交出自己的决定权'
};

export class StatementUI {
  constructor(root, machine, caseView) {
    this.root = root;
    this.machine = machine;
    this.cv = caseView;
    this.selected = new Map();
  }

  show({ onSubmit }) {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.dataset.story = 'statement';
    const card = document.createElement('div');
    card.className = 'card statement-card';
    card.innerHTML = `<div class="tag">别替他选路 · 只说出你现在看见的</div>
      <div class="line ghost">Ghost：你已经找到了修改人，也在污染中守住了一个选项。现在，把事实和理解拼在一起。</div>`;

    const unlocked = this.cv.cards.filter((item) => this.machine.isUnlocked(item.id));
    const lanes = [
      { type: 'facts', title: '1 · 你认为最重要的事实是什么？' },
      { type: 'feelings', title: '2 · 你如何理解他的沉默？' }
    ];
    for (const lane of lanes) {
      const group = document.createElement('fieldset');
      group.className = 'stance-lane';
      group.dataset.lane = lane.type;
      const legend = document.createElement('legend');
      legend.textContent = lane.title;
      group.appendChild(legend);
      for (const item of unlocked.filter((entry) => entry.type === lane.type)) {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'stance-choice';
        choice.dataset.cardId = item.id;
        choice.innerHTML = `<strong>${item.title}</strong><span>${item.text}</span>`;
        choice.addEventListener('click', () => {
          group.querySelectorAll('.stance-choice').forEach((b) => b.classList.remove('on'));
          choice.classList.add('on');
          this.selected.set(lane.type, item.id);
          this._updatePreview();
        });
        group.appendChild(choice);
      }
      card.appendChild(group);
    }

    const boundary = unlocked.find((item) => item.id === 'B01');
    const kept = document.createElement('div');
    kept.className = 'kept-boundary';
    kept.innerHTML = `<span>你在污染中守住的边界</span><strong>${boundary?.title ?? '感谢不等于交出决定权'}</strong>`;
    card.appendChild(kept);

    const preview = document.createElement('div');
    preview.className = 'stance-preview';
    preview.dataset.story = 'statement-preview';
    preview.textContent = '选择一条事实和一种理解，这句话才会完整。';
    const err = document.createElement('div');
    err.className = 'sys-toast';
    err.dataset.story = 'statement-error';
    const submit = document.createElement('button');
    submit.textContent = '把这句话说给他听';
    submit.dataset.action = 'statement-submit';
    submit.disabled = true;
    submit.addEventListener('click', () => {
      err.textContent = '';
      const assembled = this._assemble();
      if (!assembled) return;
      const res = this.machine.submitJudgment(assembled.text, assembled.ids);
      if (!res.ok) {
        err.textContent = '这句话还没站稳，请重新看看你选的事实与感受。';
        return;
      }
      card.querySelectorAll('.stance-choice, [data-action="statement-submit"]').forEach((node) => (node.disabled = true));
      onSubmit(res);
    });
    card.append(preview, err, submit);
    el.appendChild(card);
    this.root.appendChild(el);
    this.el = el;
    this.submit = submit;
    this.preview = preview;
  }

  _assemble() {
    const fact = this.selected.get('facts');
    const feeling = this.selected.get('feelings');
    if (!fact || !feeling || !this.machine.isUnlocked('B01')) return null;
    const text = `${SHORT_CLAUSES[fact]}，${SHORT_CLAUSES[feeling]}；${SHORT_CLAUSES.B01}。`;
    return { text, ids: [fact, feeling, 'B01'] };
  }

  _updatePreview() {
    const assembled = this._assemble();
    this.submit.disabled = !assembled;
    this.preview.textContent = assembled?.text ?? '再选一项，让事实和理解同时存在。';
    this.preview.classList.toggle('ready', Boolean(assembled));
  }

  showFeedback(fb, { onContinue }) {
    const card = this.el.querySelector('.card');
    card.querySelectorAll('fieldset, .kept-boundary, .stance-preview, .sys-toast, [data-action="statement-submit"]').forEach((node) => node.remove());
    const fbDiv = document.createElement('div');
    fbDiv.className = 'feedback character-feedback';
    fbDiv.dataset.story = 'feedback';
    const headings = {
      accept: 'Ghost：这句话没有替他选路。',
      revise: 'Ghost：方向是对的，但还有一块不该被省略。',
      hold: 'Ghost：不急着把它说成最后答案。'
    };
    const heading = document.createElement('div');
    heading.className = 'feedback-speaker';
    heading.textContent = headings[fb.verdict] ?? headings.hold;
    const resp = document.createElement('div');
    resp.className = 'feedback-response';
    resp.textContent = fb.response;
    const evidenceNames = (fb.evidence_ids ?? [])
      .map((id) => this.cv.unlockByCard.get(id)?.title)
      .filter(Boolean);
    const echo = document.createElement('div');
    echo.className = 'small';
    echo.textContent = evidenceNames.length ? `这句话站在：${evidenceNames.join('、')}` : '';
    fbDiv.append(heading, resp, echo);
    card.appendChild(fbDiv);
    const go = document.createElement('button');
    go.textContent = '把答案还给林澈';
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
