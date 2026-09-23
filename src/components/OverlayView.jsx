import React, { useState, useEffect, useCallback } from 'react';
import { syncChannel } from '../utils/syncChannel';

const STORAGE_KEY = 'ubst_pomo_settings_v1';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

export function OverlayView() {
  const [overlayState, setOverlayState] = useState(() => {
    let defaults = {
      timeLeft: 50 * 60,
      targetEndTime: null,
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

  // Continuous system-clock countdown ticker (every 250ms)
  // Ticks even if main window is minimized because it's based on targetEndTime
  useEffect(() => {
    if (overlayState.status !== 'running' || !overlayState.targetEndTime) {
      return;
    }

    const updateDisplayTime = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, overlayState.targetEndTime - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      
      setOverlayState((prev) => {
        if (prev.timeLeft === remainingSec) {
          return prev;
        }
        return { ...prev, timeLeft: remainingSec };
      });
    };

    // Initial update
    updateDisplayTime();

    // Set up tick interval
    const interval = setInterval(updateDisplayTime, 250);

    return () => clearInterval(interval);
  }, [overlayState.status, overlayState.targetEndTime]);

  // Listen for real-time state broadcasts from main timer window
  useEffect(() => {
    const unsubscribe = syncChannel.subscribe((data) => {
      if (!data || typeof data !== 'object') {
        return;
      }

      setOverlayState((prev) => {
        const nextState = {
          timeLeft: typeof data.timeLeft === 'number' ? data.timeLeft : prev.timeLeft,
          targetEndTime: data.targetEndTime !== undefined ? data.targetEndTime : prev.targetEndTime,
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
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const formattedTime = formatTime(overlayState.timeLeft);

  const cleanSessionCount = (overlayState.sessionProgressText || '')
    .replace(' / ', '/')
    .replace('Break after ', 'Break ');

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
            <span>{overlayState.sessionName || 'STUDY'}</span>
          )}

          {overlayState.overlayShowLabel && overlayState.overlayShowSessionCount && (
            <span className="opacity-70">•</span>
          )}

          {overlayState.overlayShowSessionCount && (
            <span>{cleanSessionCount || 'Session 1/4'}</span>
          )}
        </div>
      )}
    </div>
  );
}
