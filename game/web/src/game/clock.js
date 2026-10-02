// clock.js — 固定步长游戏时钟；真实模式 + 测试推进模式；真后台才暂停
// 驱动三级回退：rAF（正常浏览器）→ Worker 心跳（内嵌浏览器 rAF/interval 被节流时）
// → 主线程 interval 兜底（Worker 不可用的环境）
export class GameClock {
  constructor({ fixedStepMs = 16.6667, maxFrameMs = 100 } = {}) {
    this.fixedStepMs = fixedStepMs;
    this.maxFrameMs = maxFrameMs;
    this.simMs = 0;
    this.paused = false;
    this.testMode = false;
    this._raf = null;
    this._lastReal = 0;
    this._lastRafAt = 0;
    this._update = null;
    this._worker = null;
    // 暂停只认「真正不可见」（切标签页/最小化）。内嵌浏览器面板失去焦点但仍可见时
    // 不暂停——那种环境里 window blur 常年在触发，按失焦暂停会让画面永久静止。
    this._onVisibility = () => {
      this.paused = document.hidden;
      if (!document.hidden) this._lastReal = performance.now();
    };
  }

  start(update) {
    this._update = update;
    this._lastReal = performance.now();
    document.addEventListener('visibilitychange', this._onVisibility);
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      this._lastRafAt = now;
      if (this.testMode) return; // 测试模式下仅由 stepSimulation 推进
      let delta = now - this._lastReal;
      this._lastReal = now;
      if (this.paused) return;
      if (delta > this.maxFrameMs) delta = this.maxFrameMs; // 切标签页后不瞬移
      this.advance(delta);
    };
    this._raf = requestAnimationFrame(loop);

    // 部分内嵌浏览器：页面可见但合成器不驱动 rAF，主线程 interval 还被节流到 1Hz；
    // Worker 的计时器不受影响，用它的 postMessage 心跳驱动主循环（消息事件不被节流）。
    try {
      const src = 'setInterval(()=>postMessage(0),50);';
      this._worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this._worker.onmessage = () => this._tick();
    } catch {
      this._worker = null; // Worker 不可用（如 CSP 限制）→ 走下面的 interval 兜底
    }
    this._watchdog = setInterval(() => this._tick(), 200);
  }

  // 心跳节拍：rAF 正常时让位；停摆时按真实流逝时间推进（幂等，多源不会重复计时）
  _tick() {
    if (this.testMode || this.paused) return;
    const now = performance.now();
    if (this._lastRafAt && now - this._lastRafAt < 1200) return; // rAF 还活着
    let delta = now - this._lastReal;
    this._lastReal = now;
    if (delta <= 0) return;
    if (delta > this.maxFrameMs) delta = this.maxFrameMs;
    this.advance(delta);
  }

  advance(deltaMs) {
    let left = Math.min(deltaMs, this.maxFrameMs);
    while (left > 1e-6) {
      const step = Math.min(this.fixedStepMs, left);
      this.simMs += step;
      this._update?.(step);
      left -= step;
    }
  }

  // 测试推进：每次最多 1000ms，按固定步长拆分（正式更新逻辑）
  // 不受 maxFrameMs 截断——那是防真实帧瞬移的，测试推进是显式指令
  advanceTestClock(ms) {
    if (ms <= 0 || !Number.isFinite(ms)) return;
    this.testMode = true;
    this.paused = false;
    let left = Math.min(ms, 1000);
    while (left > 1e-6) {
      const step = Math.min(this.fixedStepMs, left);
      this.simMs += step;
      this._update?.(step);
      left -= step;
    }
  }

  stop() {
    cancelAnimationFrame(this._raf);
    if (this._watchdog) clearInterval(this._watchdog);
    if (this._worker) { this._worker.terminate(); this._worker = null; }
    document.removeEventListener('visibilitychange', this._onVisibility);
  }
}
