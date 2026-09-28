import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { syncChannel } from '../utils/syncChannel';
import {
  buildSequence,
  getNextPosition,
  getProgressInfo,
  resolvePosition,
  secondsUntil,
  sessionSeconds,
} from '../utils/timeline';

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

// The chime marks a session end the tab noticed on time. When the browser kept
// this tab asleep past it, the timer catches up silently instead of chiming late.
const CHIME_GRACE_MS = 60 * 1000;

// Held while a session runs: Chrome and Edge don't freeze a background tab that
// holds a Web Lock, so the chime and the next session happen on time even when
// the browser is minimized for hours
const RUNNING_LOCK = 'ubst_pomo_running';

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

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to parse saved settings', e);
  }
  return DEFAULT_SETTINGS;
};

const idleAt = (seq, index, loop) => ({
  status: 'idle',
  timeLeft: sessionSeconds(seq[index] || seq[0]),
  targetEndTime: null,
  currentStepIndex: index,
  currentLoopCount: loop,
});

const runningAt = (index, loop, endTime, now) => ({
  status: 'running',
  timeLeft: secondsUntil(endTime, now),
  targetEndTime: endTime,
  currentStepIndex: index,
  currentLoopCount: loop,
});

// The run state to show for a saved one right now. A session that was running
// while the tab was closed, discarded or asleep is followed forward on the wall
// clock (not reset), just like the overlay does.
const resolveRunState = (saved, settings) => {
  const seq = buildSequence(settings);
  const savedIndex = saved?.currentStepIndex;
  const index = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < seq.length ? savedIndex : 0;
  const loop = Number.isInteger(saved?.currentLoopCount) && saved.currentLoopCount > 0 ? saved.currentLoopCount : 1;

  if (saved?.status === 'running' && saved.targetEndTime > 0) {
    const now = Date.now();
    const position = resolvePosition(seq, settings, index, loop, saved.targetEndTime, now);
    return position.finished
      ? idleAt(seq, 0, 1)
      : runningAt(position.index, position.loop, position.endTime, now);
  }

  if (saved?.status === 'paused' && saved.timeLeft > 0) {
    return {
      status: 'paused',
      timeLeft: saved.timeLeft,
      targetEndTime: null,
      currentStepIndex: index,
      currentLoopCount: loop,
    };
  }

  return idleAt(seq, index, loop);
};

// Read synchronously so the very first render already reflects a running or
// paused session
const loadRunState = (settings) => {
  try {
    return resolveRunState(JSON.parse(localStorage.getItem(RUN_STATE_KEY)), settings);
  } catch (e) {
    console.warn('Failed to restore run state:', e);
    return resolveRunState(null, settings);
  }
};

// Only what changes on a start, pause, skip or session change (timeLeft follows
// from targetEndTime while running), so other tabs hear about real changes only
const serializeRunState = ({ status, timeLeft, targetEndTime, currentStepIndex, currentLoopCount }) =>
  JSON.stringify({
    status,
    currentStepIndex,
    currentLoopCount,
    targetEndTime: status === 'running' ? targetEndTime : null,
    timeLeft: status === 'paused' ? timeLeft : null,
  });

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  const [initialRunState] = useState(() => loadRunState(settings));

  const [currentStepIndex, setCurrentStepIndex] = useState(initialRunState.currentStepIndex);
  const [currentLoopCount, setCurrentLoopCount] = useState(initialRunState.currentLoopCount);
  const [status, setStatus] = useState(initialRunState.status);
  const [timeLeft, setTimeLeft] = useState(initialRunState.timeLeft);
  // End of the running session; state so the overlay hears when it moves
  const [targetEndTime, setTargetEndTime] = useState(initialRunState.targetEndTime);

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
  const savedRunStateRef = useRef(null);

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

  // Memoized so the callbacks below keep a stable identity between ticks
  const sequence = useMemo(() => buildSequence(settings), [settings]);
  const currentStep = sequence[currentStepIndex] || sequence[0];

  const sessionProgressInfo = useMemo(
    () => getProgressInfo(sequence, settings, currentStepIndex, currentLoopCount),
    [sequence, settings, currentStepIndex, currentLoopCount]
  );

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
    const serialized = serializeRunState({ status, timeLeft, targetEndTime, currentStepIndex, currentLoopCount });
    if (serialized === savedRunStateRef.current) return;
    savedRunStateRef.current = serialized;

    try {
      localStorage.setItem(RUN_STATE_KEY, serialized);
    } catch (e) {
      console.warn('Failed to save run state:', e);
    }
  }, [status, timeLeft, targetEndTime, currentStepIndex, currentLoopCount]);

  // Broadcast to the overlay whenever something it shows changes. While running
  // the overlay follows the plan by itself (next sessions included), so the
  // per-second timeLeft updates are not sent
  const broadcastTimeLeft = status === 'running' ? null : timeLeft;

  useEffect(() => {
    const isRunning = status === 'running' && !!targetEndTime;

    syncChannel.postState({
      status,
      timeLeft: broadcastTimeLeft,
      targetEndTime: isRunning ? targetEndTime : null,
      currentStepIndex,
      currentLoopCount,
      plan: {
        modeType: settings.modeType,
        repeatMode: settings.repeatMode,
        targetLoops: settings.targetLoops,
        sequence: sequence.map(({ name, type, duration }) => ({ name, type, duration })),
      },
      sessionName: currentStep?.name || 'STUDY',
      sessionType: currentStep?.type || 'study',
      sessionProgressText: sessionProgressInfo.text,
      loopProgressText: sessionProgressInfo.loopText,
      overlayFontSize: settings.overlayFontSize,
      overlayColor: settings.overlayColor,
      overlayLabelColor: settings.overlayLabelColor || '#fef08a',
      overlayLabelFontSize: settings.overlayLabelFontSize || 36,
      overlayShowLabel: settings.overlayShowLabel,
      overlayShowSessionCount: settings.overlayShowSessionCount !== false,
      overlayFontFamily: settings.overlayFontFamily,
    });
  }, [status, broadcastTimeLeft, targetEndTime, currentStep, currentStepIndex, currentLoopCount, sequence, sessionProgressInfo, settings]);

  // Keep audio engine volume and mute in sync
  useEffect(() => {
    audioEngine.setVolume(settings.volume);
    audioEngine.setMuted(settings.isMuted);
  }, [settings.volume, settings.isMuted]);

  // Update timeLeft when idle and step changes
  useEffect(() => {
    if (status === 'idle') {
      const step = sequence[currentStepIndex] || sequence[0];
      if (step) {
        const newSeconds = sessionSeconds(step);
        setTimeLeft(newSeconds);
        timeLeftRef.current = newSeconds;
      }
    }
  }, [currentStepIndex, status, sequence]);

  // Keep the tab from being frozen while a session runs
  useEffect(() => {
    if (status !== 'running' || !navigator.locks?.request) return undefined;

    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    navigator.locks.request(RUNNING_LOCK, { mode: 'shared' }, () => held).catch(() => {});

    return () => release();
  }, [status]);

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

  // Single place where the run state changes: start, pause, reset, skip, a
  // session running out, or another tab of the timer changing it
  const commitRunState = useCallback((next) => {
    setStatus(next.status);
    statusRef.current = next.status;
    setCurrentStepIndex(next.currentStepIndex);
    currentStepIndexRef.current = next.currentStepIndex;
    setCurrentLoopCount(next.currentLoopCount);
    currentLoopCountRef.current = next.currentLoopCount;
    setTimeLeft(next.timeLeft);
    timeLeftRef.current = next.timeLeft;
    setTargetEndTime(next.targetEndTime);
    endTimeRef.current = next.targetEndTime;

    if (next.status === 'running') {
      startTicker();
    } else {
      stopTicker();
    }
  }, [startTicker, stopTicker]);

  // A session ran out: move on along the wall-clock schedule, where each session
  // starts exactly when the previous one ended. If the browser froze or
  // throttled this tab past that moment, the timer catches up instead of
  // starting late.
  const completeElapsedSessions = useCallback((now) => {
    const currentSettings = settingsRef.current;
    const seq = buildSequence(currentSettings);
    const position = resolvePosition(
      seq,
      currentSettings,
      currentStepIndexRef.current,
      currentLoopCountRef.current,
      endTimeRef.current,
      now
    );

    // When the most recent session change happened
    const changedAt = position.finished
      ? position.endTime
      : position.endTime - sessionSeconds(seq[position.index]) * 1000;
    if (now - changedAt <= CHIME_GRACE_MS) {
      const nextSession = seq[position.index] || seq[0];
      audioEngine.playSessionChime(nextSession?.type || 'study');
    }

    commitRunState(position.finished
      ? idleAt(seq, 0, 1)
      : runningAt(position.index, position.loop, position.endTime, now));
  }, [commitRunState]);

  // Single tick handler shared by the worker, the setInterval fallback and the
  // wake-up handlers. State is broadcast by the effect that watches it.
  const tick = useCallback(() => {
    if (statusRef.current !== 'running' || !endTimeRef.current) return;

    const now = Date.now();
    if (endTimeRef.current <= now) {
      completeElapsedSessions(now);
      return;
    }

    const remainingSec = secondsUntil(endTimeRef.current, now);
    setTimeLeft(remainingSec);
    timeLeftRef.current = remainingSec;
  }, [completeElapsedSessions]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startTimer = useCallback(() => {
    audioEngine.initContext();

    if (statusRef.current === 'running') return;

    const now = Date.now();
    commitRunState(runningAt(
      currentStepIndexRef.current,
      currentLoopCountRef.current,
      now + timeLeftRef.current * 1000,
      now
    ));
  }, [commitRunState]);

  const pauseTimer = useCallback(() => {
    if (statusRef.current !== 'running') return;

    // First catch up on a session that ended while this tab was asleep
    tickRef.current?.();
    if (statusRef.current !== 'running') return;

    commitRunState({
      status: 'paused',
      timeLeft: secondsUntil(endTimeRef.current, Date.now()),
      targetEndTime: null,
      currentStepIndex: currentStepIndexRef.current,
      currentLoopCount: currentLoopCountRef.current,
    });
  }, [commitRunState]);

  const resumeTimer = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const resetTimer = useCallback(() => {
    const seq = buildSequence(settingsRef.current);
    const index = currentStepIndexRef.current < seq.length ? currentStepIndexRef.current : 0;
    commitRunState(idleAt(seq, index, currentLoopCountRef.current));
  }, [commitRunState]);

  // Skip: the next session starts right now
  const skipSession = useCallback(() => {
    const currentSettings = settingsRef.current;
    const seq = buildSequence(currentSettings);
    const next = getNextPosition(seq, currentStepIndexRef.current, currentLoopCountRef.current, currentSettings);

    if (!next) {
      commitRunState(idleAt(seq, 0, 1));
    } else if (statusRef.current === 'running') {
      const now = Date.now();
      commitRunState(runningAt(next.index, next.loop, now + sessionSeconds(seq[next.index]) * 1000, now));
    } else {
      commitRunState(idleAt(seq, next.index, next.loop));
    }
  }, [commitRunState]);

  // Create the Web Worker once for the lifetime of the provider. It must not be
  // recreated on re-render, otherwise the freshly started ticker is terminated.
  useEffect(() => {
    const worker = createTimerWorker();
    if (worker) {
      worker.onmessage = () => tickRef.current?.();
      workerRef.current = worker;
    }

    // Resume a session that was still running when the page was (re)loaded
    if (statusRef.current === 'running' && endTimeRef.current) {
      startTicker();
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

  // When the tab comes back (shown, unfrozen, restored or back online), catch up
  // right away and refresh what the overlay relay has
  useEffect(() => {
    const catchUp = () => tickRef.current?.();
    const wakeUp = () => {
      catchUp();
      syncChannel.publish();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') wakeUp();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('resume', wakeUp);
    window.addEventListener('pageshow', wakeUp);
    window.addEventListener('online', wakeUp);
    window.addEventListener('focus', catchUp);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('resume', wakeUp);
      window.removeEventListener('pageshow', wakeUp);
      window.removeEventListener('online', wakeUp);
      window.removeEventListener('focus', catchUp);
    };
  }, []);

  // Another tab of the timer changed the settings or the run: follow it, so two
  // open tabs never send the overlay conflicting states
  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.newValue) return;

      try {
        if (event.key === STORAGE_KEY) {
          const nextSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(event.newValue) };
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
        } else if (event.key === RUN_STATE_KEY) {
          const next = resolveRunState(JSON.parse(event.newValue), settingsRef.current);
          const current = {
            status: statusRef.current,
            timeLeft: timeLeftRef.current,
            targetEndTime: endTimeRef.current,
            currentStepIndex: currentStepIndexRef.current,
            currentLoopCount: currentLoopCountRef.current,
          };
          if (serializeRunState(next) !== serializeRunState(current)) {
            commitRunState(next);
          }
        }
      } catch (err) {
        console.warn('Ignoring unreadable state from another tab:', err);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [commitRunState]);

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
    sessionProgressInfo,
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
