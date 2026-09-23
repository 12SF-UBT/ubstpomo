import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { syncChannel } from '../utils/syncChannel';

// Professional Unthrottled Web Worker Ticker Engine
const createTimerWorker = () => {
  if (typeof window === 'undefined' || !window.Worker) return null;
  try {
    const code = `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data.command === 'start') {
          if (intervalId) clearInterval(intervalId);
          const interval = e.data.interval || 250;
          intervalId = setInterval(function() {
            self.postMessage({ type: 'tick', timestamp: Date.now() });
          }, interval);
        } else if (e.data.command === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    return new Worker(workerUrl);
  } catch (err) {
    console.warn('Web Worker not available, using setInterval fallback:', err);
    return null;
  }
};

const STORAGE_KEY = 'ubst_pomo_settings_v1';
const RUN_STATE_KEY = 'ubst_pomo_run_state_v1';

const DEFAULT_SETTINGS = {
  modeType: 'standard',
  studyDuration: 50,
  shortBreakDuration: 10,
  longBreakDuration: 30,
  longBreakAfter: 4,

  customSequence: [
    { id: '1', name: 'Focus Phase 1', type: 'study', duration: 50 },
    { id: '2', name: 'Quick Rest', type: 'break', duration: 10 },
    { id: '3', name: 'Deep Work Phase', type: 'study', duration: 90 },
    { id: '4', name: 'Mid Rest', type: 'break', duration: 15 },
    { id: '5', name: 'Focus Phase 2', type: 'study', duration: 45 },
    { id: '6', name: 'Long Rest', type: 'break', duration: 30 },
    { id: '7', name: 'Final Sprint', type: 'study', duration: 60 },
  ],

  repeatMode: 'continuous',
  targetLoops: 1,

  studySound: 'rain',
  breakSound: 'waves',
  volume: 0.6,
  isMuted: false,
  isAmbientEnabled: true,

  overlayFontSize: 140,
  overlayColor: '#ffffff',
  overlayLabelColor: '#fef08a',
  overlayLabelFontSize: 36,
  overlayShowLabel: true,
  overlayShowSessionCount: true,
  overlayFontFamily: 'mono',
};

// Read the persisted run state synchronously so the very first render already
// reflects a running/paused session (restoring in an effect lets the idle-reset
// effect clobber the restored timeLeft in the same commit)
const loadRunState = (settings) => {
  const idleState = {
    status: 'idle',
    timeLeft: (settings?.studyDuration || 50) * 60,
    targetEndTime: null,
    currentStepIndex: 0,
    currentLoopCount: 1,
  };

  try {
    const saved = localStorage.getItem(RUN_STATE_KEY);
    if (!saved) return idleState;
    const parsed = JSON.parse(saved);

    if (parsed.status === 'running' && parsed.targetEndTime) {
      const remainingMs = Math.max(0, parsed.targetEndTime - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (remainingSec > 0) {
        return {
          status: 'running',
          timeLeft: remainingSec,
          targetEndTime: parsed.targetEndTime,
          currentStepIndex: parsed.currentStepIndex || 0,
          currentLoopCount: parsed.currentLoopCount || 1,
        };
      }
    } else if (parsed.status === 'paused') {
      return {
        status: 'paused',
        timeLeft: parsed.timeLeft || 50 * 60,
        targetEndTime: null,
        currentStepIndex: parsed.currentStepIndex || 0,
        currentLoopCount: parsed.currentLoopCount || 1,
      };
    }
  } catch (e) {
    console.warn('Failed to restore run state:', e);
  }

  return idleState;
};

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
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

  const [initialRunState] = useState(() => loadRunState(settings));

  const [currentStepIndex, setCurrentStepIndex] = useState(initialRunState.currentStepIndex);
  const [currentLoopCount, setCurrentLoopCount] = useState(initialRunState.currentLoopCount);
  const [status, setStatus] = useState(initialRunState.status);
  const [timeLeft, setTimeLeft] = useState(initialRunState.timeLeft);

  // Use refs to track timing state without triggering re-renders
  const endTimeRef = useRef(initialRunState.targetEndTime);
  const timerRef = useRef(null);
  const workerRef = useRef(null);
  const tickRef = useRef(null);
  const currentStepIndexRef = useRef(initialRunState.currentStepIndex);
  const currentLoopCountRef = useRef(initialRunState.currentLoopCount);
  const statusRef = useRef(initialRunState.status);
  const settingsRef = useRef(settings);
  const timeLeftRef = useRef(initialRunState.timeLeft);

  // Keep refs in sync with state
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    currentLoopCountRef.current = currentLoopCount;
  }, [currentLoopCount]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const getSequence = useCallback((currentSettings = settings) => {
    if (currentSettings.modeType === 'custom') {
      return currentSettings.customSequence?.length > 0
        ? currentSettings.customSequence
        : [{ id: 'def', name: 'Study', type: 'study', duration: currentSettings.studyDuration }];
    }

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
  }, []);

  // Memoized so the callbacks below keep a stable identity between ticks
  const sequence = useMemo(() => getSequence(settings), [getSequence, settings]);
  const currentStep = sequence[currentStepIndex] || sequence[0];

  const getSessionProgressInfo = useCallback(() => {
    if (settings.modeType === 'custom') {
      const totalSteps = sequence.length;
      return {
        current: currentStepIndex + 1,
        total: totalSteps,
        text: `Session ${currentStepIndex + 1} / ${totalSteps}`,
        loopText: settings.repeatMode === 'count' ? `Loop ${currentLoopCount} / ${settings.targetLoops}` : ''
      };
    } else {
      const studySteps = sequence.filter(s => s.type === 'study');
      let count = 0;
      for (let i = 0; i <= currentStepIndex; i++) {
        if (sequence[i] && sequence[i].type === 'study') {
          count++;
        }
      }
      const currentStudyNum = Math.max(1, count);
      const totalStudyNum = studySteps.length;

      return {
        current: currentStudyNum,
        total: totalStudyNum,
        text: currentStep.type === 'study'
          ? `Session ${currentStudyNum} / ${totalStudyNum}`
          : `Break after Session ${currentStudyNum}`,
        loopText: settings.repeatMode === 'count' ? `Loop ${currentLoopCount} / ${settings.targetLoops}` : ''
      };
    }
  }, [settings.modeType, settings.repeatMode, settings.targetLoops, currentStepIndex, currentLoopCount, sequence, currentStep]);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }, [settings]);

  // Persist runtime state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RUN_STATE_KEY, JSON.stringify({
        status,
        timeLeft,
        targetEndTime: status === 'running' ? endTimeRef.current : null,
        currentStepIndex,
        currentLoopCount,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Failed to save run state:', e);
    }
  }, [status, timeLeft, currentStepIndex, currentLoopCount]);

  const broadcastCurrentState = useCallback((overrideTimeLeft = timeLeft, overrideStatus = status) => {
    const sessionInfo = getSessionProgressInfo();
    const payload = {
      timeLeft: overrideTimeLeft,
      targetEndTime: overrideStatus === 'running' ? endTimeRef.current : null,
      status: overrideStatus,
      sessionName: currentStep?.name || 'STUDY',
      sessionType: currentStep?.type || 'study',
      sessionProgressText: sessionInfo.text,
      loopProgressText: sessionInfo.loopText,
      overlayFontSize: settingsRef.current.overlayFontSize,
      overlayColor: settingsRef.current.overlayColor,
      overlayLabelColor: settingsRef.current.overlayLabelColor || '#fef08a',
      overlayLabelFontSize: settingsRef.current.overlayLabelFontSize || 36,
      overlayShowLabel: settingsRef.current.overlayShowLabel,
      overlayShowSessionCount: settingsRef.current.overlayShowSessionCount !== false,
      overlayFontFamily: settingsRef.current.overlayFontFamily,
      timestamp: Date.now()
    };
    syncChannel.postState(payload);
  }, [currentStep, getSessionProgressInfo, timeLeft, status]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tickRef.current?.();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Broadcast state changes
  useEffect(() => {
    broadcastCurrentState();
  }, [timeLeft, status, currentStepIndex, settings, broadcastCurrentState]);

  // Handle ambient audio
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

  // Update timeLeft when idle and step changes
  useEffect(() => {
    if (status === 'idle') {
      const step = sequence[currentStepIndex] || sequence[0];
      if (step) {
        const newSeconds = step.duration * 60;
        setTimeLeft(newSeconds);
      }
    }
  }, [currentStepIndex, settings.modeType, settings.studyDuration, settings.shortBreakDuration, settings.longBreakDuration, settings.customSequence, status, sequence]);

  const stopTicker = useCallback(() => {
    if (workerRef.current) {
      try {
        workerRef.current.postMessage({ command: 'stop' });
      } catch (err) {}
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Ticks always go through tickRef so the long-lived worker/interval never
  // runs a stale closure (and never has to be recreated when state changes)
  const startTicker = useCallback(() => {
    stopTicker();

    if (workerRef.current) {
      try {
        workerRef.current.postMessage({ command: 'start', interval: 250 });
        return;
      } catch (err) {
        console.warn('Worker start failed, using fallback:', err);
      }
    }

    timerRef.current = setInterval(() => tickRef.current?.(), 250);
  }, [stopTicker]);

  const startTimer = useCallback((forceStart = false) => {
    audioEngine.initContext();

    if (statusRef.current === 'running' && !forceStart) return;

    setStatus('running');
    statusRef.current = 'running';

    if (!endTimeRef.current || !forceStart) {
      endTimeRef.current = Date.now() + timeLeftRef.current * 1000;
    }

    startTicker();
  }, [startTicker]);

  const pauseTimer = useCallback(() => {
    stopTicker();
    setStatus('paused');
    statusRef.current = 'paused';
    broadcastCurrentState(timeLeftRef.current, 'paused');
  }, [stopTicker, broadcastCurrentState]);

  const resumeTimer = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const resetTimer = useCallback(() => {
    stopTicker();
    setStatus('idle');
    statusRef.current = 'idle';
    const step = sequence[currentStepIndexRef.current] || sequence[0];
    const initialSeconds = step ? step.duration * 60 : 50 * 60;
    setTimeLeft(initialSeconds);
    broadcastCurrentState(initialSeconds, 'idle');
  }, [stopTicker, sequence, broadcastCurrentState]);

  const skipSession = useCallback(() => {
    stopTicker();
    advanceToNextSession();
  }, [stopTicker]);

  const advanceToNextSession = useCallback(() => {
    const nextIndex = currentStepIndexRef.current + 1;
    const seq = getSequence(settingsRef.current);

    if (nextIndex < seq.length) {
      setCurrentStepIndex(nextIndex);
      currentStepIndexRef.current = nextIndex;
      const nextStep = seq[nextIndex];
      const nextSeconds = nextStep.duration * 60;
      setTimeLeft(nextSeconds);
      timeLeftRef.current = nextSeconds;

      if (statusRef.current === 'running') {
        endTimeRef.current = Date.now() + nextSeconds * 1000;
        startTimer(true);
      } else {
        setStatus('idle');
        statusRef.current = 'idle';
      }
    } else {
      if (settingsRef.current.repeatMode === 'continuous') {
        setCurrentStepIndex(0);
        currentStepIndexRef.current = 0;
        setCurrentLoopCount(prev => prev + 1);
        currentLoopCountRef.current = currentLoopCountRef.current + 1;
        
        const firstStep = seq[0];
        const nextSeconds = firstStep.duration * 60;
        setTimeLeft(nextSeconds);
        timeLeftRef.current = nextSeconds;
        
        if (statusRef.current === 'running') {
          endTimeRef.current = Date.now() + nextSeconds * 1000;
          startTimer(true);
        }
      } else if (settingsRef.current.repeatMode === 'count') {
        if (currentLoopCountRef.current < settingsRef.current.targetLoops) {
          setCurrentStepIndex(0);
          currentStepIndexRef.current = 0;
          setCurrentLoopCount(prev => prev + 1);
          currentLoopCountRef.current = currentLoopCountRef.current + 1;
          
          const firstStep = seq[0];
          const nextSeconds = firstStep.duration * 60;
          setTimeLeft(nextSeconds);
          timeLeftRef.current = nextSeconds;
          
          if (statusRef.current === 'running') {
            endTimeRef.current = Date.now() + nextSeconds * 1000;
            startTimer(true);
          }
        } else {
          setStatus('idle');
          statusRef.current = 'idle';
          setCurrentStepIndex(0);
          currentStepIndexRef.current = 0;
          setCurrentLoopCount(1);
          currentLoopCountRef.current = 1;
          
          const firstStep = seq[0];
          const finalSeconds = firstStep ? firstStep.duration * 60 : 50 * 60;
          setTimeLeft(finalSeconds);
          timeLeftRef.current = finalSeconds;
        }
      } else {
        setStatus('idle');
        statusRef.current = 'idle';
        setCurrentStepIndex(0);
        currentStepIndexRef.current = 0;
        
        const firstStep = seq[0];
        const finalSeconds = firstStep ? firstStep.duration * 60 : 50 * 60;
        setTimeLeft(finalSeconds);
        timeLeftRef.current = finalSeconds;
      }
    }
  }, [getSequence, startTimer]);

  const handleSessionComplete = useCallback(() => {
    audioEngine.playSessionChime();
    advanceToNextSession();
  }, [advanceToNextSession]);

  // Single tick handler shared by the worker, the setInterval fallback and the
  // visibility handler. State is broadcast by the effect that watches timeLeft.
  const tick = useCallback(() => {
    if (statusRef.current !== 'running' || !endTimeRef.current) return;

    const remainingMs = Math.max(0, endTimeRef.current - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);

    setTimeLeft(remainingSec);

    if (remainingSec <= 0) {
      stopTicker();
      handleSessionComplete();
    }
  }, [stopTicker, handleSessionComplete]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // Create the Web Worker once for the lifetime of the provider. It must not be
  // recreated on re-render, otherwise the freshly started ticker is terminated.
  useEffect(() => {
    const worker = createTimerWorker();
    if (worker) {
      worker.onmessage = () => tickRef.current?.();
      workerRef.current = worker;
    }

    // Resume a session that was still running when the page was refreshed
    if (statusRef.current === 'running' && endTimeRef.current) {
      startTimer(true);
    }

    return () => {
      stopTicker();
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch (err) {}
        workerRef.current = null;
      }
    };
  }, []);

  const updateSettings = useCallback((newPartialSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newPartialSettings };
      settingsRef.current = updated;
      return updated;
    });
  }, []);

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
