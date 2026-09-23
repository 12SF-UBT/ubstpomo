import React from 'react';
import { useTimer } from '../context/TimerContext';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';

export function TimerControls() {
  const { status, startTimer, pauseTimer, resumeTimer, resetTimer, skipSession } = useTimer();

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6">
      {/* Start / Pause / Resume Main Button */}
      {status === 'idle' && (
        <button
          onClick={startTimer}
          className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 active:scale-95"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>Start</span>
        </button>
      )}

      {status === 'running' && (
        <button
          onClick={pauseTimer}
          className="flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 active:scale-95"
        >
          <Pause className="w-6 h-6 fill-current" />
          <span>Pause</span>
        </button>
      )}

      {status === 'paused' && (
        <button
          onClick={resumeTimer}
          className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 active:scale-95"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>Resume</span>
        </button>
      )}

      {/* Reset Button */}
      <button
        onClick={resetTimer}
        title="Reset Timer"
        className="flex items-center justify-center p-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white rounded-2xl shadow-md transition-all duration-200 active:scale-95"
      >
        <RotateCcw className="w-5 h-5" />
      </button>

      {/* Skip Button */}
      <button
        onClick={skipSession}
        title="Skip Current Session"
        className="flex items-center justify-center p-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white rounded-2xl shadow-md transition-all duration-200 active:scale-95"
      >
        <SkipForward className="w-5 h-5" />
      </button>
    </div>
  );
}
