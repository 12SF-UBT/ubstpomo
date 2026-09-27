import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleSyncRequest, createMemoryStore, MAX_BODY_BYTES, SYNC_KEY_HEADER } from './server/syncRelay.js';

// Live timer sync relay for cross-browser web captures (Camo Studio / OBS).
// Same API as the Vercel function in api/sync.js, kept in memory for local use.
const timerSyncPlugin = () => {
  const store = createMemoryStore();

  const middleware = async (req, res) => {
    const room = new URL(req.url, 'http://localhost').searchParams.get('room');

    let body = '';
    let size = 0;
    if (req.method === 'POST') {
      for await (const chunk of req) {
        size += chunk.length;
        if (size <= MAX_BODY_BYTES) body += chunk;
      }
    }

    const { status, json } = size > MAX_BODY_BYTES
      ? { status: 413, json: { error: 'State too large' } }
      : await handleSyncRequest({ method: req.method, room, key: req.headers[SYNC_KEY_HEADER], body }, store);

    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(json));
  };

  return {
    name: 'timer-sync-server',
    configureServer(server) {
      server.middlewares.use('/api/sync', middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/sync', middleware);
    },
  };
};

export default defineConfig({
  plugins: [react(), timerSyncPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    middlewareMode: false,
    strictPort: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }
  }
});
