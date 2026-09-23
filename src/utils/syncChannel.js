const CHANNEL_NAME = 'camo_pomodoro_sync';

export const syncChannel = {
  channel: null,
  eventSource: null,
  pollInterval: null,
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
    
    // Always include timestamp
    const stateWithTimestamp = {
      ...state,
      timestamp: Date.now()
    };

    // 1. Broadcast via BroadcastChannel (same browser tabs)
    if (this.channel) {
      try {
        this.channel.postMessage(stateWithTimestamp);
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed:', err);
      }
    }

    // 2. Broadcast via HTTP API endpoint (cross-browser / Camo Web Capture process)
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stateWithTimestamp),
          credentials: 'omit'
        }).catch((err) => {
          console.debug('Sync POST failed:', err.message);
        });
      } catch (e) {
        console.debug('Sync fetch error:', e);
      }
    }
  },

  subscribe(callback) {
    this.init();
    this.lastTimestamp = 0;

    const handlers = {
      broadcast: null,
      storage: null,
      close: null
    };

    const processData = (data) => {
      if (!data || typeof data !== 'object') return false;
      
      const dataTimestamp = data.timestamp || 0;
      
      // Ignore older or duplicate messages
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
    
    // 1. Listen via BroadcastChannel (primary for same-window sync)
    if (this.channel) {
      handlers.broadcast = (event) => {
        if (event && event.data) {
          processData(event.data);
        }
      };
      try {
        this.channel.addEventListener('message', handlers.broadcast);
      } catch (err) {
        console.warn('BroadcastChannel addEventListener failed:', err);
      }
    }

    // 2. Listen via Server-Sent Events (SSE) for Camo Studio / external web capture
    if (typeof EventSource !== 'undefined') {
      try {
        this.eventSource = new EventSource('/api/stream');
        
        this.eventSource.onmessage = (event) => {
          if (event && event.data) {
            try {
              const data = JSON.parse(event.data);
              processData(data);
            } catch (e) {
              console.debug('Failed to parse SSE data:', e);
            }
          }
        };

        this.eventSource.onerror = (err) => {
          console.debug('SSE connection error:', err);
          // EventSource will attempt to reconnect automatically
        };
      } catch (e) {
        console.debug('EventSource creation failed:', e);
      }
    }

    // 3. Listen via window storage event (fallback)
    handlers.storage = (e) => {
      if (e.key === 'ubst_pomo_run_state_v1' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          processData(data);
        } catch (err) {
          console.debug('Storage event parse error:', err);
        }
      }
    };

    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('storage', handlers.storage);
      } catch (err) {
        console.warn('Storage event listener failed:', err);
      }
    }

    // 4. Fallback HTTP Poll every 1000ms if other methods fail
    this.pollInterval = setInterval(() => {
      if (typeof fetch !== 'undefined') {
        fetch('/api/sync', {
          credentials: 'omit'
        })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(data => {
            if (data && typeof data === 'object') {
              processData(data);
            }
          })
          .catch((err) => {
            console.debug('Poll fetch error:', err.message);
          });
      }
    }, 1000);

    // Return cleanup function
    return () => {
      // Remove BroadcastChannel listener
      if (this.channel && handlers.broadcast) {
        try {
          this.channel.removeEventListener('message', handlers.broadcast);
        } catch (err) {}
      }

      // Close EventSource
      if (this.eventSource) {
        try {
          this.eventSource.close();
          this.eventSource = null;
        } catch (err) {}
      }

      // Remove storage listener
      if (typeof window !== 'undefined' && handlers.storage) {
        try {
          window.removeEventListener('storage', handlers.storage);
        } catch (err) {}
      }

      // Clear poll interval
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }
};
