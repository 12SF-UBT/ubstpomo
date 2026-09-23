import React, { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { Layers, Plus, Trash2, ArrowUp, ArrowDown, Edit2, Check, X } from 'lucide-react';

export function CustomSequenceEditor() {
  const { settings, updateSettings } = useTimer();
  const sequence = settings.customSequence || [];

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'study', duration: 30 });

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

  // Move item up / down
  const handleMove = (index, direction) => {
    const newSeq = [...sequence];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSeq.length) return;

    const temp = newSeq[index];
    newSeq[index] = newSeq[targetIndex];
    newSeq[targetIndex] = temp;

    updateSettings({ customSequence: newSeq });
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

      <p className="text-slate-400 text-xs">
        Define your own custom routine. Sessions will execute sequentially from top to bottom.
      </p>

      {/* Sequence List */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {sequence.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm italic border border-dashed border-slate-800 rounded-2xl">
            No custom sessions added. Click "Add Session" to begin.
          </div>
        ) : (
          sequence.map((item, index) => {
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 hover:border-slate-700/80 transition-all gap-3"
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
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 font-bold w-4 text-center">
                        {index + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
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
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-300 font-medium">
                        {item.duration}m
                      </span>

                      <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                        <button
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(index, 'down')}
                          disabled={index === sequence.length - 1}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
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
