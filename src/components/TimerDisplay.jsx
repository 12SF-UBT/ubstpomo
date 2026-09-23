import React from 'react';
import { useTimer } from '../context/TimerContext';

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

export function TimerDisplay() {
  const { currentStep, timeLeft, sessionProgressInfo, status } = useTimer();

  const formatted = formatTime(timeLeft);

  // Badge color based on session type
  const getBadgeStyle = () => {
    if (!currentStep) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (currentStep.type === 'study') {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10';
    }
    if (currentStep.name && currentStep.name.includes('LONG')) {
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-purple-500/10';
    }
    return 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-sky-500/10';
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl relative overflow-hidden group">
      {/* Background ambient light glow */}
      <div 
        className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700 ${
          currentStep?.type === 'study' ? 'bg-emerald-500' : 'bg-sky-500'
        }`}
      />

      {/* Session Badge */}
      <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-lg mb-4 transition-all duration-300 ${getBadgeStyle()}`}>
        {currentStep?.name || 'STUDY'}
      </div>

      {/* Big Countdown Timer */}
      <div className="font-mono text-7xl sm:text-8xl md:text-9xl font-extrabold tracking-tight text-white drop-shadow-md my-2 selection:bg-indigo-500">
        {formatted}
      </div>

      {/* Current Session Counter & Loop status */}
      <div className="flex flex-col items-center gap-1 mt-3">
        <span className="text-slate-400 text-sm font-semibold tracking-wide">
          {sessionProgressInfo.text}
        </span>
        {sessionProgressInfo.loopText && (
          <span className="text-slate-500 text-xs font-medium">
            {sessionProgressInfo.loopText}
          </span>
        )}
      </div>
    </div>
  );
}
