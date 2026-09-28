import React, { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { audioEngine } from '../utils/audioEngine';
import { Bell, Volume2, VolumeX, Play, Sparkles, Coffee } from 'lucide-react';

export function SoundControls() {
  const { settings, updateSettings } = useTimer();
  const [isPlayingTest, setIsPlayingTest] = useState(null);

  const handleTestStudy = () => {
    audioEngine.initContext();
    audioEngine.playStudyAlarm();
    setIsPlayingTest('study');
    setTimeout(() => setIsPlayingTest(null), 4000);
  };

  const handleTestBreak = () => {
    audioEngine.initContext();
    audioEngine.playBreakAlarm();
    setIsPlayingTest('break');
    setTimeout(() => setIsPlayingTest(null), 4000);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
          <Bell className="w-5 h-5" />
          <span>Transition Alarms</span>
        </div>

        {/* Master Mute Toggle */}
        <button
          onClick={() => updateSettings({ isMuted: !settings.isMuted })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            settings.isMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
          }`}
        >
          {settings.isMuted ? (
            <>
              <VolumeX className="w-4 h-4" />
              <span>Alarms Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Alarms On</span>
            </>
          )}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed">
        Plays a loud, soothing 4-second harmonic chime sequence whenever the timer switches between Study and Break so you are immediately notified without annoying ambient noise.
      </p>

      {/* 4s Alarm Cards & Test Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Break to Study Alarm */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Break → Study Alarm (4s)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Uplifting, clear harmonic bell sequence (Time to Focus).
            </p>
          </div>
          <button
            onClick={handleTestStudy}
            disabled={isPlayingTest !== null}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              isPlayingTest === 'study'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isPlayingTest === 'study' ? 'Playing 4s Alarm…' : 'Test Study Alarm'}</span>
          </button>
        </div>

        {/* Study to Break Alarm */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
              <Coffee className="w-4 h-4" />
              <span>Study → Break Alarm (4s)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deep, calming singing-bowl sequence (Time to Rest).
            </p>
          </div>
          <button
            onClick={handleTestBreak}
            disabled={isPlayingTest !== null}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              isPlayingTest === 'break'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isPlayingTest === 'break' ? 'Playing 4s Alarm…' : 'Test Break Alarm'}</span>
          </button>
        </div>
      </div>

      {/* Volume Slider */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
          <span>Alarm Volume</span>
          <span className="font-mono text-indigo-400">{Math.round(settings.volume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
          className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 border border-slate-800"
        />
      </div>
    </div>
  );
}
