import React, { useState, useEffect } from 'react';
import { useTimer } from '../context/TimerContext';
import { Layers, Plus, Trash2, Edit2, Check, X, Clock, GripVertical } from 'lucide-react';

export function CustomSequenceEditor() {
  const { settings, updateSettings, status, timeLeft, currentStepIndex } = useTimer();
  const sequence = settings.customSequence || [];

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'study', duration: 30 });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Keep live time ticking every 10 seconds for accurate clock display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Format a timestamp into Indian Standard Time (hh:mm A)
  const formatIST = (timestamp) => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp));
  };

  // Compute live start & end times for each session sequentially
  const sessionSchedules = (() => {
    let accumulatedMs = 0;
    const isCustomActive = settings.modeType === 'custom' && (status === 'running' || status === 'paused');
    const baseNow = currentTime;

    return sequence.map((item, index) => {
      const effectiveDurationMin =
        editingId === item.id
          ? Math.max(1, parseInt(editForm.duration, 10) || 1)
          : item.duration;

      let startMs;
      let endMs;

      if (isCustomActive) {
        if (index < currentStepIndex) {
          return { startStr: null, endStr: null, isPast: true, isCurrent: false };
        } else if (index === currentStepIndex) {
          startMs = baseNow;
          endMs = baseNow + (timeLeft || effectiveDurationMin * 60) * 1000;
          accumulatedMs = endMs;
          return {
            startStr: formatIST(startMs),
            endStr: formatIST(endMs),
            isPast: false,
            isCurrent: true,
          };
        } else {
          startMs = accumulatedMs;
          endMs = startMs + effectiveDurationMin * 60 * 1000;
          accumulatedMs = endMs;
          return {
            startStr: formatIST(startMs),
            endStr: formatIST(endMs),
            isPast: false,
            isCurrent: false,
          };
        }
      } else {
        startMs = baseNow + accumulatedMs;
        endMs = startMs + effectiveDurationMin * 60 * 1000;
        accumulatedMs += effectiveDurationMin * 60 * 1000;
        return {
          startStr: formatIST(startMs),
          endStr: formatIST(endMs),
          isPast: false,
          isCurrent: false,
        };
      }
    });
  })();

  // Add new session item
  const handleAdd = () => {
    const newItem = {
      id: Date.now().toString(),
      name: 'New Study Phase',
      type: 'study',
      duration: 30
    };
    updateSettings({ customSequence: [...sequence, newItem] });
  };

  // Delete session item
  const handleDelete = (id) => {
    updateSettings({ customSequence: sequence.filter(item => item.id !== id) });
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Optional: avoid clearing too early if nested elements trigger leave
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSeq = [...sequence];
    const [movedItem] = newSeq.splice(draggedIndex, 1);
    newSeq.splice(targetIndex, 0, movedItem);

    updateSettings({ customSequence: newSeq });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Start inline editing
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, type: item.type, duration: item.duration });
  };

  // Save inline editing
  const saveEdit = (id) => {
    const updated = sequence.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: editForm.name.trim() || (editForm.type === 'study' ? 'Study' : 'Break'),
          type: editForm.type,
          duration: Math.max(1, parseInt(editForm.duration, 10) || 1)
        };
      }
      return item;
    });
    updateSettings({ customSequence: updated });
    setEditingId(null);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
          <Layers className="w-5 h-5" />
          <span>Custom Sequence Builder</span>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Session</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
        <p className="text-slate-400">
          Drag and drop sessions by the handle <GripVertical className="w-3.5 h-3.5 inline text-slate-500" /> to reorder.
        </p>
        <div className="flex items-center gap-1.5 text-indigo-300/80 font-mono text-[11px] bg-indigo-950/40 border border-indigo-800/40 px-2.5 py-1 rounded-lg self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Synced with IST: <strong className="text-white">{formatIST(currentTime)}</strong></span>
        </div>
      </div>

      {/* Sequence List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {sequence.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm italic border border-dashed border-slate-800 rounded-2xl">
            No custom sessions added. Click "Add Session" to begin.
          </div>
        ) : (
          sequence.map((item, index) => {
            const isEditing = editingId === item.id;
            const schedule = sessionSchedules[index];
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={item.id}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950/80 border rounded-2xl p-3 transition-all gap-3 select-none ${
                  isDragging
                    ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-950/20 scale-[0.98]'
                    : isOver
                    ? 'border-indigo-400 bg-indigo-950/40 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/50'
                    : schedule?.isCurrent
                    ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-800/90 hover:border-slate-700/80'
                }`}
              >
                {isEditing ? (
                  /* Edit Form */
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Session Name"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 flex-1 min-w-[120px]"
                    />
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="study">Study</option>
                      <option value="break">Break</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={editForm.duration}
                        onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono w-16 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-slate-400">min</span>
                    </div>

                    {/* Live time preview badge while editing */}
                    {schedule?.startStr && schedule?.endStr && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-700/50 text-[11px] font-mono text-indigo-300">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>{schedule.startStr} → {schedule.endStr}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Item */
                  <>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Drag Grip Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-900 rounded-md transition-colors"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <span className="text-xs font-mono text-slate-500 font-bold w-4 text-center">
                        {index + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.type === 'study'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {item.name}
                      </span>

                      {/* IST Time Window Schedule Pill */}
                      {schedule && (
                        schedule.isPast ? (
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
                            Completed
                          </span>
                        ) : schedule.startStr && schedule.endStr ? (
                          <span
                            className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-lg border transition-colors ${
                              schedule.isCurrent
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold shadow-sm'
                                : 'bg-slate-900/90 text-slate-300 border-slate-800'
                            }`}
                            title="Indian Standard Time (IST) scheduled slot"
                          >
                            <Clock className={`w-3 h-3 ${schedule.isCurrent ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
                            <span>{schedule.startStr} - {schedule.endStr}</span>
                            {schedule.isCurrent && (
                              <span className="text-[9px] uppercase tracking-wider font-bold bg-indigo-500 text-white px-1.5 py-0.2 rounded-full">
                                Now
                              </span>
                            )}
                          </span>
                        ) : null
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/50">
                      <span className="font-mono text-sm text-slate-300 font-medium">
                        {item.duration}m
                      </span>

                      <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
