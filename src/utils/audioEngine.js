/**
 * Audio Engine for Pomodoro Timer
 * Provides rich, loud yet soothing 4-second transition alarms when sessions switch
 * between Study and Break. Ambient sound loop system has been removed.
 */

export const audioEngine = {
  context: null,
  gainNode: null,
  isMuted: false,
  volume: 0.8,
  activeAlarmNodes: [],
  
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
   * Stop any currently sounding alarm nodes
   */
  stopAlarm() {
    if (this.activeAlarmNodes && this.activeAlarmNodes.length > 0) {
      this.activeAlarmNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {}
      });
      this.activeAlarmNodes = [];
    }
  },

  /**
   * Helper to play an organic harmonic bell/chime note with rich overtones
   */
  playBellNote(startTime, fundamentalFreq, peakGain, duration, type = 'sine') {
    if (!this.context || !this.gainNode) return;

    // Harmonic overtones: fundamental (1x), octave (2x), fifth (3x), double octave (4.2x)
    const harmonics = [
      { ratio: 1.0, gainMult: 0.65 },
      { ratio: 2.0, gainMult: 0.35 },
      { ratio: 3.0, gainMult: 0.15 },
      { ratio: 4.2, gainMult: 0.08 }
    ];

    harmonics.forEach(({ ratio, gainMult }) => {
      const osc = this.context.createOscillator();
      const noteGain = this.context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(fundamentalFreq * ratio, startTime);

      // Attack (rapid rise), Decay to gentle ringing sustain, smooth fade out
      const attackTime = 0.04;
      const initialPeak = Math.max(0.0001, peakGain * gainMult * this.volume);
      
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(initialPeak, startTime + attackTime);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(this.gainNode);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);

      this.activeAlarmNodes.push(osc, noteGain);
    });
  },

  /**
   * 4-second transition alarm: Break -> Study (Time to Focus)
   * Bright, uplifting, energizing Tibetan/zen chime progression (E4 -> G#4 -> B4 -> E5)
   * Loud, distinct, yet soothing without harsh jarring buzzes.
   */
  playStudyAlarm() {
    this.initContext();
    this.resumeContext();
    if (!this.context || this.isMuted) return;

    try {
      this.stopAlarm();
      const now = this.context.currentTime;
      // 4 uplifting chime strikes over 4 seconds
      const notes = [
        { time: 0.0,  freq: 329.63, dur: 2.2, gain: 0.85 }, // E4
        { time: 0.85, freq: 415.30, dur: 2.2, gain: 0.90 }, // G#4
        { time: 1.70, freq: 493.88, dur: 2.2, gain: 0.95 }, // B4
        { time: 2.55, freq: 659.25, dur: 1.45, gain: 1.0  }, // E5 (bright finale ringing through 4.0s)
      ];

      notes.forEach(({ time, freq, dur, gain }) => {
        this.playBellNote(now + time, freq, gain, dur, 'sine');
      });

      console.log('Study transition alarm played (4s)');
    } catch (err) {
      console.warn('Failed to play study alarm:', err);
    }
  },

  /**
   * 4-second transition alarm: Study -> Break (Time to Rest)
   * Calming, warm, relaxing descending singing-bowl sequence (A4 -> F#4 -> D4 -> A3)
   * Loud, reassuring, and very soothing.
   */
  playBreakAlarm() {
    this.initContext();
    this.resumeContext();
    if (!this.context || this.isMuted) return;

    try {
      this.stopAlarm();
      const now = this.context.currentTime;
      // 4 warm relaxing chime strikes over 4 seconds
      const notes = [
        { time: 0.0,  freq: 440.00, dur: 2.2, gain: 0.90 }, // A4
        { time: 0.85, freq: 369.99, dur: 2.2, gain: 0.90 }, // F#4
        { time: 1.70, freq: 293.66, dur: 2.2, gain: 0.95 }, // D4
        { time: 2.55, freq: 220.00, dur: 1.45, gain: 1.0  }, // A3 (deep relaxing resonance to 4.0s)
      ];

      notes.forEach(({ time, freq, dur, gain }) => {
        this.playBellNote(now + time, freq, gain, dur, 'triangle');
      });

      console.log('Break transition alarm played (4s)');
    } catch (err) {
      console.warn('Failed to play break alarm:', err);
    }
  },

  /**
   * Generic trigger based on next session type ('study' or 'break')
   */
  playTransitionAlarm(nextSessionType) {
    if (nextSessionType === 'break') {
      this.playBreakAlarm();
    } else {
      this.playStudyAlarm();
    }
  },

  /**
   * Backward compatibility for session chime
   */
  playSessionChime(nextSessionType = 'study') {
    this.playTransitionAlarm(nextSessionType);
  },

  /**
   * Stop ambient sound (no-op for compatibility)
   */
  startAmbient() {},
  stopAmbient() {},

  /**
   * Cleanup: stop all audio
   */
  cleanup() {
    this.stopAlarm();
    if (this.context && this.context.state !== 'closed') {
      try {
        this.context.close();
      } catch (err) {}
      this.context = null;
    }
  }
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    audioEngine.cleanup();
  });
}
