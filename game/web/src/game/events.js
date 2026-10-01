// events.js — 实际发生的事件记录（append-only）
export class EventLog {
  constructor() {
    this.items = [];
  }
  push(id, detail = {}) {
    this.items.push({ id, at: this.now(), ...detail });
  }
  now() {
    return performance.now();
  }
  has(id) {
    return this.items.some((e) => e.id === id);
  }
  count(id) {
    return this.items.filter((e) => e.id === id).length;
  }
  history() {
    return this.items.map((e) => ({ ...e }));
  }
}
