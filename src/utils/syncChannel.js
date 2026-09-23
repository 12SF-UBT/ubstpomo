const CHANNEL_NAME = 'camo_pomodoro_sync';

export const syncChannel = {
  channel: null,

  init() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (!this.channel) {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
      }
    }
  },

  postState(state) {
    this.init();
    
    // Broadcast via BroadcastChannel (same browser tabs)
    if (this.channel) {
      try {
        this.channel.postMessage(state);
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed:', err);
      }
    }

    // Broadcast via HTTP API endpoint (cross-browser / Camo Web Capture process)
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        }).catch(() => {});
      } catch (e) {}
    }
  },

  subscribe(callback) {
    this.init();
    let lastTimestamp = 0;

    const processData = (data) => {
      if (data && typeof data === 'object' && data.timestamp) {
        if (data.timestamp >= lastTimestamp) {
          lastTimestamp = data.timestamp;
          callback(data);
        }
      }
    };
    
    // 1. Listen via BroadcastChannel
    const handler = (event) => {
      if (event && event.data) {
        processData(event.data);
      }
    };

    if (this.channel) {
      this.channel.addEventListener('message', handler);
    }

    // 2. Listen via Server-Sent Events (SSE) for Camo Studio / external web capture
    let eventSource = null;
    if (typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource('/api/stream');
        eventSource.onmessage = (event) => {
          if (event && event.data) {
            try {
              const data = JSON.parse(event.data);
              processData(data);
            } catch (e) {}
          }
        };
      } catch (e) {}
    }

    // 3. Fallback HTTP Poll every 500ms if SSE or BroadcastChannel are disconnected
    const pollInterval = setInterval(() => {
      if (typeof fetch !== 'undefined') {
        fetch('/api/sync')
          .then(res => res.json())
          .then(data => {
            if (data && data.timestamp) {
              processData(data);
            }
          })
          .catch(() => {});
      }
    }, 500);

    return () => {
      if (this.channel) {
        this.channel.removeEventListener('message', handler);
      }
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(pollInterval);
    };
  }
};

