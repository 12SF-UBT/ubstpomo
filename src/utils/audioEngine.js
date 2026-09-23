/**
 * Audio Engine for Pomodoro Timer
 * Handles ambient sounds, session chimes, volume control, and Web Audio API setup
 */

export const audioEngine = {
  context: null,
  gainNode: null,
  oscillator: null,
  ambientSource: null,
  ambientGain: null,
  isMuted: false,
  volume: 0.6,
  
  /**
   * Initialize Web Audio Context (must be called on user interaction)
   */
  initContext() {
    if (this.context) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.context = new AudioContext();
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.context.destination);
        this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
        console.log('Web Audio Context initialized');
      }
    } catch (err) {
      console.warn('Web Audio API not supported:', err);
    }
  },

  /**
   * Resume audio context if suspended (required by browser autoplay policy)
   */
  resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume().catch(err => {
        console.debug('Could not resume audio context:', err);
      });
    }
  },

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode) {
      this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
    }
  },

  /**
   * Mute/unmute audio
   */
  setMuted(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : this.volume;
    }
  },

  /**
   * Start ambient background sound loop
   * soundName: 'rain', 'waves', 'fire', 'forest', 'coffee'
   */
  startAmbient(soundName) {
    this.initContext();
    this.resumeContext();
    
    if (!this.context) return;

    // Stop any existing ambient
    this.stopAmbient();

    try {
      // For demo: create a simple tone loop instead of loading files
      // In production, load actual audio files
      const freq = this.getAmbientFrequency(soundName);
      const osc = this.context.createOscillator();
      const filter = this.context.createBiquadFilter();
      const lfo = this.context.createOscillator();
      const lfoGain = this.context.createGain();

      // Create ambient gain for separate control
      this.ambientGain = this.context.createGain();
      this.ambientGain.gain.value = this.volume * 0.3; // Quieter ambient

      // LFO modulation for organic feel
      lfo.frequency.value = 0.5;
      lfoGain.gain.value = 50;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // Filter for warmth
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 1;

      // Connect chain: osc -> filter -> gain -> destination
      osc.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.gainNode);

      // Start oscillators
      osc.start();
      lfo.start();

      this.ambientSource = { osc, lfo, filter };
      console.log(`Ambient sound started: ${soundName}`);
    } catch (err) {
      console.warn('Failed to start ambient sound:', err);
    }
  },

  /**
   * Stop ambient sound
   */
  stopAmbient() {
    if (this.ambientSource) {
      try {
        this.ambientSource.osc.stop();
        this.ambientSource.lfo.stop();
      } catch (err) {}
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.gain.value = 0;
    }
  },

  /**
   * Play session completion chime
   */
  playSessionChime() {
    this.initContext();
    this.resumeContext();
    
    if (!this.context || this.isMuted) return;

    try {
      const now = this.context.currentTime;
      const duration = 0.5;

      // Create chime sound using multiple tones
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 chord

      frequencies.forEach((freq, idx) => {
        const osc = this.context.createOscillator();
        const env = this.context.createGain();

        osc.frequency.value = freq;
        osc.type = 'sine';

        // Exponential decay envelope
        env.gain.setValueAtTime(this.volume * 0.5, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(env);
        env.connect(this.gainNode);

        osc.start(now + idx * 0.05);
        osc.stop(now + duration + idx * 0.05);
      });

      console.log('Session chime played');
    } catch (err) {
      console.warn('Failed to play chime:', err);
    }
  },

  /**
   * Get ambient frequency for different sounds
   */
  getAmbientFrequency(soundName) {
    const frequencies = {
      rain: 110,      // A2 - low, calming
      waves: 55,      // A1 - very low, oceanic
      fire: 220,      // A3 - medium, warming
      forest: 165,    // E3 - nature-like
      coffee: 146,    // D3 - cozy, cafe-like
    };
    return frequencies[soundName] || 110;
  },

  /**
   * Cleanup: stop all audio
   */
  cleanup() {
    this.stopAmbient();
    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch (err) {}
      this.oscillator = null;
    }
  }
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    audioEngine.cleanup();
  });
}
