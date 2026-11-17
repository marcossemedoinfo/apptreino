// Sintetizador leve via Web Audio API (zero arquivos externos necessários)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('apptreino_muted') === '1';
  }

  ensureContext() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('apptreino_muted', this.muted ? '1' : '0');
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  playTone(freq, duration = 0.12, type = 'sine', volume = 0.14, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playClick() {
    this.playTone(620, 0.06, 'triangle', 0.08);
  }

  playCountdownTick(last = false) {
    this.playTone(last ? 880 : 540, last ? 0.16 : 0.08, 'sine', last ? 0.14 : 0.09);
  }

  playSetComplete() {
    this.playTone(523.25, 0.12, 'triangle', 0.12, 0);
    this.playTone(659.25, 0.18, 'triangle', 0.14, 0.1);
  }

  playStageComplete() {
    this.playTone(587.33, 0.14, 'sine', 0.14, 0);
    this.playTone(783.99, 0.14, 'sine', 0.14, 0.12);
    this.playTone(1046.5, 0.28, 'sine', 0.16, 0.24);
  }

  playWorkoutComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.28, 'triangle', 0.14, idx * 0.11);
    });
  }
}

export const sound = new SoundEngine();
