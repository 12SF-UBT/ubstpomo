import {
  handleSyncRequest,
  createUpstashStore,
  createMemoryStore,
  SYNC_KEY_HEADER,
} from '../server/syncRelay.js';

// Vercel Function: POST /api/sync (timer page) and GET /api/sync?room=<id> (overlays).
//
// For dependable live sync, connect an Upstash Redis database to the Vercel
// project (Vercel dashboard -> Storage -> Upstash Redis), which provides either
// KV_REST_API_URL / KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
// Without it the state is kept in this function instance's memory: that works
// while one warm instance serves the site, but it is lost on cold starts and
// redeploys and isn't shared between instances. The X-Sync-Store response
// header says which one is in use.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const storeName = url && token ? 'redis' : 'memory';
const store = url && token ? createUpstashStore(url, token) : createMemoryStore();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Sync-Store', storeName);

  let body;
  try {
    body = req.body;
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  try {
    const { status, json } = await handleSyncRequest(
      { method: req.method, room: req.query.room, key: req.headers[SYNC_KEY_HEADER], body },
      store
    );
    res.status(status).json(json);
  } catch (err) {
    console.error('Sync relay error:', err);
    res.status(502).json({ error: 'Sync storage unavailable' });
  }
}
