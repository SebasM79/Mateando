// Motor de Sonido y Alarmas con Web Audio API (Nativo, sin dependencias externas)
class MateSoundEngine {
  constructor() {
    this.ctx = null;
    this.alarmInterval = null;
    this.isAlarmPlaying = false;
    this.muted = false;
    this.soundType = "pava"; // "pava" (Silbido de pava) | "campana" (Campana rítmica)
    this.pavaNodes = null;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setSoundType(type) {
    if (type === "pava" || type === "campana") {
      this.soundType = type;
    }
  }

  // Tono agradable de confirmación (Mate entregado)
  playDelivered() {
    if (this.muted) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Tono de mate devuelto al cebador (Mate recibido)
  playReceived() {
    if (this.muted) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    // Doble campana armónica
    [
      { freq: 587.33, start: 0, dur: 0.2 }, // D5
      { freq: 880.0, start: 0.1, dur: 0.3 }, // A5
    ].forEach((tone) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.25, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + tone.start + tone.dur,
      );

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur);
    });
  }

  // Sonido cuando alguien dice "No quiero más"
  playOptOut() {
    if (this.muted) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.3);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Sonido de recarga de termo de agua caliente
  playTermoRefill() {
    if (this.muted) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    // Tono ascendente burbujeante
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.22);
    });
  }

  // Sintetizador acústico de silbido de pava hirviendo
  _playPavaWhistlePulse() {
    if (!this.isAlarmPlaying || this.muted) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    // Oscilador de silbato principal
    const osc = this.ctx.createOscillator();
    const oscHarmonic = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // LFO para el vibrato natural del vapor
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(6.5, now); // 6.5 Hz de trémolo de vapor
    lfoGain.gain.setValueAtTime(45, now); // Amplitud de modulación de 45 Hz

    lfo.connect(osc.frequency);
    lfo.connect(oscHarmonic.frequency);

    osc.type = "sine";
    // Silbido agudo que sube de tono al hervir (1850 Hz -> 2150 Hz)
    osc.frequency.setValueAtTime(1850, now);
    osc.frequency.linearRampToValueAtTime(2150, now + 0.55);
    osc.frequency.linearRampToValueAtTime(2050, now + 0.85);

    oscHarmonic.type = "triangle";
    oscHarmonic.frequency.setValueAtTime(3700, now);
    oscHarmonic.frequency.linearRampToValueAtTime(4300, now + 0.55);

    // Envolvente de volumen tipo silbido de pava que sopla
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.2);
    gain.gain.setValueAtTime(0.25, now + 0.65);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.95);

    // Ruido de vapor blanco suave filtrado
    const bufferSize = this.ctx.sampleRate * 0.9;
    const noiseBuffer = this.ctx.createBuffer(
      1,
      bufferSize,
      this.ctx.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(3.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.04, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    osc.connect(gain);
    oscHarmonic.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start(now);
    osc.start(now);
    oscHarmonic.start(now);
    whiteNoise.start(now);

    const stopTime = now + 0.95;
    lfo.stop(stopTime);
    osc.stop(stopTime);
    oscHarmonic.stop(stopTime);
    whiteNoise.stop(stopTime);
  }

  _playCampanaPulse() {
    if (!this.isAlarmPlaying || this.muted) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "square";
    osc1.frequency.setValueAtTime(880, now);

    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(1108.73, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  }

  // Iniciar alarma continua
  startAlarm() {
    if (this.isAlarmPlaying) return;
    this._ensureContext();
    this.isAlarmPlaying = true;

    const pulse = () => {
      if (!this.isAlarmPlaying || this.muted) return;
      if (this.soundType === "pava") {
        this._playPavaWhistlePulse();
      } else {
        this._playCampanaPulse();
      }
    };

    pulse();
    const intervalMs = this.soundType === "pava" ? 1150 : 900;
    this.alarmInterval = setInterval(pulse, intervalMs);
  }

  stopAlarm() {
    this.isAlarmPlaying = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  previewSound(type = "pava") {
    this._ensureContext();
    const prevPlaying = this.isAlarmPlaying;
    this.isAlarmPlaying = true;
    const prevType = this.soundType;
    this.soundType = type;

    if (type === "pava") {
      this._playPavaWhistlePulse();
    } else {
      this._playCampanaPulse();
    }

    setTimeout(() => {
      this.isAlarmPlaying = prevPlaying;
      this.soundType = prevType;
    }, 1200);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.isAlarmPlaying) {
      this.stopAlarm();
    }
    return this.muted;
  }
}

window.mateAudio = new MateSoundEngine();
