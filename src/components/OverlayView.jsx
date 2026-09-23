import React, { useState, useEffect } from 'react';
import { syncChannel } from '../utils/syncChannel';

const SETTINGS_KEY = 'ubst_pomo_settings_v1';
const LIVE_STATE_KEY = 'ubst_pomo_live_state_v1';

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
      const liveSaved = localStorage.getItem(LIVE_STATE_KEY);
      if (liveSaved) {
        const parsedLive = JSON.parse(liveSaved);
        defaults = { ...defaults, ...parsedLive };
        if (parsedLive.status === 'running' && parsedLive.targetEndTime) {
          const remSec = Math.max(0, Math.ceil((parsedLive.targetEndTime - Date.now()) / 1000));
          defaults.timeLeft = remSec;
        }
      } else {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          defaults.overlayFontSize = parsed.overlayFontSize || defaults.overlayFontSize;
          defaults.overlayColor = parsed.overlayColor || defaults.overlayColor;
          defaults.overlayLabelColor = parsed.overlayLabelColor || defaults.overlayLabelColor;
          defaults.overlayLabelFontSize = parsed.overlayLabelFontSize || defaults.overlayLabelFontSize;
          defaults.overlayShowLabel = parsed.overlayShowLabel !== false;
          defaults.overlayShowSessionCount = parsed.overlayShowSessionCount !== false;
          defaults.overlayFontFamily = parsed.overlayFontFamily || defaults.overlayFontFamily;
          defaults.timeLeft = (parsed.studyDuration || 50) * 60;
        }
      }
    } catch (e) {}

    return defaults;
  });

  // Transparent background styling
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

  // Smooth target-time countdown ticker inside Camo Studio
  useEffect(() => {
    if (overlayState.status !== 'running' || !overlayState.targetEndTime) {
      return;
    }

    const updateDisplayTime = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, overlayState.targetEndTime - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      
      setOverlayState((prev) => {
        if (prev.timeLeft === remainingSec) return prev;
        return { ...prev, timeLeft: remainingSec };
      });
    };

    updateDisplayTime();
    const interval = setInterval(updateDisplayTime, 250);

    return () => clearInterval(interval);
  }, [overlayState.status, overlayState.targetEndTime]);

  // Subscribe to real-time state broadcasts
  useEffect(() => {
    const unsubscribe = syncChannel.subscribe((data) => {
      if (!data || typeof data !== 'object') return;

      setOverlayState((prev) => ({
        ...prev,
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
      }));
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
