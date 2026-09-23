import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { syncChannel } from '../utils/syncChannel';

const STORAGE_KEY = 'ubst_pomo_settings_v1';

const DEFAULT_SETTINGS = {
  modeType: 'standard', // 'standard' | 'custom'
  // Standard mode config
  studyDuration: 50, // in minutes
  shortBreakDuration: 10,
  longBreakDuration: 30,
  longBreakAfter: 4,

  // Custom mode config
  customSequence: [
    { id: '1', name: 'Focus Phase 1', type: 'study', duration: 50 },
    { id: '2', name: 'Quick Rest', type: 'break', duration: 10 },
    { id: '3', name: 'Deep Work Phase', type: 'study', duration: 90 },
    { id: '4', name: 'Mid Rest', type: 'break', duration: 15 },
    { id: '5', name: 'Focus Phase 2', type: 'study', duration: 45 },
    { id: '6', name: 'Long Rest', type: 'break', duration: 30 },
    { id: '7', name: 'Final Sprint', type: 'study', duration: 60 },
  ],

  // Repeat config
  repeatMode: 'continuous', // 'continuous' | 'count' | 'none'
  targetLoops: 1,

  // Audio settings
  studySound: 'rain', // 'rain' | 'waves' | 'drone' | 'off'
  breakSound: 'waves',
  volume: 0.6,
  isMuted: false,
  isAmbientEnabled: true,

  // Overlay customizations
  overlayFontSize: 140, // in px
  overlayColor: '#ffffff',
  overlayLabelColor: '#fef08a', // warm yellow as in user image
  overlayLabelFontSize: 36, // in px
  overlayShowLabel: true,
  overlayShowSessionCount: true,
  overlayFontFamily: 'mono', // 'mono' | 'sans'
};

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  // Load settings from localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse saved settings', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Current session tracking
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentLoopCount, setCurrentLoopCount] = useState(1);
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'paused'
  
  // Seconds remaining in current step
  const [timeLeft, setTimeLeft] = useState(settings.studyDuration * 60);

  // Timer interval ref
  const timerRef = useRef(null);
  const endTimeRef = useRef(null);

  // Calculate current active session sequence array based on modeType
  const getSequence = (currentSettings = settings) => {
    if (currentSettings.modeType === 'custom') {
      return currentSettings.customSequence.length > 0
        ? currentSettings.customSequence
        : [{ id: 'def', name: 'Study', type: 'study', duration: currentSettings.studyDuration }];
    }

    // Generate standard Pomodoro sequence array
    const seq = [];
    for (let i = 1; i <= currentSettings.longBreakAfter; i++) {
      seq.push({
        id: `std-study-${i}`,
        name: 'STUDY',
        type: 'study',
        duration: currentSettings.studyDuration,
        stepNumber: i,
      });
      if (i < currentSettings.longBreakAfter) {
        seq.push({
          id: `std-short-${i}`,
          name: 'SHORT BREAK',
          type: 'break',
          duration: currentSettings.shortBreakDuration,
        });
      } else {
        seq.push({
          id: `std-long-${i}`,
          name: 'LONG BREAK',
          type: 'break',
          duration: currentSettings.longBreakDuration,
        });
      }
    }
    return seq;
  };

  const sequence = getSequence(settings);
  const currentStep = sequence[currentStepIndex] || sequence[0];

  // Calculate session count info for display (e.g. Session 3 / 4)
  const getSessionProgressInfo = () => {
    if (settings.modeType === 'custom') {
      const totalSteps = sequence.length;
      return {
        current: currentStepIndex + 1,
        total: totalSteps,
        text: `Session ${currentStepIndex + 1} / ${totalSteps}`,
        loopText: settings.repeatMode === 'count' ? `Loop ${currentLoopCount} / ${settings.targetLoops}` : ''
      };
    } else {
      // Standard mode
      const studySteps = sequence.filter(s => s.type === 'study');
      let currentStudyNum = 1;
      let totalStudyNum = studySteps.length;

      let count = 0;
      for (let i = 0; i <= currentStepIndex; i++) {
        if (sequence[i] && sequence[i].type === 'study') {
          count++;
        }
      }
      currentStudyNum = Math.max(1, count);

      return {
        current: currentStudyNum,
        total: totalStudyNum,
        text: currentStep.type === 'study'
          ? `Session ${currentStudyNum} / ${totalStudyNum}`
          : `Break after Session ${currentStudyNum}`,
        loopText: settings.repeatMode === 'count' ? `Loop ${currentLoopCount} / ${settings.targetLoops}` : ''
      };
    }
  };

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings', e);
    }
  }, [settings]);

  // Sync state broadcast whenever critical state changes
  const broadcastCurrentState = (overrideTimeLeft = timeLeft, overrideStatus = status) => {
    const sessionInfo = getSessionProgressInfo();
    const payload = {
      timeLeft: overrideTimeLeft,
      targetEndTime: overrideStatus === 'running' ? endTimeRef.current : null,
      status: overrideStatus,
      sessionName: currentStep ? currentStep.name : 'STUDY',
      sessionType: currentStep ? currentStep.type : 'study',
      sessionProgressText: sessionInfo.text,
      loopProgressText: sessionInfo.loopText,
      overlayFontSize: settings.overlayFontSize,
      overlayColor: settings.overlayColor,
      overlayLabelColor: settings.overlayLabelColor || '#fef08a',
      overlayLabelFontSize: settings.overlayLabelFontSize || 36,
      overlayShowLabel: settings.overlayShowLabel,
      overlayShowSessionCount: settings.overlayShowSessionCount !== false,
      overlayFontFamily: settings.overlayFontFamily,
      timestamp: Date.now()
    };
    syncChannel.postState(payload);
  };

  // Sync state when tab visibility changes or comes back to focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'running' && endTimeRef.current) {
        const now = Date.now();
        const remainingMs = Math.max(0, endTimeRef.current - now);
        const remainingSec = Math.ceil(remainingMs / 1000);
        setTimeLeft(remainingSec);
        if (remainingSec <= 0) {
          handleSessionComplete();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [status]);

  // Broadcast state updates
  useEffect(() => {
    broadcastCurrentState();
  }, [timeLeft, status, currentStepIndex, settings]);

  // Handle ambient audio switching based on status and session type
  useEffect(() => {
    audioEngine.setVolume(settings.volume);
    audioEngine.setMuted(settings.isMuted);

    if (status === 'running' && settings.isAmbientEnabled && !settings.isMuted) {
      const activeSound = currentStep.type === 'study' ? settings.studySound : settings.breakSound;
      audioEngine.startAmbient(activeSound);
    } else {
      audioEngine.stopAmbient();
    }
  }, [status, currentStep.type, settings.studySound, settings.breakSound, settings.volume, settings.isMuted, settings.isAmbientEnabled]);

  // Reset timer duration when session index or duration settings change in idle mode
  useEffect(() => {
    if (status === 'idle') {
      const step = sequence[currentStepIndex] || sequence[0];
      if (step) {
        setTimeLeft(step.duration * 60);
      }
    }
  }, [currentStepIndex, settings.modeType, settings.studyDuration, settings.shortBreakDuration, settings.longBreakDuration, settings.customSequence]);

  // Timer Tick Mechanism (Drift-free Date.now() delta)
  const startTimer = () => {
    audioEngine.initContext();
    if (status === 'running') return;

    setStatus('running');
    endTimeRef.current = Date.now() + timeLeft * 1000;

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, endTimeRef.current - now);
      const remainingSec = Math.ceil(remainingMs / 1000);

      setTimeLeft(remainingSec);
      broadcastCurrentState(remainingSec, 'running');

      if (remainingSec <= 0) {
        clearInterval(timerRef.current);
        handleSessionComplete();
      }
    }, 250);
  };

  const pauseTimer = () => {
    clearInterval(timerRef.current);
    setStatus('paused');
    broadcastCurrentState(timeLeft, 'paused');
  };

  const resumeTimer = () => {
    startTimer();
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setStatus('idle');
    const step = sequence[currentStepIndex] || sequence[0];
    const initialSeconds = step ? step.duration * 60 : 50 * 60;
    setTimeLeft(initialSeconds);
    broadcastCurrentState(initialSeconds, 'idle');
  };

  const skipSession = () => {
    clearInterval(timerRef.current);
    advanceToNextSession();
  };

  const advanceToNextSession = () => {
    const nextIndex = currentStepIndex + 1;

    if (nextIndex < sequence.length) {
      setCurrentStepIndex(nextIndex);
      const nextStep = sequence[nextIndex];
      const nextSeconds = nextStep.duration * 60;
      setTimeLeft(nextSeconds);

      if (status === 'running') {
        endTimeRef.current = Date.now() + nextSeconds * 1000;
        startTimer();
      } else {
        setStatus('idle');
      }
    } else {
      // Reached end of current sequence loop
      if (settings.repeatMode === 'continuous') {
        setCurrentStepIndex(0);
        setCurrentLoopCount(prev => prev + 1);
        const firstStep = sequence[0];
        const nextSeconds = firstStep.duration * 60;
        setTimeLeft(nextSeconds);
        if (status === 'running') {
          endTimeRef.current = Date.now() + nextSeconds * 1000;
          startTimer();
        }
      } else if (settings.repeatMode === 'count') {
        if (currentLoopCount < settings.targetLoops) {
          setCurrentStepIndex(0);
          setCurrentLoopCount(prev => prev + 1);
          const firstStep = sequence[0];
          const nextSeconds = firstStep.duration * 60;
          setTimeLeft(nextSeconds);
          if (status === 'running') {
            endTimeRef.current = Date.now() + nextSeconds * 1000;
            startTimer();
          }
        } else {
          // Finished all loops
          setStatus('idle');
          setCurrentStepIndex(0);
          setCurrentLoopCount(1);
          const firstStep = sequence[0];
          setTimeLeft(firstStep ? firstStep.duration * 60 : 50 * 60);
        }
      } else {
        // repeatMode === 'none'
        setStatus('idle');
        setCurrentStepIndex(0);
        const firstStep = sequence[0];
        setTimeLeft(firstStep ? firstStep.duration * 60 : 50 * 60);
      }
    }
  };

  const handleSessionComplete = () => {
    audioEngine.playSessionChime();
    advanceToNextSession();
  };

  const updateSettings = (newPartialSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newPartialSettings };
      return updated;
    });
  };

  const value = {
    settings,
    updateSettings,
    sequence,
    currentStep,
    currentStepIndex,
    currentLoopCount,
    status,
    timeLeft,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    skipSession,
    sessionProgressInfo: getSessionProgressInfo(),
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
