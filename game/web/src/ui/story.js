// story.js — DOM 演出：开场 / HUD / 饭桌三循环 / 47 条揭示 / 污染 / 尾声 / 结案
export class StoryUI {
  constructor(root, machine, caseView, input = null) {
    this.root = root;
    this.machine = machine;
    this.cv = caseView;
    this.input = input;
    this._timers = [];
    this.pollutionClock = 0;
    this._pollutionPhase = 'idle';
    this._pollutionStep = 0;
    this._pollutionRemaining = 0;
    this._pollutionFeedback = '';
    this._pollutionFeedbackRemaining = 0;
    this._interactLatch = false;
    this._overlay = null;
  }

  _timersPush(t) { this._timers.push(t); }
  clearTimers() { for (const t of this._timers) clearTimeout(t); this._timers = []; }

  _overlayEl(cls = '') {
    this._overlay?.remove();
    const el = document.createElement('div');
    el.className = `overlay ${cls}`;
    el.dataset.story = 'overlay';
    this.root.appendChild(el);
    this._overlay = el;
    return el;
  }

  _card(el) {
    const c = document.createElement('div');
    c.className = 'card';
    el.appendChild(c);
    return c;
  }

  ghostHud(text) {
    let hud = document.getElementById('ghost-hud');
    if (!hud) {
      const bar = document.createElement('div');
      bar.className = 'hud';
      bar.innerHTML = '<span class="beat-label" id="beat-label"></span><span class="ghost-hud" id="ghost-hud"></span>';
      this.root.appendChild(bar);
      hud = document.getElementById('ghost-hud');
    }
    hud.textContent = text ?? '';
  }

  beatLabel(text) {
    document.getElementById('beat-label')?.replaceChildren(document.createTextNode(text));
  }

  // 顶部目标条：当前幕的任务目标（每步操作提示也会临时接管它）
  setObjective(text) {
    let el = document.getElementById('objective');
    if (!el) {
      el = document.createElement('div');
      el.id = 'objective';
      el.className = 'objective';
      this.root.appendChild(el);
    }
    el.textContent = text ?? '';
    el.style.display = text ? '' : 'none';
  }

  // ── 序 · 生活切片 ──
  showOpening() {
    const el = this._overlayEl();
    const card = this._card(el);
    card.innerHTML = '<div class="tag">GHOST INSIDE · 调理接入</div>';
    let i = 0;
    const showStep = () => {
      const step = this.cv.opening.steps[i];
      if (!step) return this._finishOpening(card);
      const div = document.createElement('div');
      if (step.kind === 'message') {
        div.className = 'line amber';
        div.textContent = `${step.from}：「${step.text}」`;
      } else if (step.kind === 'status') {
        div.className = 'line ghost';
        div.innerHTML = step.lines.map((l) => `${l}<br/>`).join('');
      } else if (step.kind === 'records') {
        div.className = 'line redacted';
        div.textContent = step.line;
      } else {
        div.className = 'line';
        div.textContent = step.line;
      }
      card.appendChild(div);
      const next = document.createElement('button');
      next.textContent = i === this.cv.opening.steps.length - 1 ? '接入' : '继续';
      next.dataset.action = 'opening-next';
      next.addEventListener('click', () => {
        i += 1;
        if (i >= this.cv.opening.steps.length) this._finishOpening(card);
        else { next.remove(); showStep(); }
      });
      card.appendChild(next);
      // 不点也按数据时长自动推进（保留 35s 预算）
      this._timersPush(setTimeout(() => {
        if (next.isConnected) { next.remove(); i += 1; showStep(); }
      }, step.seconds * 1000));
    };
    showStep();
  }

  _finishOpening(card) {
    this._overlay?.querySelectorAll('button').forEach((b) => (b.disabled = true));
    this.machine.events.push('opening_read', {});
    this.machine.advance('garden');
    void card;
  }

  // ── 二幕 · 饭桌三循环 + 47 条揭示 ──
  showDinner() {
    const el = this._overlayEl('dim');
    const card = this._card(el);
    card.innerHTML = `<div class="tag">记忆回放 · ${this.cv.dinner.memory_title}</div>`;
    this._cycle(card, 0);
  }

  _cycle(card, idx) {
    if (idx >= this.cv.dinner.cycles.length) return this._reveal(card);
    const cyc = this.cv.dinner.cycles[idx];
    const line = document.createElement('div');
    line.className = 'line';
    line.textContent = cyc.line;
    const note = document.createElement('div');
    note.className = 'small';
    note.textContent = cyc.note;
    card.append(line, note);
    this.machine.recordDinnerCycle(idx + 1);
    const btn = document.createElement('button');
    btn.textContent = '继续观察';
    btn.dataset.action = 'dinner-cycle';
    btn.addEventListener('click', () => { btn.remove(); this._cycle(card, idx + 1); });
    card.appendChild(btn);
  }

  _reveal(card) {
    const reveal = this.cv.reveal;
    const table = document.createElement('table');
    table.className = 'record-table';
    table.dataset.story = 'records';
    const thead = table.createTHead().insertRow();
    for (const h of reveal.columns) {
      const th = document.createElement('th');
      th.textContent = h;
      thead.appendChild(th);
    }
    const tbody = table.createTBody();
    for (const r of reveal.records) {
      const row = tbody.insertRow();
      row.insertCell().textContent = r.stage;
      row.insertCell().textContent = r.act;
      const mod = row.insertCell();
      mod.textContent = r.displayBefore;   // 揭示前全部涂白
      mod.className = 'redacted';
      mod.dataset.recordId = r.id;
    }
    card.appendChild(table);
    const btn = document.createElement('button');
    btn.textContent = '查询修改人';
    btn.dataset.action = 'reveal';
    btn.addEventListener('click', () => {
      btn.disabled = true;
      // 同一批记录，揭示真实修改人
      for (const r of reveal.records) {
        const td = table.querySelector(`td[data-record-id="${r.id}"]`);
        td.textContent = r.editorName;
        td.className = 'mine';
      }
      this.machine.recordReveal();
      const after = document.createElement('div');
      after.className = 'line ghost';
      after.textContent = reveal.after_line;
      card.appendChild(after);
      const go = document.createElement('button');
      go.textContent = '继续深入';
      go.dataset.action = 'to-pollution';
      go.addEventListener('click', () => {
        go.disabled = true;
        this.machine.advance('pollution');
      });
      card.appendChild(go);
    });
    card.appendChild(btn);
  }

  // ── 污染（由主循环按模拟时间驱动）──
  showPollution() {
    const el = this._overlayEl();
    const card = this._card(el);
    card.innerHTML = `<div class="tag">人生路径确认</div>
      <div class="sys-toast" id="pollution-toast"></div>
      <div class="option-list" id="pollution-options"></div>
      <div class="small">Ghost：${this.cv.ghostLines.pollution_enter}</div>`;
    const list = card.querySelector('#pollution-options');
    for (const opt of this.cv.pollution.options_initial) {
      const div = document.createElement('div');
      div.className = 'option';
      div.textContent = opt;
      div.dataset.option = opt[0];
      list.appendChild(div);
    }
    this.pollutionClock = 0;
    this._pollEl = card;
    this._pollutionPhase = 'window';
    this._pollutionStep = 1;
    this._pollutionRemaining = 2800;
    this._pollutionFeedback = '';
    this._pollutionFeedbackRemaining = 0;
    this._interactLatch = false;
    this.machine.openPollutionWindow(1);
    this._renderPollutionPrompt();
  }

  // 主循环每帧调用（dt 为模拟毫秒）
  tickPollution(dt) {
    if (!this._pollEl || this.machine.beat !== 'pollution') return;
    const safeDt = Math.max(0, Number(dt) || 0);
    this.pollutionClock += safeDt;
    const interactDown = this.input?.isDown?.('interact') ?? false;
    const interactPressed = interactDown && !this._interactLatch;
    this._interactLatch = interactDown;

    if (this._pollutionPhase === 'window') {
      if (interactPressed && this.machine.recordPollutionResist(this._pollutionStep)) {
        // 每一步只能成功一次；多出来的 450ms 是短暂守住，不会取消污染事件。
        this._pollutionRemaining += 450;
        this._pollutionFeedback = '抵抗成功：选项暂时稳住，但系统仍在推进。';
        this._pollutionFeedbackRemaining = 700;
      }
      this._pollutionRemaining -= safeDt;
      this._pollutionFeedbackRemaining = Math.max(0, this._pollutionFeedbackRemaining - safeDt);
      if (this._pollutionRemaining <= 0) this._applyPollutionEvent();
      else this._renderPollutionPrompt();
      return;
    }

    if (this._pollutionPhase === 'recovery') {
      if (interactPressed && this.machine.recordPollutionResist(5)) {
        this.machine.closePollutionWindow(5);
        this._pollutionPhase = 'exit';
        this._renderPollutionPrompt('你守住了一瞬。再按 E，撕开通往表态点的出口。');
      }
      return;
    }

    if (this._pollutionPhase === 'exit' && interactPressed) {
      this.machine.openPollutionExit();
    }
  }

  _renderPollutionPrompt(feedback = '') {
    const toast = this._pollEl?.querySelector('#pollution-toast');
    if (!toast) return;
    if (feedback || this._pollutionFeedbackRemaining > 0) {
      toast.textContent = feedback || this._pollutionFeedback;
      return;
    }
    if (this._pollutionPhase === 'window') {
      const seconds = Math.max(0, this._pollutionRemaining / 1000).toFixed(1);
      const resisted = this.machine.pollutionResists.has(this._pollutionStep);
      toast.textContent = resisted
        ? `第 ${this._pollutionStep}/5 次改写 · 已抵抗 · ${seconds}s 后仍会发生`
        : `第 ${this._pollutionStep}/5 次改写 · 按 E 抵抗 · ${seconds}s`;
    } else if (this._pollutionPhase === 'recovery') {
      toast.textContent = '所有选项已经被改写。最后机会：按 E 抵抗一次（窗口保持开放）。';
    } else if (this._pollutionPhase === 'exit') {
      toast.textContent = '按 E 撕开出口，进入表态点。';
    }
  }

  _applyPollutionEvent() {
    const ev = this.cv.pollution.events[this._pollutionStep - 1];
    if (!ev || !this.machine.recordPollutionEvent()) return;
    const toast = this._pollEl.querySelector('#pollution-toast');
    const c = this._pollEl.querySelector('[data-option="C"]');
    const b = this._pollEl.querySelector('[data-option="B"]');
    const a = this._pollEl.querySelector('[data-option="A"]');
    if (toast) toast.textContent = ev.ui_line ?? '';
    if (ev.kind === 'blur_c' && c) { c.textContent = ev.after; c.classList.add('blurred'); }
    if (ev.kind === 'delete_c' && c) c.classList.add('deleted');
    if (ev.kind === 'delete_b' && b) b.classList.add('deleted');
    if (ev.kind === 'only_a' && b) {
      b.remove();
      if (a) a.textContent = ev.after;
    }
    if (ev.kind === 'auto_select' && a) a.classList.add('selected');

    if (this._pollutionStep < 5) {
      this._pollutionStep += 1;
      this._pollutionRemaining = 2800;
      this._pollutionFeedback = '';
      this._pollutionFeedbackRemaining = 0;
      this.machine.openPollutionWindow(this._pollutionStep);
      this._renderPollutionPrompt();
      return;
    }

    if (this.machine.pollutionResists.size > 0) {
      this._pollutionPhase = 'exit';
      this._renderPollutionPrompt();
    } else {
      // 全部错过时，污染照常完成，但给一个不会消失的补救窗口，避免永久卡关。
      this._pollutionPhase = 'recovery';
      this.machine.openPollutionWindow(5, 'recovery');
      this._renderPollutionPrompt();
    }
  }

  // ── 尾声 ──
  showEpilogue(onClosed) {
    const el = this._overlayEl();
    const card = this._card(el);
    card.innerHTML = `<div class="tag">调理结束</div>`;
    const seq = [
      this.cv.epilogue.ghost_question,
      ...this.cv.epilogue.lin_che_lines,
      this.cv.epilogue.lin_yuan_message,
      this.cv.epilogue.ghost_cache
    ];
    let i = 0;
    const step = () => {
      const div = document.createElement('div');
      div.className = 'line' + (i === 0 ? ' ghost' : i === seq.length - 1 ? ' amber' : '');
      div.textContent = seq[i];
      card.appendChild(div);
      i += 1;
    };
    step();
    const next = document.createElement('button');
    next.textContent = '继续';
    next.dataset.action = 'epilogue-next';
    next.addEventListener('click', () => {
      if (i < seq.length) { step(); return; }
      const closed = document.createElement('div');
      closed.className = 'line small';
      closed.textContent = this.cv.epilogue.case_closed;
      card.appendChild(closed);
      const regrown = document.createElement('div');
      regrown.className = 'line amber';
      regrown.textContent = this.cv.epilogue.one_path_regrown;
      card.appendChild(regrown);
      next.textContent = '结束';
      next.replaceWith(next.cloneNode(true));
      const fin = card.querySelector('button');
      fin.dataset.action = 'case-close';
      fin.addEventListener('click', () => {
        this.machine.closeCase();
        onClosed?.();
      });
    });
    card.appendChild(next);
  }

  showEnd() {
    const el = this._overlayEl();
    const card = this._card(el);
    card.innerHTML = `<div class="tag">CASE 001 · CLOSED</div>
      <div class="line">「这次，可以慢慢想。」</div>
      <div class="small">Ghost Inside：心灵调理师 · 第一章「最优人生」演示结束</div>`;
    const btn = document.createElement('button');
    btn.textContent = '重新开始';
    btn.addEventListener('click', () => location.reload());
    card.appendChild(btn);
  }

  destroy() {
    this.clearTimers();
    this._overlay?.remove();
    this._overlay = null;
    this._pollEl = null;
    this._pollutionPhase = 'idle';
    document.querySelector('.hud')?.remove();
  }
}
