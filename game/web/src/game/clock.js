// clock.js — 固定步长游戏时钟；真实模式 + 测试推进模式；失焦暂停
export class GameClock {
  constructor({ fixedStepMs = 16.6667, maxFrameMs = 100 } = {}) {
    this.fixedStepMs = fixedStepMs;
    this.maxFrameMs = maxFrameMs;
    this.simMs = 0;
    this.paused = false;
    this.testMode = false;
    this._raf = null;
    this._lastReal = 0;
    this._update = null;
    this._onBlur = () => { this.paused = true; };
    this._onFocus = () => { this.paused = false; this._lastReal = performance.now(); };
  }

  start(update) {
    this._update = update;
    this._lastReal = performance.now();
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('focus', this._onFocus);
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      if (this.testMode) return; // 测试模式下仅由 stepSimulation 推进
      let delta = now - this._lastReal;
      this._lastReal = now;
      if (this.paused) return;
      if (delta > this.maxFrameMs) delta = this.maxFrameMs; // 切标签页后不瞬移
      this.advance(delta);
    };
    this._raf = requestAnimationFrame(loop);
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
  advanceTestClock(ms) {
    if (ms <= 0 || !Number.isFinite(ms)) return;
    this.testMode = true;
    this.paused = false;
    this.advance(Math.min(ms, 1000));
  }

  stop() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('focus', this._onFocus);
  }
}
