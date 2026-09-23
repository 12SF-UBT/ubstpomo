import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Live timer sync state relay middleware for cross-browser web captures (Camo Studio / OBS)
const timerSyncPlugin = () => {
  let latestState = null;
  const clients = new Set();

  return {
    name: 'timer-sync-server',
    configureServer(server) {
      // POST endpoint to update state from website
      server.middlewares.use('/api/sync', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          
          const onData = (chunk) => { body += chunk; };
          const onEnd = () => {
            try {
              latestState = JSON.parse(body);
              const dataStr = `data: ${JSON.stringify(latestState)}\n\n`;
              
              // Broadcast to all SSE clients
              clients.forEach(client => {
                try { 
                  client.write(dataStr);
                } catch (err) {
                  // Client disconnected, will be removed by close handler
                  clients.delete(client);
                }
              });
              
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: e.message }));
            }
          };

          req.on('data', onData);
          req.on('end', onEnd);
          return;
        }

        if (req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(latestState || {}));
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        next();
      });

      // SSE event stream endpoint for instant live push to Camo Studio
      server.middlewares.use('/api/stream', (req, res, next) => {
        if (req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Accel-Buffering', 'no');

          if (res.flushHeaders) res.flushHeaders();

          // Send initial state if available
          if (latestState) {
            res.write(`data: ${JSON.stringify(latestState)}\n\n`);
          }

          clients.add(res);

          // Handle client disconnect
          const onClose = () => {
            clients.delete(res);
            res.end();
          };

          req.on('close', onClose);

          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
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
