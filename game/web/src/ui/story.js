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

  // ── 二幕 · 饭桌三循环 + 记忆碎片调查 ──
  showDinner() {
    const el = this._overlayEl('dim');
    const card = this._card(el);
    card.innerHTML = `<div class="tag">记忆回放 · ${this.cv.dinner.memory_title}</div>`;
    this._cycle(card, 0);
  }

  _cycle(card, idx) {
    if (idx >= this.cv.dinner.cycles.length) return this._investigate(card);
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

  _investigate(card) {
    const reveal = this.cv.reveal;
    card.replaceChildren();
    card.insertAdjacentHTML('beforeend', `<div class="tag">记忆裂缝 · 不要读报告，去看他做过的选择</div>
      <div class="line ghost">Ghost：记录太多会把人藏起来。翻开三处裂缝，找出是谁一次次按下了确认。</div>`);

    const sampleIndexes = [0, Math.floor(reveal.records.length / 2), reveal.records.length - 1];
    const samples = sampleIndexes.map((i) => reveal.records[i]);
    const trail = document.createElement('div');
    trail.className = 'memory-trail';
    trail.dataset.story = 'memory-trail';
    const inspected = new Set();
    const prompt = document.createElement('div');
    prompt.className = 'sys-toast';
    prompt.textContent = '翻开 3 段记忆碎片。';

    const showGuess = () => {
      if (inspected.size < samples.length || card.querySelector('[data-story="editor-guess"]')) return;
      prompt.textContent = '三次都没有系统强制记录。那么，是谁删掉了出口？';
      const guess = document.createElement('div');
      guess.className = 'editor-guess';
      guess.dataset.story = 'editor-guess';
      const choices = [
        ['system', '最优人生系统'],
        ['father', '父亲'],
        ['lin_che', '林澈自己']
      ];
      for (const [id, label] of choices) {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.textContent = label;
        choice.dataset.action = 'editor-guess';
        choice.dataset.editorId = id;
        choice.addEventListener('click', () => {
          if (id !== 'lin_che') {
            choice.disabled = true;
            choice.classList.add('wrong');
            this.machine.recordRevealGuess(id);
            prompt.textContent = id === 'system'
              ? '系统只提供了“最稳妥”；这三次确认都来自同一个人。'
              : '父亲的期待很重，但记录中没有他的操作。';
            return;
          }
          if (!this.machine.recordRevealGuess(id)) return;
          guess.querySelectorAll('button').forEach((b) => (b.disabled = true));
          choice.classList.add('right');
          prompt.textContent = '47 次修改，发起账号都是林澈。系统没有动过一次手。';
          const insight = document.createElement('div');
          insight.className = 'insight-line';
          insight.textContent = '他不是没有选择，而是学会了在别人开口前，先删掉自己。';
          const go = document.createElement('button');
          go.textContent = '带着这个发现继续';
          go.dataset.action = 'to-pollution';
          go.addEventListener('click', () => {
            go.disabled = true;
            this.machine.advance('pollution');
          });
          card.append(insight, go);
        });
        guess.appendChild(choice);
      }
      card.appendChild(guess);
    };

    for (const [index, record] of samples.entries()) {
      const shard = document.createElement('button');
      shard.type = 'button';
      shard.className = 'memory-shard';
      shard.dataset.action = 'inspect-memory';
      shard.dataset.recordId = record.id;
      shard.innerHTML = `<span class="memory-year">${record.stage}</span><span class="memory-hidden">点击翻开这段记忆</span>`;
      shard.addEventListener('click', () => {
        if (inspected.has(record.id)) return;
        inspected.add(record.id);
        this.machine.recordDinnerClue(record.id);
        shard.classList.add('open');
        shard.innerHTML = `<span class="memory-year">${record.stage}</span><strong>${record.act}</strong><span class="memory-editor">修改人：■■■■</span>`;
        prompt.textContent = `已翻开 ${inspected.size}/3 · 这不是三条报告，是同一个人三次放弃开口。`;
        showGuess();
      });
      shard.style.setProperty('--memory-order', index);
      trail.appendChild(shard);
    }
    card.append(trail, prompt);
  }

  // ── 污染（由主循环按模拟时间驱动）──
  showPollution() {
    const el = this._overlayEl();
    const card = this._card(el);
    card.innerHTML = `<div class="tag">记忆拉扯 · 系统正在把发现改回“正确答案”</div>
      <div class="carried-truth">你刚刚发现：<strong>他亲手确认了 47 次，也仍然可以重新选择。</strong></div>
      <div class="sys-toast" id="pollution-toast"></div>
      <div class="option-list" id="pollution-options"></div>
      <div class="memory-anchors" id="memory-anchors" aria-live="polite"></div>
      <div class="small">Ghost：不用赢过它。在选项变模糊时按 E，证明你还看得见。</div>`;
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
        this._pollutionFeedback = '你守住了一瞬。记忆会继续被改写，但这句话留下了。';
        this._pollutionFeedbackRemaining = 700;
        this._addMemoryAnchor(this._pollutionStep);
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
      const threatened = ['“我不知道”', '“先停下来”', '“我也喜欢创造”', '“职业不是全部的我”', '“我可以重新选”'][this._pollutionStep - 1];
      toast.textContent = resisted
        ? `${threatened} 已被你记住 · ${seconds}s 后系统继续`
        : `系统正在抹去 ${threatened} · ${seconds}s 内按 E 守住`;
    } else if (this._pollutionPhase === 'recovery') {
      toast.textContent = '所有选项已经被改写。最后机会：按 E 抵抗一次（窗口保持开放）。';
    } else if (this._pollutionPhase === 'exit') {
      toast.textContent = '按 E 撕开出口，进入表态点。';
    }
  }

  _addMemoryAnchor(step) {
    const anchors = this._pollEl?.querySelector('#memory-anchors');
    if (!anchors || anchors.querySelector(`[data-step="${step}"]`)) return;
    const phrases = ['我可以说不知道', '我可以先停下来', '我还想创造', '我不只是一个职业', '我可以重新选'];
    const anchor = document.createElement('span');
    anchor.dataset.step = String(step);
    anchor.textContent = phrases[step - 1];
    anchors.appendChild(anchor);
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
    const seq = [this.cv.epilogue.ghost_question, ...this.cv.epilogue.lin_che_lines,
      this.cv.epilogue.lin_yuan_message, '“这次，可以慢慢想。”'];
    let i = 0;
    const step = () => {
      card.querySelector('[data-story="epilogue-line"]')?.remove();
      const div = document.createElement('div');
      div.className = 'line' + (i === 0 ? ' ghost' : i === seq.length - 1 ? ' amber' : '');
      div.dataset.story = 'epilogue-line';
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
      card.querySelector('[data-story="epilogue-line"]')?.remove();
      const regrown = document.createElement('div');
      regrown.className = 'line amber';
      regrown.textContent = this.cv.epilogue.one_path_regrown;
      card.appendChild(regrown);
      next.textContent = '把这条路留下';
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
