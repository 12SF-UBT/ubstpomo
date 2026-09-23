import React from 'react';
import { useTimer } from '../context/TimerContext';
import { Volume2, VolumeX, Music, CloudRain, Waves, Radio } from 'lucide-react';

export function SoundControls() {
  const { settings, updateSettings } = useTimer();

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
          <Music className="w-5 h-5" />
          <span>Ambient Soundscape</span>
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
              <span>Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Sound On</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Study Ambient Sound Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Study Sound
          </label>
          <select
            value={settings.studySound}
            onChange={(e) => updateSettings({ studySound: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="rain">🌧️ Soft Rain Noise</option>
            <option value="waves">🌊 Ocean Waves Synth</option>
            <option value="drone">🎶 Warm Ambient Drone</option>
            <option value="off">🔇 Off (No Sound)</option>
          </select>
        </div>

        {/* Break Ambient Sound Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Break Sound
          </label>
          <select
            value={settings.breakSound}
            onChange={(e) => updateSettings({ breakSound: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="waves">🌊 Ocean Waves Synth</option>
            <option value="rain">🌧️ Soft Rain Noise</option>
            <option value="drone">🎶 Warm Ambient Drone</option>
            <option value="off">🔇 Off (No Sound)</option>
          </select>
        </div>
      </div>

      {/* Volume Slider */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
          <span>Master Volume</span>
          <span className="font-mono">{Math.round(settings.volume * 100)}%</span>
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
