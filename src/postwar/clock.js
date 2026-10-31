/* MPL-2.0 — 战后文明: one simulation clock, independent of UI animation. */
(function(root) {
  class SimulationClock {
    constructor(now = () => performance.now()) {
      this.now = now; this.time = 0; this.rate = 1; this.tasks = new Map(); this.serial = 0;
    }
    start() {
      this.last = this.now();
      this.driver = setInterval(() => {
        const n = this.now();
        // No offline catch-up, or destructive burst after a suspended computer wakes.
        const elapsed = Math.min(1000, Math.max(0, n - this.last)); this.last = n;
        this.advance(elapsed * this.rate);
      }, 100);
    }
    stop() { clearInterval(this.driver); this.tasks.clear(); }
    advance(ms) {
      const end = this.time + ms;
      let safety = 0;
      while (++safety < 20000) {
        let next;
        for (const task of this.tasks.values()) if (task.at <= end && (!next || task.at < next.at)) next = task;
        if (!next) break;
        this.time = next.at;
        if (next.period) next.at += next.period; else this.tasks.delete(next.id);
        next.fn();
      }
      this.time = end;
    }
    add(fn, ms, period = 0, key) {
      const id = ++this.serial;
      if (key) for (const task of this.tasks.values()) if (task.key === key) this.tasks.delete(task.id);
      const remaining = key && Number.isFinite(this.restored?.[key]) ? this.restored[key] : ms;
      if (key && this.restored) delete this.restored[key];
      this.tasks.set(id, {id, fn, at:this.time + Math.max(1, remaining), period, key});
      return id;
    }
    clear(id) { this.tasks.delete(id); }
    snapshot() {
      const timers = {...this.restored};
      for (const task of this.tasks.values()) if (task.key) timers[task.key] = Math.max(0, task.at - this.time);
      return timers;
    }
  }
  root.SimulationClock = SimulationClock;
})(globalThis);
