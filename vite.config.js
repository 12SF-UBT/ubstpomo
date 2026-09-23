import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Live timer sync state relay middleware for cross-browser web captures (Camo Studio / OBS)
const timerSyncPlugin = () => {
  let latestState = null;
  const clients = new Set();

  return {
    name: 'timer-sync-server',
    configureServer(server) {
      // POST endpoint to update state
      server.middlewares.use('/api/sync', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              latestState = JSON.parse(body);
              const dataStr = `data: ${JSON.stringify(latestState)}\n\n`;
              clients.forEach(client => {
                try { client.write(dataStr); } catch (err) {}
              });
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(latestState || {}));
          return;
        }

        next();
      });

      // SSE event stream endpoint for instant live push
      server.middlewares.use('/api/stream', (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (res.flushHeaders) res.flushHeaders();

          if (latestState) {
            res.write(`data: ${JSON.stringify(latestState)}\n\n`);
          }

          clients.add(res);

          req.on('close', () => {
            clients.delete(res);
          });
          return;
        }
        next();
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), timerSyncPlugin()],
  server: {
    port: 3000,
    host: true
  }
});

