import React, { useState, useEffect } from 'react';
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
    // Attempt load initial stored values
    let defaults = {
      timeLeft: 50 * 60,
      sessionName: 'STUDY',
      sessionType: 'study',
      overlayFontSize: 140,
      overlayColor: '#ffffff',
      overlayShowLabel: true,
      overlayFontFamily: 'mono'
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        defaults.overlayFontSize = parsed.overlayFontSize || 140;
        defaults.overlayColor = parsed.overlayColor || '#ffffff';
        defaults.overlayShowLabel = parsed.overlayShowLabel !== false;
        defaults.overlayFontFamily = parsed.overlayFontFamily || 'mono';
        defaults.timeLeft = (parsed.studyDuration || 50) * 60;
      }
    } catch (e) {}

    return defaults;
  });

  // Ensure body and html background are transparent
  useEffect(() => {
    document.documentElement.classList.add('overlay-body');
    document.body.classList.add('overlay-body');

    return () => {
      document.documentElement.classList.remove('overlay-body');
      document.body.classList.remove('overlay-body');
    };
  }, []);

  // Listen for real-time broadcasts from main timer window
  useEffect(() => {
    const unsubscribe = syncChannel.subscribe((data) => {
      setOverlayState((prev) => ({
        ...prev,
        timeLeft: data.timeLeft !== undefined ? data.timeLeft : prev.timeLeft,
        sessionName: data.sessionName || prev.sessionName,
        sessionType: data.sessionType || prev.sessionType,
        overlayFontSize: data.overlayFontSize !== undefined ? data.overlayFontSize : prev.overlayFontSize,
        overlayColor: data.overlayColor !== undefined ? data.overlayColor : prev.overlayColor,
        overlayShowLabel: data.overlayShowLabel !== undefined ? data.overlayShowLabel : prev.overlayShowLabel,
        overlayFontFamily: data.overlayFontFamily || prev.overlayFontFamily,
      }));
    });

    return unsubscribe;
  }, []);

  const formattedTime = formatTime(overlayState.timeLeft);

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center select-none overflow-hidden bg-transparent">
      {/* Session Label (Optional) */}
      {overlayState.overlayShowLabel && (
        <div
          className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-1 border shadow-sm backdrop-blur-sm"
          style={{
            color: overlayState.overlayColor,
            borderColor: `${overlayState.overlayColor}40`,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          }}
        >
          {overlayState.sessionName || 'STUDY'}
        </div>
      )}

      {/* Large Timer Digits */}
      <div
        className={`font-bold tracking-tight leading-none transition-all duration-150 ${
          overlayState.overlayFontFamily === 'mono' ? 'font-mono' : 'font-sans'
        }`}
        style={{
          fontSize: `${overlayState.overlayFontSize}px`,
          color: overlayState.overlayColor,
          textShadow: '0 4px 16px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.8)',
        }}
      >
        {formattedTime}
      </div>
    </div>
  );
}
