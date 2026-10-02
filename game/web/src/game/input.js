// input.js — 键盘与测试共用的输入入口；失焦清空按键状态
const KEYMAP = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'jump',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'forward',
  ArrowDown: 'back',
  KeyW: 'forward',
  KeyS: 'back',
  Enter: 'interact',
  KeyE: 'interact'
};

export class Input {
  constructor() {
    this.actions = new Set();
    this._onBlur = () => this.clear();
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (a) { this.actions.add(a); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.actions.delete(a);
    });
  }
  setAction(action, pressed) {
    if (pressed) this.actions.add(action);
    else this.actions.delete(action);
  }
  isDown(action) {
    return this.actions.has(action);
  }
  clear() {
    this.actions.clear();
  }
}
