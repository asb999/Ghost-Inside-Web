// audio.js — WebAudio 合成音（无外部资源）；首次用户手势后启用；静音也可完整流程
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._applause = null;
  }

  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.ctx = null; // 无音频环境不阻塞流程
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.applauseStop();
    return this.muted;
  }

  _noise(duration = 1) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  applauseStart() {
    if (!this.ctx || this.muted || this._applause) return;
    try {
      const src = this._noise(8);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.12;
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.loop = true;
      src.start();
      this._applause = { src, gain };
    } catch { /* 音频失败不阻塞 */ }
  }

  applauseStop() {
    if (!this._applause) return;
    try {
      const { src, gain } = this._applause;
      gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 400);
    } catch { /* ignore */ }
    this._applause = null;
  }

  // 终端关闭后：全区静音，只剩一次呼吸声
  breath() {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 140;
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, this.ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.6);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.8);
    } catch { /* ignore */ }
  }
}
