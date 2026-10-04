// audio.js — WebAudio 合成音（无外部资源）；首次用户手势后启用；静音也可完整流程
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._applause = null;
    this._heartbeat = null;
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
    if (this.muted) { this.applauseStop(); this.heartbeatStop(); }
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

  // UI/交互：短促滴答
  click() {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch { /* ignore */ }
  }

  // 跳跃：上扬气声
  jump() {
    if (!this.ctx || this.muted) return;
    try {
      const src = this._noise(0.18);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.15);
      filter.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.16);
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  // 受击/重置：低频闷响
  hit() {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.26);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  }

  // 弹幕发射：短促嘶声
  whoosh() {
    if (!this.ctx || this.muted) return;
    try {
      const src = this._noise(0.12);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3000;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  // 成功/观察完成：上行双音
  success() {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      [[523.25, 0], [783.99, 0.09]].forEach(([freq, delay]) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.07, now + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.4);
      });
    } catch { /* ignore */ }
  }

  // 污染段心跳：循环 lub-dub（.enter/.stop 成对调用）
  heartbeatStart() {
    if (!this.ctx || this.muted || this._heartbeat) return;
    const beat = () => {
      try {
        const now = this.ctx.currentTime;
        [0, 0.18].forEach((offset, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(i ? 52 : 64, now + offset);
          osc.frequency.exponentialRampToValueAtTime(38, now + offset + 0.12);
          gain.gain.setValueAtTime(0.0001, now + offset);
          gain.gain.exponentialRampToValueAtTime(i ? 0.1 : 0.14, now + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
          osc.connect(gain).connect(this.ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.2);
        });
      } catch { /* ignore */ }
    };
    beat();
    this._heartbeat = setInterval(beat, 950);
  }

  heartbeatStop() {
    if (this._heartbeat) { clearInterval(this._heartbeat); this._heartbeat = null; }
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
