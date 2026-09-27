import React, { useState, useSyncExternalStore } from 'react';
import { useTimer } from '../context/TimerContext';
import { getSyncStatus, subscribeSyncStatus } from '../utils/syncChannel';
import { ExternalLink, Copy, Check, Tv, Palette, Type } from 'lucide-react';

const RELAY_STATUS = {
  ok: {
    dot: 'bg-emerald-400',
    text: 'Live sync on: this URL works in Camo Studio, OBS and any other browser.',
  },
  unavailable: {
    dot: 'bg-amber-400',
    text: 'Live sync server unreachable: for now this URL only works in this browser.',
  },
  unknown: {
    dot: 'bg-slate-500',
    text: 'Connecting to live sync…',
  },
};

export function OverlaySettings() {
  const { settings, updateSettings } = useTimer();
  const [copied, setCopied] = useState(false);
  const { room, relay } = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);

  // Generate exact overlay URL for Camo Studio Web Capture / OBS. The room ties
  // the overlay to this browser's timer on the sync relay (read-only).
  const overlayUrl = `${window.location.origin}${window.location.pathname}#/overlay${room ? `?room=${room}` : ''}`;
  const relayStatus = RELAY_STATUS[relay] || RELAY_STATUS.unknown;

  const handleOpenOverlay = () => {
    window.open(overlayUrl, 'CamoPomodoroOverlay', 'width=600,height=300,toolbar=no,menubar=no,status=no,resizable=yes');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
          <Tv className="w-5 h-5" />
          <span>Camo Studio Overlay Mode</span>
        </div>

        <button
          onClick={handleOpenOverlay}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
        >
          <ExternalLink className="w-4 h-4" />
          <span>OPEN OVERLAY</span>
        </button>
      </div>

      <p className="text-slate-400 text-xs leading-relaxed">
        Overlay Mode is designed with a transparent background for Camo Studio Web Capture. Load this URL into Camo Studio as a Web Layer:
      </p>

      {/* Copy URL Input Group */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={overlayUrl}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
        />
        <button
          onClick={handleCopyUrl}
          className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy URL</span>
            </>
          )}
        </button>
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400 -mt-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${relayStatus.dot}`} />
        <span>{relayStatus.text}</span>
      </p>

      {/* Customizations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
        {/* Timer Font Size */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <span>Timer Size (px)</span>
          </label>
          <input
            type="number"
            min="40"
            max="300"
            step="10"
            value={settings.overlayFontSize}
            onChange={(e) => updateSettings({ overlayFontSize: parseInt(e.target.value, 10) || 120 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Timer Digits Color */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>Timer Color</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.overlayColor || '#ffffff'}
              onChange={(e) => updateSettings({ overlayColor: e.target.value })}
              className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
            />
            <input
              type="text"
              value={settings.overlayColor || '#ffffff'}
              onChange={(e) => updateSettings({ overlayColor: e.target.value })}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Label & Counter Color (Yellow default) */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Session Text Color</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.overlayLabelColor || '#fef08a'}
              onChange={(e) => updateSettings({ overlayLabelColor: e.target.value })}
              className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
            />
            <input
              type="text"
              value={settings.overlayLabelColor || '#fef08a'}
              onChange={(e) => updateSettings({ overlayLabelColor: e.target.value })}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Label & Counter Font Size */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <span>Label & Counter Size (px)</span>
          </label>
          <input
            type="number"
            min="12"
            max="120"
            step="2"
            value={settings.overlayLabelFontSize || 36}
            onChange={(e) => updateSettings({ overlayLabelFontSize: parseInt(e.target.value, 10) || 36 })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Study/Break Label Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Study/Break Label
          </label>
          <button
            onClick={() => updateSettings({ overlayShowLabel: !settings.overlayShowLabel })}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
              settings.overlayShowLabel
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {settings.overlayShowLabel ? 'Study/Break Label ON' : 'Label OFF'}
          </button>
        </div>

        {/* Session Counter Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Session Counter (Session 2/4)
          </label>
          <button
            onClick={() => updateSettings({ overlayShowSessionCount: !settings.overlayShowSessionCount })}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
              settings.overlayShowSessionCount
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {settings.overlayShowSessionCount ? 'Counter ON' : 'Counter OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
