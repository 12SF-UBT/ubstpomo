// Run-plan logic shared by the timer (TimerContext) and the OBS / Camo overlay,
// so both agree on which session is running at any moment. A "plan" is
// { modeType, repeatMode, targetLoops } plus the sequence of sessions; the
// timer settings object works as a plan too.

// Sessions of one loop, from the timer settings
export const buildSequence = (settings) => {
  if (settings.modeType === 'custom') {
    return settings.customSequence?.length > 0
      ? settings.customSequence
      : [{ id: 'def', name: 'Study', type: 'study', duration: settings.studyDuration }];
  }

  const studyCount = Math.max(1, settings.longBreakAfter || 1);
  const seq = [];
  for (let i = 1; i <= studyCount; i++) {
    seq.push({
      id: `std-study-${i}`,
      name: 'STUDY',
      type: 'study',
      duration: settings.studyDuration,
      stepNumber: i,
    });
    if (i < studyCount) {
      seq.push({
        id: `std-short-${i}`,
        name: 'SHORT BREAK',
        type: 'break',
        duration: settings.shortBreakDuration,
      });
    } else {
      seq.push({
        id: `std-long-${i}`,
        name: 'LONG BREAK',
        type: 'break',
        duration: settings.longBreakDuration,
      });
    }
  }
  return seq;
};

// Length of a session in seconds (a broken duration counts as one minute so the
// timeline can never stall)
export const sessionSeconds = (step) => {
  const minutes = Number(step?.duration);
  return Math.max(1, Math.round((minutes > 0 ? minutes : 1) * 60));
};

export const secondsUntil = (endTime, now) => Math.ceil(Math.max(0, endTime - now) / 1000);

// Position that follows (index, loop) in the sequence, or null once the whole
// run is finished (repeatMode 'none', or 'count' after the last loop)
export const getNextPosition = (seq, index, loop, plan) => {
  if (index + 1 < seq.length) return { index: index + 1, loop };
  if (plan.repeatMode === 'continuous') return { index: 0, loop: loop + 1 };
  if (plan.repeatMode === 'count' && loop < plan.targetLoops) return { index: 0, loop: loop + 1 };
  return null;
};

const lastLoop = (plan) => {
  if (plan.repeatMode === 'continuous') return Infinity;
  if (plan.repeatMode === 'count') return plan.targetLoops;
  return 1;
};

export const getProgressInfo = (seq, plan, index, loop) => {
  const loopText = plan.repeatMode === 'count' ? `Loop ${loop} / ${plan.targetLoops}` : '';

  if (plan.modeType === 'custom') {
    return {
      current: index + 1,
      total: seq.length,
      text: `Session ${index + 1} / ${seq.length}`,
      loopText,
    };
  }

  const step = seq[index] || seq[0];
  const total = seq.filter(s => s.type === 'study').length;
  const current = Math.max(1, seq.slice(0, index + 1).filter(s => s.type === 'study').length);

  return {
    current,
    total,
    text: step.type === 'study' ? `Session ${current} / ${total}` : `Break after Session ${current}`,
    loopText,
  };
};

// Follows the run forward from session `index` of loop `loop`, which ends at
// `endTime`, to the session running at `now`. Each session starts the moment
// the previous one ends, so a tab the browser froze, throttled or discarded
// catches up exactly instead of stopping at 00:00 or starting the next session
// late. Returns { index, loop, endTime, finished }; when the run is over,
// `finished` is true and the position is its last session.
export const resolvePosition = (seq, plan, index, loop, endTime, now) => {
  let position = { index, loop, endTime, finished: false };
  const loopMs = seq.reduce((total, step) => total + sessionSeconds(step) * 1000, 0);

  while (position.endTime <= now) {
    const next = getNextPosition(seq, position.index, position.loop, plan);
    if (!next) return { ...position, finished: true };

    position = {
      index: next.index,
      loop: next.loop,
      endTime: position.endTime + sessionSeconds(seq[next.index]) * 1000,
      finished: false,
    };

    // A session and the same session one loop later are exactly one loop
    // apart, so after a long sleep jump over whole loops at once
    const loopsBehind = Math.min(
      Math.floor((now - position.endTime) / loopMs),
      lastLoop(plan) - position.loop
    );
    if (loopsBehind > 0) {
      position.loop += loopsBehind;
      position.endTime += loopsBehind * loopMs;
    }
  }

  return position;
};
