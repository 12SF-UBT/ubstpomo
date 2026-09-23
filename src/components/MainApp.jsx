import React from 'react';
import { useTimer } from '../context/TimerContext';
import { TimerDisplay } from './TimerDisplay';
import { TimerControls } from './TimerControls';
import { SettingsPanel } from './SettingsPanel';
import { CustomSequenceEditor } from './CustomSequenceEditor';
import { SoundControls } from './SoundControls';
import { OverlaySettings } from './OverlaySettings';
import { Timer as TimerIcon, Sparkles } from 'lucide-react';

export function MainApp() {
  const { settings } = useTimer();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-3xl space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
              <TimerIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                UbstPomo <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Camo Overlay</span>
              </h1>
              <p className="text-xs text-slate-400">Minimal Pomodoro & Camo Studio Web Capture Overlay</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {settings.modeType === 'standard' ? 'Standard Cycle' : 'Custom Sequence'}
            </span>
          </div>
        </header>

        {/* Main Countdown Display */}
        <section>
          <TimerDisplay />
          <TimerControls />
        </section>

        {/* Main Control Panels Grid */}
        <main className="space-y-6 pt-2">
          {/* Overlay Configuration (Top priority for Camo user) */}
          <OverlaySettings />

          {/* Standard vs Custom Mode Editor */}
          {settings.modeType === 'standard' ? (
            <SettingsPanel />
          ) : (
            <>
              <CustomSequenceEditor />
              <SettingsPanel />
            </>
          )}

          {/* Sound Controls */}
          <SoundControls />
        </main>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-slate-800/60 text-xs text-slate-500">
          Built for Camo Studio Web Capture & Overlay • Pure Local Web App
        </footer>
      </div>
    </div>
  );
}
