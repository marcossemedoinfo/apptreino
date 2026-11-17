// Gerenciador independente de cronômetros, séries, lados e progresso por item

import { sound } from './audio.js';

export function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatStopwatch(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const STORAGE_KEY = 'apptreino_state_v1';

export class TimerManager {
  constructor({ onChange, onComplete }) {
    this.onChange = onChange || (() => {});
    this.onComplete = onComplete || (() => {});
    this.items = new Map();
    this.configs = new Map();
    this.intervalId = null;
    this.activeKey = null;
    this.lastCountdownCue = new Map();
    this.persisted = this.loadPersisted();
  }

  loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { items: {}, completedWeeks: [], activeWeek: 1, activeProfile: 'marcos' };
    } catch {
      return { items: {}, completedWeeks: [], activeWeek: 1, activeProfile: 'marcos' };
    }
  }

  savePersisted() {
    try {
      const serializedItems = {};
      for (const [k, st] of this.items.entries()) {
        serializedItems[k] = {
          elapsedSeconds: Number(st.elapsedSeconds.toFixed(1)),
          totalLoggedSeconds: Number(st.totalLoggedSeconds.toFixed(1)),
          setsDone: st.setsDone,
          repsCount: st.repsCount,
          side: st.side,
          leftDone: st.leftDone,
          rightDone: st.rightDone,
          done: st.done
        };
      }
      this.persisted.items = { ...this.persisted.items, ...serializedItems };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.persisted));
    } catch {
      // Ignore storage quota errors
    }
  }

  getMeta(key, fallback) {
    return this.persisted[key] !== undefined ? this.persisted[key] : fallback;
  }

  setMeta(key, value) {
    this.persisted[key] = value;
    this.savePersisted();
  }

  registerItem(key, config) {
    this.configs.set(key, config);
    if (this.items.has(key)) return this.items.get(key);

    const saved = this.persisted.items?.[key];
    const setsTotal = config.sets || 1;
    const defaultSets = Array.from({ length: setsTotal }, () => false);

    const state = {
      key,
      mode: config.timerType || 'stopwatch', // 'countdown' | 'stopwatch'
      targetSeconds: config.seconds || 0,
      elapsedSeconds: saved?.elapsedSeconds || 0,
      totalLoggedSeconds: saved?.totalLoggedSeconds || 0,
      running: false,
      lastTickMs: 0,
      setsTotal,
      setsDone: Array.isArray(saved?.setsDone) && saved.setsDone.length === setsTotal ? saved.setsDone : defaultSets,
      repsTarget: config.reps || 0,
      repsCount: saved?.repsCount || 0,
      perSide: Boolean(config.perSide),
      side: saved?.side || 'right', // 'right' | 'left'
      leftDone: Boolean(saved?.leftDone),
      rightDone: Boolean(saved?.rightDone),
      done: Boolean(saved?.done)
    };

    this.items.set(key, state);
    return state;
  }

  getState(key) {
    return this.items.get(key) || null;
  }

  getDisplayTime(key) {
    const st = this.items.get(key);
    if (!st) return '00:00';
    if (st.mode === 'countdown') {
      const remaining = Math.max(0, st.targetSeconds - st.elapsedSeconds);
      return formatTime(remaining);
    }
    return formatStopwatch(st.elapsedSeconds);
  }

  getRemainingSeconds(key) {
    const st = this.items.get(key);
    if (!st || st.mode !== 'countdown') return 0;
    return Math.max(0, st.targetSeconds - st.elapsedSeconds);
  }

  startLoop() {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => this.tick(), 100);
  }

  stopLoopIfIdle() {
    for (const st of this.items.values()) {
      if (st.running) return;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  pauseAllExcept(exceptKey = null) {
    let changed = false;
    const now = performance.now();
    for (const [k, st] of this.items.entries()) {
      if (k !== exceptKey && st.running) {
        const dt = Math.max(0, (now - st.lastTickMs) / 1000);
        st.elapsedSeconds += dt;
        st.totalLoggedSeconds += dt;
        st.running = false;
        changed = true;
      }
    }
    if (changed) {
      this.savePersisted();
      this.stopLoopIfIdle();
    }
  }

  toggle(key) {
    const st = this.items.get(key);
    if (!st) return;

    if (st.running) {
      this.pause(key);
      return false;
    }

    // If countdown already reached 0, reset current countdown run before starting again
    if (st.mode === 'countdown' && st.elapsedSeconds >= st.targetSeconds) {
      st.elapsedSeconds = 0;
      this.lastCountdownCue.delete(key);
    }

    this.pauseAllExcept(key);
    st.running = true;
    st.lastTickMs = performance.now();
    this.activeKey = key;
    sound.playClick();
    this.startLoop();
    this.onChange(key, st);
    return true;
  }

  start(key) {
    const st = this.items.get(key);
    if (!st || st.running) return;
    this.toggle(key);
  }

  pause(key) {
    const st = this.items.get(key);
    if (!st || !st.running) return;
    const now = performance.now();
    const dt = Math.max(0, (now - st.lastTickMs) / 1000);
    st.elapsedSeconds += dt;
    st.totalLoggedSeconds += dt;
    st.running = false;
    this.savePersisted();
    this.stopLoopIfIdle();
    this.onChange(key, st);
  }

  resetTimer(key) {
    const st = this.items.get(key);
    if (!st) return;
    st.running = false;
    st.elapsedSeconds = 0;
    this.lastCountdownCue.delete(key);
    this.savePersisted();
    this.stopLoopIfIdle();
    this.onChange(key, st);
  }

  resetItemFull(key) {
    const st = this.items.get(key);
    if (!st) return;
    st.running = false;
    st.elapsedSeconds = 0;
    st.setsDone = st.setsDone.map(() => false);
    st.repsCount = 0;
    st.leftDone = false;
    st.rightDone = false;
    st.side = 'right';
    st.done = false;
    this.lastCountdownCue.delete(key);
    this.savePersisted();
    this.stopLoopIfIdle();
    this.onChange(key, st);
  }

  setSide(key, side) {
    const st = this.items.get(key);
    if (!st) return;
    st.side = side === 'left' ? 'left' : 'right';
    // When switching side on a timed per-side item that was finished, reset timer ready for the new side
    if (st.mode === 'countdown' && st.elapsedSeconds >= st.targetSeconds) {
      st.elapsedSeconds = 0;
      st.running = false;
      this.lastCountdownCue.delete(key);
    }
    sound.playClick();
    this.savePersisted();
    this.onChange(key, st);
  }

  toggleSet(key, setIndex) {
    const st = this.items.get(key);
    if (!st || setIndex < 0 || setIndex >= st.setsDone.length) return;
    st.setsDone[setIndex] = !st.setsDone[setIndex];
    st.done = st.setsDone.every(Boolean);
    if (st.setsDone[setIndex]) {
      st.repsCount = st.repsTarget;
      sound.playSetComplete();
    } else {
      sound.playClick();
    }
    this.savePersisted();
    this.onChange(key, st);
  }

  adjustReps(key, delta) {
    const st = this.items.get(key);
    if (!st || st.repsTarget <= 0) return;
    st.repsCount = Math.max(0, Math.min(st.repsTarget, st.repsCount + delta));
    sound.playClick();
    if (st.repsCount === st.repsTarget) {
      const nextIdx = st.setsDone.findIndex(v => !v);
      if (nextIdx !== -1) {
        st.setsDone[nextIdx] = true;
        sound.playSetComplete();
        if (st.setsDone.every(Boolean)) {
          st.done = true;
        } else {
          st.repsCount = 0;
        }
      }
    }
    this.savePersisted();
    this.onChange(key, st);
  }

  toggleDone(key) {
    const st = this.items.get(key);
    if (!st) return;
    st.done = !st.done;
    if (st.done) {
      st.setsDone = st.setsDone.map(() => true);
      if (st.perSide) {
        st.leftDone = true;
        st.rightDone = true;
      }
      st.running = false;
      sound.playSetComplete();
    } else {
      st.setsDone = st.setsDone.map(() => false);
      st.leftDone = false;
      st.rightDone = false;
      sound.playClick();
    }
    this.savePersisted();
    this.stopLoopIfIdle();
    this.onChange(key, st);
  }

  tick() {
    const now = performance.now();
    let anyRunning = false;

    for (const [key, st] of this.items.entries()) {
      if (!st.running) continue;
      anyRunning = true;

      const dt = Math.max(0, (now - st.lastTickMs) / 1000);
      st.lastTickMs = now;
      st.elapsedSeconds += dt;
      st.totalLoggedSeconds += dt;

      if (st.mode === 'countdown') {
        const remaining = Math.max(0, st.targetSeconds - st.elapsedSeconds);
        const ceilSec = Math.ceil(remaining);

        if (ceilSec <= 3 && ceilSec >= 1) {
          const prevCue = this.lastCountdownCue.get(key);
          if (prevCue !== ceilSec) {
            this.lastCountdownCue.set(key, ceilSec);
            sound.playCountdownTick(ceilSec === 1);
          }
        }

        if (remaining <= 0) {
          st.elapsedSeconds = st.targetSeconds;
          st.running = false;
          this.lastCountdownCue.delete(key);
          this.handleCountdownFinished(key, st);
        }
      }

      this.onChange(key, st);
    }

    if (!anyRunning) {
      this.stopLoopIfIdle();
    }
  }

  handleCountdownFinished(key, st) {
    let message = '';
    if (st.perSide) {
      if (st.side === 'right') {
        st.rightDone = true;
        if (!st.leftDone) {
          st.side = 'left';
          st.elapsedSeconds = 0;
          sound.playSetComplete();
          message = 'Lado direito concluído! Troque para o lado esquerdo.';
        } else {
          st.done = true;
          st.leftDone = false;
          st.rightDone = false;
          st.side = 'right';
          message = 'Concluído!';
        }
      } else {
        st.leftDone = true;
        if (!st.rightDone) {
          st.side = 'right';
          st.elapsedSeconds = 0;
          sound.playSetComplete();
          message = 'Lado esquerdo concluído! Troque para o lado direito.';
        } else {
          st.done = true;
          st.leftDone = false;
          st.rightDone = false;
          st.side = 'right';
          message = 'Concluído!';
        }
      }
    } else {
      st.done = true;
      message = 'Concluído!';
    }

    if (st.done) {
      sound.playStageComplete();
    }

    this.savePersisted();
    this.stopLoopIfIdle();
    this.onComplete(key, st, message);
  }

  markNextSetDone(st) {
    const idx = st.setsDone.findIndex(v => !v);
    if (idx !== -1) {
      st.setsDone[idx] = true;
    }
    if (st.setsDone.every(Boolean)) {
      st.done = true;
    } else {
      st.elapsedSeconds = 0;
    }
  }

  getTotalLoggedSecondsForPrefix(prefix) {
    let sum = 0;
    for (const [k, st] of this.items.entries()) {
      if (k.startsWith(prefix)) {
        sum += st.totalLoggedSeconds || 0;
      }
    }
    return Math.floor(sum);
  }

  clearDayProgress(prefix) {
    for (const [k, st] of this.items.entries()) {
      if (k.startsWith(prefix)) {
        st.running = false;
        st.elapsedSeconds = 0;
        st.totalLoggedSeconds = 0;
        st.setsDone = st.setsDone.map(() => false);
        st.repsCount = 0;
        st.leftDone = false;
        st.rightDone = false;
        st.side = 'right';
        st.done = false;
      }
    }
    if (this.persisted.items) {
      for (const k of Object.keys(this.persisted.items)) {
        if (k.startsWith(prefix)) {
          delete this.persisted.items[k];
        }
      }
    }
    this.savePersisted();
    this.stopLoopIfIdle();
  }
}
