// Web Audio API Procedural Audio Engine for Ambient Noise and Alarm Chimes
// No external dependencies, 100% offline reliable sound generator

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.masterGain = null;
    this.ambientSourceNode = null;
    this.ambientFilterNode = null;
    this.currentSoundType = null; // 'rain', 'waves', 'drone', 'off'
    this.isPlayingAmbient = false;
    this.volume = 0.5;
    this.isMuted = false;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.ambientGain = this.ctx.createGain();
        
        this.updateMasterVolume();
        this.ambientGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updateMasterVolume() {
    if (!this.masterGain) return;
    const effectiveVol = this.isMuted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(effectiveVol, this.ctx ? this.ctx.currentTime : 0, 0.05);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.updateMasterVolume();
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.updateMasterVolume();
  }

  stopAmbientNode() {
    if (this.ambientSourceNode) {
      try {
        this.ambientSourceNode.stop();
        this.ambientSourceNode.disconnect();
      } catch (e) {}
      this.ambientSourceNode = null;
    }
    if (this.ambientFilterNode) {
      try {
        this.ambientFilterNode.disconnect();
      } catch (e) {}
      this.ambientFilterNode = null;
    }
  }

  // Generate buffer for Pink / Brown / White noise
  createNoiseBuffer(type = 'brown') {
    if (!this.ctx) return null;
    const bufferSize = 5 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let lastOut = 0.0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'brown' || type === 'rain') {
        // Brown noise approximation for rain
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // boost volume
      } else if (type === 'waves' || type === 'pink') {
        // Pink noise approximation
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      } else {
        output[i] = white * 0.1;
      }
    }
    return buffer;
  }

  startAmbient(soundType) {
    this.initContext();
    if (!this.ctx) return;

    if (soundType === 'off' || !soundType) {
      this.stopAmbient();
      return;
    }

    // If same sound type is already running, keep it
    if (this.currentSoundType === soundType && this.isPlayingAmbient) {
      return;
    }

    this.stopAmbientNode();
    this.currentSoundType = soundType;
    this.isPlayingAmbient = true;

    if (soundType === 'rain') {
      const buffer = this.createNoiseBuffer('rain');
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Low pass filter for soft rain feel
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(this.ambientGain);
      noise.start();

      this.ambientSourceNode = noise;
      this.ambientFilterNode = filter;
    } else if (soundType === 'waves') {
      const buffer = this.createNoiseBuffer('pink');
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

      // LFO to simulate wave swell
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8 sec wave swell cycle
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(300, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      noise.connect(filter);
      filter.connect(this.ambientGain);
      noise.start();

      this.ambientSourceNode = noise;
      this.ambientFilterNode = filter;
    } else if (soundType === 'drone') {
      // Warm synth chord drone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(110, this.ctx.currentTime); // A2
      osc2.frequency.setValueAtTime(164.81, this.ctx.currentTime); // E3

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);

      osc1.start();
      osc2.start();

      this.ambientSourceNode = {
        stop: () => {
          osc1.stop();
          osc2.stop();
        },
        disconnect: () => {
          osc1.disconnect();
          osc2.disconnect();
        }
      };
      this.ambientFilterNode = filter;
    }
  }

  stopAmbient() {
    this.stopAmbientNode();
    this.isPlayingAmbient = false;
    this.currentSoundType = 'off';
  }

  // Play session finish bell/chime
  playSessionChime() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    
    // Multi-frequency warm chime
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (C Major chord)

    frequencies.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 2.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 2.6);
    });
  }
}

export const audioEngine = new AudioEngine();
