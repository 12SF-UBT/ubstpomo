const CHANNEL_NAME = 'camo_pomodoro_sync';
const LIVE_STATE_KEY = 'ubst_pomo_live_state_v1';

export const syncChannel = {
  channel: null,
  lastTimestamp: 0,

  init() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (!this.channel) {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
        } catch (err) {
          console.warn('BroadcastChannel not available:', err);
          this.channel = null;
        }
      }
    }
  },

  postState(state) {
    this.init();
    
    const payload = {
      ...state,
      timestamp: Date.now()
    };

    // 1. Broadcast to same-browser windows via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed:', err);
      }
    }

    // 2. Persist complete unified state payload to localStorage for instant cross-window sync
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LIVE_STATE_KEY, JSON.stringify(payload));
      } catch (err) {}
    }
  },

  subscribe(callback) {
    this.init();
    this.lastTimestamp = 0;

    const processData = (data) => {
      if (!data || typeof data !== 'object') return false;
      
      const dataTimestamp = data.timestamp || 0;
      
      // Strict timestamp ordering: ignore older or duplicate state payloads
      if (dataTimestamp < this.lastTimestamp) {
        return false;
      }
      
      this.lastTimestamp = dataTimestamp;
      
      try {
        callback(data);
        return true;
      } catch (err) {
        console.error('Error in sync callback:', err);
        return false;
      }
    };

    // 1. Initial State Load from localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const initialSaved = localStorage.getItem(LIVE_STATE_KEY);
        if (initialSaved) {
          processData(JSON.parse(initialSaved));
        }
      } catch (e) {}
    }

    // 2. Listen via BroadcastChannel
    const broadcastHandler = (event) => {
      if (event && event.data) {
        processData(event.data);
      }
    };

    if (this.channel) {
      try {
        this.channel.addEventListener('message', broadcastHandler);
      } catch (err) {}
    }

    // 3. Listen via Window Storage Events (instant cross-window fallback)
    const storageHandler = (e) => {
      if (e.key === LIVE_STATE_KEY && e.newValue) {
        try {
          processData(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };

    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('storage', storageHandler);
      } catch (err) {}
    }

    // Cleanup subscription
    return () => {
      if (this.channel) {
        try {
          this.channel.removeEventListener('message', broadcastHandler);
        } catch (err) {}
      }
      if (typeof window !== 'undefined') {
        try {
          window.removeEventListener('storage', storageHandler);
        } catch (err) {}
      }
    };
  }
};
