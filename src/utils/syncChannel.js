const CHANNEL_NAME = 'camo_pomodoro_sync';
const SYNC_ENDPOINT = '/api/sync';
const KEY_HEADER = 'X-Sync-Key';
const KEY_STORAGE = 'ubst_pomo_sync_key_v1';
const ROOM_STORAGE = 'ubst_pomo_sync_room_v1';

// Sent by an overlay that just opened in this browser; the timer page answers
// with its current state
const REQUEST_STATE = 'request-state';

// OBS / Camo browser sources run in their own process, so they can only get
// the timer through the relay (/api/sync). They poll it; the app posts to it.
const POLL_INTERVAL_MS = 3000;

// An overlay tab that is hidden (not being captured) checks in less often
const HIDDEN_POLL_INTERVAL_MS = 15000;

// Re-post the latest state now and then, so an overlay that opens after the
// relay lost its memory (a restart) still gets the timer
const HEARTBEAT_MS = 5 * 60 * 1000;

// A post that didn't go through is retried, backing off from a few seconds up
// to the heartbeat, so a dropped pause/skip reaches the overlay quickly
const RETRY_MIN_MS = 5000;

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {}
};

const createRandomId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

let fallbackKey = null;

// Secret that lets this browser write its timer to the relay. The relay files
// the state under a room id derived from it, and only that room id goes into
// the overlay URL, so an overlay link can read the timer but never change it.
const getSyncKey = () => {
  let key = readStorage(KEY_STORAGE);
  if (!key) {
    key = fallbackKey || createRandomId();
    fallbackKey = key;
    writeStorage(KEY_STORAGE, key);
  }
  return key;
};

// Room of an overlay page: ?room=... either before or inside the #/overlay hash
export const getRoomFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const hashQuery = window.location.hash.split('?')[1] || '';
  return (
    new URLSearchParams(window.location.search).get('room') ||
    new URLSearchParams(hashQuery).get('room')
  );
};

// Room of the timer running in this browser, once the relay has confirmed it
export const getStoredRoom = () => readStorage(ROOM_STORAGE);

// Relay connection as shown in the overlay settings ('unknown' until the first
// post completes). Replaced, never mutated, so React can subscribe to it.
let syncStatus = { room: getStoredRoom(), relay: 'unknown' };
const statusListeners = new Set();

const updateSyncStatus = (patch) => {
  const next = { ...syncStatus, ...patch };
  if (next.room === syncStatus.room && next.relay === syncStatus.relay) return;
  syncStatus = next;
  statusListeners.forEach((listener) => listener());
};

export const getSyncStatus = () => syncStatus;

export const subscribeSyncStatus = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

export const syncChannel = {
  channel: null,
  lastState: null,
  lastSignature: null,
  heartbeat: null,
  relayBusy: false,
  relayPending: null,
  retryTimer: null,
  retryDelay: RETRY_MIN_MS,

  init() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (!this.channel) {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.addEventListener('message', (event) => {
            if (event.data?.type === REQUEST_STATE && this.lastState) {
              this.broadcast(this.stamp());
            }
          });
        } catch (err) {
          console.warn('BroadcastChannel not available:', err);
          this.channel = null;
        }
      }
    }
  },

  postState(state) {
    // Effects re-run for changes the overlay doesn't show; skip identical states
    const signature = JSON.stringify(state);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.lastState = state;

    this.publish();

    if (!this.heartbeat && typeof window !== 'undefined') {
      this.heartbeat = setInterval(() => this.publish(), HEARTBEAT_MS);
    }
  },

  // Send the latest state, freshly timestamped, to overlays in this browser and
  // to the relay
  publish() {
    if (!this.lastState) return;
    const stamped = this.stamp();
    this.broadcast(stamped);
    this.sendToRelay(stamped);
  },

  stamp() {
    return { ...this.lastState, timestamp: Date.now() };
  },

  // Overlay tabs/popups in this browser
  broadcast(stamped) {
    this.init();
    if (this.channel) {
      try {
        this.channel.postMessage(stamped);
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed:', err);
      }
    }
  },

  // One request at a time, always with the newest state: a burst of changes
  // (dragging a color picker) costs a couple of requests, and they can't arrive
  // out of order
  async sendToRelay(stamped) {
    this.relayPending = stamped;
    if (this.relayBusy || typeof fetch === 'undefined') return;
    this.relayBusy = true;

    while (this.relayPending) {
      const state = this.relayPending;
      this.relayPending = null;
      let delivered = false;

      try {
        const res = await fetch(SYNC_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [KEY_HEADER]: getSyncKey() },
          body: JSON.stringify(state),
          credentials: 'omit',
          // Lets the request finish even if the browser freezes the tab right after
          keepalive: true,
        });
        const data = await res.json().catch(() => null);

        if (res.ok && typeof data?.room === 'string') {
          delivered = true;
          writeStorage(ROOM_STORAGE, data.room);
          updateSyncStatus({ room: data.room, relay: 'ok' });
        } else {
          updateSyncStatus({ relay: 'unavailable' });
        }
      } catch (err) {
        console.debug('Sync POST failed:', err.message);
        updateSyncStatus({ relay: 'unavailable' });
      }

      if (delivered) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
        this.retryDelay = RETRY_MIN_MS;
      } else if (!this.retryTimer && !this.relayPending) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.sendToRelay(this.stamp());
        }, this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, HEARTBEAT_MS);
      }
    }

    this.relayBusy = false;
  },

  subscribe(callback, room) {
    this.init();

    let lastTimestamp = 0;
    let stopped = false;
    let polling = false;
    let pollTimer = null;

    const processData = (data) => {
      if (!data || typeof data !== 'object') return;

      // Ignore older or duplicate messages (the relay keeps serving the same state,
      // and the same state can arrive through both the channel and the relay)
      const dataTimestamp = data.timestamp || 0;
      if (dataTimestamp <= lastTimestamp) return;
      lastTimestamp = dataTimestamp;

      try {
        callback(data);
      } catch (err) {
        console.error('Error in sync callback:', err);
      }
    };

    // 1. Same-browser overlay: instant, and ask an open timer page for its state
    const handleMessage = (event) => processData(event?.data);
    if (this.channel) {
      this.channel.addEventListener('message', handleMessage);
      try {
        this.channel.postMessage({ type: REQUEST_STATE });
      } catch (err) {}
    }

    // 2. Separate process (OBS / Camo): poll this room on the relay
    const poll = async () => {
      clearTimeout(pollTimer);
      if (stopped || polling) return;
      polling = true;

      try {
        const res = await fetch(`${SYNC_ENDPOINT}?room=${encodeURIComponent(room)}`, {
          cache: 'no-store',
          credentials: 'omit',
        });
        if (res.ok) processData(await res.json());
      } catch (err) {
        console.debug('Sync poll failed:', err.message);
      }

      polling = false;
      if (!stopped) {
        pollTimer = setTimeout(poll, document.hidden ? HIDDEN_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
      }
    };

    // Catch up right away when a hidden overlay is shown again
    const handleVisibilityChange = () => {
      if (!document.hidden) poll();
    };

    if (room && typeof fetch !== 'undefined') {
      poll();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Return cleanup function
    return () => {
      stopped = true;
      clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (this.channel) {
        this.channel.removeEventListener('message', handleMessage);
      }
    };
  }
};
