import React, { useState, useEffect } from 'react';
import { syncChannel, getRoomFromUrl, getStoredRoom } from '../utils/syncChannel';
import { getProgressInfo, resolvePosition, secondsUntil, sessionSeconds } from '../utils/timeline';

const STORAGE_KEY = 'ubst_pomo_settings_v1';

// How long an overlay without a room waits for a timer before saying so
const LINK_HINT_DELAY_MS = 5000;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

// What to show at `now`. While running, the session and its time left come
// from the run plan, so the overlay moves on to the next session by itself even
// when the timer tab is minimized, asleep or closed, and a late relay message
// can never make the digits jump backwards.
function getLiveView(state, now) {
  const fromState = {
    seconds: state.timeLeft,
    sessionName: state.sessionName,
    sessionProgressText: state.sessionProgressText,
  };
  if (state.status !== 'running' || !state.targetEndTime) return fromState;

  const plan = state.plan;
  const seq = plan?.sequence;
  if (!Array.isArray(seq) || seq.length === 0) {
    return { ...fromState, seconds: secondsUntil(state.targetEndTime, now) };
  }

  const position = resolvePosition(
    seq,
    plan,
    state.currentStepIndex ?? 0,
    state.currentLoopCount ?? 1,
    state.targetEndTime,
    now
  );

  // The whole run is over: the timer goes back to an idle first session
  if (position.finished) {
    return {
      seconds: sessionSeconds(seq[0]),
      sessionName: seq[0].name,
      sessionProgressText: getProgressInfo(seq, plan, 0, 1).text,
    };
  }

  return {
    seconds: secondsUntil(position.endTime, now),
    sessionName: (seq[position.index] || seq[0]).name,
    sessionProgressText: getProgressInfo(seq, plan, position.index, position.loop).text,
  };
}

export function OverlayView() {
  const [overlayState, setOverlayState] = useState(() => {
    let defaults = {
      timeLeft: 50 * 60,
      targetEndTime: null,
      currentStepIndex: 0,
      currentLoopCount: 1,
      plan: null,
      status: 'idle',
      sessionName: 'STUDY',
      sessionType: 'study',
      sessionProgressText: 'Session 1 / 4',
      overlayFontSize: 140,
      overlayColor: '#ffffff',
      overlayLabelColor: '#fef08a',
      overlayLabelFontSize: 36,
      overlayShowLabel: true,
      overlayShowSessionCount: true,
      overlayFontFamily: 'mono'
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        defaults = {
          ...defaults,
          overlayFontSize: parsed.overlayFontSize || defaults.overlayFontSize,
          overlayColor: parsed.overlayColor || defaults.overlayColor,
          overlayLabelColor: parsed.overlayLabelColor || defaults.overlayLabelColor,
          overlayLabelFontSize: parsed.overlayLabelFontSize || defaults.overlayLabelFontSize,
          overlayShowLabel: parsed.overlayShowLabel !== false,
          overlayShowSessionCount: parsed.overlayShowSessionCount !== false,
          overlayFontFamily: parsed.overlayFontFamily || defaults.overlayFontFamily,
          timeLeft: (parsed.studyDuration || 50) * 60,
        };
      }
    } catch (e) {
      console.debug('Failed to load overlay settings from storage:', e);
    }

    return defaults;
  });

  // The URL's room, or this browser's own timer when the overlay was opened
  // here without one
  const [room] = useState(() => getRoomFromUrl() || getStoredRoom());
  const [hasTimer, setHasTimer] = useState(false);
  const [waitedForTimer, setWaitedForTimer] = useState(false);

  // Set transparent background on mount
  useEffect(() => {
    const styleOverlay = () => {
      document.documentElement.style.background = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      document.body.style.background = 'transparent';
      document.body.style.backgroundColor = 'transparent';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
    };

    styleOverlay();

    document.documentElement.classList.add('overlay-body');
    document.body.classList.add('overlay-body');

    return () => {
      document.documentElement.classList.remove('overlay-body');
      document.body.classList.remove('overlay-body');
    };
  }, []);

  const isLive = overlayState.status === 'running' && !!overlayState.targetEndTime;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    const timeout = setTimeout(() => setWaitedForTimer(true), LINK_HINT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  // Listen for real-time state broadcasts from main timer window
  useEffect(() => {
    const unsubscribe = syncChannel.subscribe((data) => {
      if (!data || typeof data !== 'object') {
        return;
      }

      setHasTimer(true);
      setOverlayState((prev) => {
        const nextState = {
          timeLeft: typeof data.timeLeft === 'number' ? data.timeLeft : prev.timeLeft,
          targetEndTime: data.targetEndTime !== undefined ? data.targetEndTime : prev.targetEndTime,
          currentStepIndex: typeof data.currentStepIndex === 'number' ? data.currentStepIndex : prev.currentStepIndex,
          currentLoopCount: typeof data.currentLoopCount === 'number' ? data.currentLoopCount : prev.currentLoopCount,
          plan: data.plan !== undefined ? data.plan : prev.plan,
          status: data.status || prev.status,
          sessionName: data.sessionName || prev.sessionName || 'STUDY',
          sessionType: data.sessionType || prev.sessionType || 'study',
          sessionProgressText: data.sessionProgressText || prev.sessionProgressText || 'Session 1/4',
          overlayFontSize: typeof data.overlayFontSize === 'number' ? data.overlayFontSize : prev.overlayFontSize,
          overlayColor: data.overlayColor || prev.overlayColor,
          overlayLabelColor: data.overlayLabelColor || prev.overlayLabelColor,
          overlayLabelFontSize: typeof data.overlayLabelFontSize === 'number' ? data.overlayLabelFontSize : prev.overlayLabelFontSize,
          overlayShowLabel: typeof data.overlayShowLabel === 'boolean' ? data.overlayShowLabel : prev.overlayShowLabel,
          overlayShowSessionCount: typeof data.overlayShowSessionCount === 'boolean' ? data.overlayShowSessionCount : prev.overlayShowSessionCount,
          overlayFontFamily: data.overlayFontFamily || prev.overlayFontFamily,
        };

        // Only update if something changed
        if (JSON.stringify(nextState) === JSON.stringify(prev)) {
          return prev;
        }

        return nextState;
      });
    }, room);

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [room]);

  const { seconds, sessionName, sessionProgressText } = getLiveView(overlayState, Date.now());
  const formattedTime = formatTime(seconds);

  const cleanSessionCount = (sessionProgressText || '')
    .replace(' / ', '/')
    .replace('Break after ', 'Break ');

  // An old overlay link (no room) in OBS / Camo can't reach the timer
  const showLinkHint = !room && !hasTimer && waitedForTimer;

  return (
    <div
      className="w-screen h-screen flex flex-col items-center justify-center select-none overflow-hidden bg-transparent p-4"
      style={{
        backgroundColor: 'transparent',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {/* Large Timer Digits */}
      <div
        className={`font-bold tracking-tight leading-none transition-all duration-150 ${
          overlayState.overlayFontFamily === 'mono' ? 'font-mono' : 'font-sans'
        }`}
        style={{
          fontSize: `${overlayState.overlayFontSize}px`,
          color: overlayState.overlayColor,
          textShadow: [
            '0 4px 16px rgba(0,0,0,0.95)',
            '0 2px 4px rgba(0,0,0,0.8)',
            '0 0 20px rgba(0,0,0,0.5)'
          ].join(','),
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {formattedTime}
      </div>

      {/* Session Label & Progress Counter */}
      {(overlayState.overlayShowLabel || overlayState.overlayShowSessionCount) && (
        <div
          className="font-medium tracking-normal mt-2 transition-all duration-150 text-center flex items-center justify-center gap-2 flex-wrap"
          style={{
            fontSize: `${overlayState.overlayLabelFontSize}px`,
            color: overlayState.overlayLabelColor || '#fef08a',
            textShadow: [
              '0 3px 10px rgba(0,0,0,0.95)',
              '0 1px 3px rgba(0,0,0,0.9)',
              '0 0 12px rgba(0,0,0,0.7)'
            ].join(','),
            fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
          }}
        >
          {overlayState.overlayShowLabel && (
            <span>{sessionName || 'STUDY'}</span>
          )}

          {overlayState.overlayShowLabel && overlayState.overlayShowSessionCount && (
            <span className="opacity-70">•</span>
          )}

          {overlayState.overlayShowSessionCount && (
            <span>{cleanSessionCount || 'Session 1/4'}</span>
          )}
        </div>
      )}

      {showLinkHint && (
        <div
          className="mt-4 text-center text-sm font-semibold text-white"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}
        >
          Not linked to a timer. Copy the overlay URL from the timer page again.
        </div>
      )}
    </div>
  );
}
