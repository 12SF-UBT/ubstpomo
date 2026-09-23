import React from 'react';
import { useTimer } from '../context/TimerContext';
import { Sliders, Repeat } from 'lucide-react';

export function SettingsPanel() {
  const { settings, updateSettings } = useTimer();

  const handleNumberChange = (field, value) => {
    const val = Math.max(1, parseInt(value, 10) || 1);
    updateSettings({ [field]: val });
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
          <Sliders className="w-5 h-5" />
          <span>Timer Settings</span>
        </div>

        {/* Mode Selector Tab */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => updateSettings({ modeType: 'standard' })}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              settings.modeType === 'standard'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Standard Mode
          </button>
          <button
            onClick={() => updateSettings({ modeType: 'custom' })}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              settings.modeType === 'custom'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom Mode
          </button>
        </div>
      </div>

      {settings.modeType === 'standard' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Study Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="240"
              value={settings.studyDuration}
              onChange={(e) => handleNumberChange('studyDuration', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Short Break (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={settings.shortBreakDuration}
              onChange={(e) => handleNumberChange('shortBreakDuration', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Long Break (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={settings.longBreakDuration}
              onChange={(e) => handleNumberChange('longBreakDuration', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Long Break After (sessions)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.longBreakAfter}
              onChange={(e) => handleNumberChange('longBreakAfter', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Repeat Sequence Settings */}
      <div className="pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <Repeat className="w-4 h-4 text-indigo-400" />
          <span>Recurring Sequence Options</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Repeat Mode
            </label>
            <select
              value={settings.repeatMode}
              onChange={(e) => updateSettings({ repeatMode: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="continuous">Repeat Continuously</option>
              <option value="count">Repeat Fixed Count</option>
              <option value="none">Stop after 1 cycle</option>
            </select>
          </div>

          {settings.repeatMode === 'count' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Target Loops
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={settings.targetLoops}
                onChange={(e) => handleNumberChange('targetLoops', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
