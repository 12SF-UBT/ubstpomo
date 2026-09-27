import { createHash } from 'node:crypto';

// Live timer relay shared by the Vercel function (api/sync.js) and the Vite
// dev/preview server. The timer page POSTs its latest state with its secret
// sync key (X-Sync-Key header); the state is filed under a room id derived from
// that key, and overlays in OBS / Camo poll the room with GET ?room=<id>. The
// room id is in the overlay URL, but it only lets you read the timer, so nobody
// who sees an overlay link can put their own text on it.

export const SYNC_KEY_HEADER = 'x-sync-key';
export const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
export const ROOM_PATTERN = /^[a-f0-9]{32}$/;
export const MAX_BODY_BYTES = 16 * 1024;
export const STATE_TTL_SECONDS = 24 * 60 * 60;

export const roomForKey = (key) =>
  createHash('sha256').update(`ubst-pomo-room:${key}`).digest('hex').slice(0, 32);

export async function handleSyncRequest({ method, room, key, body }, store) {
  if (method === 'GET') {
    if (typeof room !== 'string' || !ROOM_PATTERN.test(room)) {
      return { status: 400, json: { error: 'Missing or invalid room' } };
    }

    const saved = await store.get(room);
    try {
      return { status: 200, json: saved ? JSON.parse(saved) : {} };
    } catch (err) {
      return { status: 200, json: {} };
    }
  }

  if (method === 'POST') {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      return { status: 400, json: { error: 'Missing or invalid sync key' } };
    }

    const text = typeof body === 'string' ? body : JSON.stringify(body ?? null);
    if (text.length > MAX_BODY_BYTES) {
      return { status: 413, json: { error: 'State too large' } };
    }

    let state;
    try {
      state = JSON.parse(text);
    } catch (err) {
      return { status: 400, json: { error: 'Invalid JSON' } };
    }
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return { status: 400, json: { error: 'State must be a JSON object' } };
    }

    const ownRoom = roomForKey(key);
    await store.set(ownRoom, text);
    return { status: 200, json: { ok: true, room: ownRoom } };
  }

  return { status: 405, json: { error: 'Method not allowed' } };
}

// In-process store. Entries expire like the Redis ones, and the least recently
// written rooms are dropped past `maxRooms` so memory stays bounded.
export function createMemoryStore({ ttlMs = STATE_TTL_SECONDS * 1000, maxRooms = 1000 } = {}) {
  const rooms = new Map();

  return {
    get: async (room) => {
      const entry = rooms.get(room);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        rooms.delete(room);
        return null;
      }
      return entry.value;
    },
    set: async (room, value) => {
      rooms.delete(room);
      rooms.set(room, { value, expiresAt: Date.now() + ttlMs });
      if (rooms.size > maxRooms) {
        rooms.delete(rooms.keys().next().value);
      }
    },
  };
}

// Upstash Redis over its REST API (no SDK needed)
export function createUpstashStore(url, token) {
  const command = async (args) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(`Upstash ${args[0]} failed: ${data.error || res.status}`);
    }
    return data.result;
  };

  const key = (room) => `pomo:room:${room}`;

  return {
    get: (room) => command(['GET', key(room)]),
    set: (room, value) => command(['SET', key(room), value, 'EX', STATE_TTL_SECONDS]),
  };
}
