import http from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const ROBES = [0x5d7fb0, 0x8a5a3a, 0x8d8d92, 0xf0a6b4, 0xb9a3dc, 0xeee4d0, 0xe0a13e];
const HAIRS = ['troc', 'ngan', 'bui', 'bac'];
const cleanText = (value, max) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const number = (value, min, max, fallback) => Number.isFinite(value)
  ? Math.max(min, Math.min(max, value)) : fallback;

function sanitize(input = {}) {
  return {
    name: cleanText(input.name, 18) || 'Phật tử',
    robe: ROBES.includes(input.robe) ? input.robe : ROBES[0],
    hair: HAIRS.includes(input.hair) ? input.hair : 'ngan',
    level: Math.floor(number(input.level, 1, 999, 1)),
    merit: Math.floor(number(input.merit, 0, 1_000_000_000, 0)),
    x: number(input.x, -13.2, 13.2, 0), z: number(input.z, -13.6, 15.2, 13.5),
    yaw: number(input.yaw, -Math.PI * 2, Math.PI * 2, Math.PI),
    state: ['stand', 'walk', 'sit'].includes(input.state) ? input.state : 'stand',
    meditating: input.meditating === true,
    bowQueue: Math.floor(number(input.bowQueue, 0, 3, 0)),
    bowT: number(input.bowT, 0, 1, 0),
  };
}

export function createRoomServer() {
  const sessions = new Map();
  const history = [];
  let dirty = false;
  const players = () => [...sessions.values()].filter(s => s.stream).map(s => ({ id: s.id, ...s.player }));
  function send(session, type, data) {
    if (!session.stream) return;
    // Drop slow connections instead of buffering unbounded snapshots.
    if (session.stream.writableLength > 256 * 1024) { session.stream.destroy(); return; }
    session.stream.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  function broadcast(type, data) { for (const session of sessions.values()) send(session, type, data); }
  function message(data) {
    const entry = { id: randomUUID(), time: Date.now(), ...data };
    history.push(entry);
    if (history.length > 50) history.shift();
    broadcast('chat', entry);
  }
  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) throw new Error('Dữ liệu quá dài.');
      chunks.push(chunk);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu không hợp lệ.');
    return value;
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Khác nguồn truy cập.' });
        if (req.method === 'POST' && url.pathname === '/api/join') {
          if (sessions.size >= 200) return json(res, 503, { error: 'Chùa đang đông, vui lòng thử lại sau.' });
          const input = await body(req);
          const session = {
            id: randomUUID(), token: randomBytes(24).toString('hex'), player: sanitize(input),
            stream: null, touched: Date.now(), lastChat: 0, lastState: 0,
          };
          sessions.set(session.id, session);
          return json(res, 201, { id: session.id, token: session.token });
        }
        const id = url.searchParams.get('id');
        const session = sessions.get(id);
        const token = req.headers.authorization?.replace(/^Bearer /, '') || url.searchParams.get('token');
        if (!session || session.token !== token) return json(res, 401, { error: 'Phiên kết nối đã hết hạn.' });
        if (req.method === 'GET' && url.pathname === '/api/events') {
          session.stream?.end();
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive', 'X-Accel-Buffering': 'no',
          });
          res.write(': connected\n\n');
          session.stream = res;
          send(session, 'welcome', { players: players(), history });
          message({ system: true, text: `🙏 ${session.player.name} vừa vào chùa` });
          dirty = true;
          res.on('close', () => {
            if (session.stream !== res) return;
            session.stream = null; session.touched = Date.now(); dirty = true;
            message({ system: true, text: `${session.player.name} đã rời chùa` });
          });
          return;
        }
        if (req.method !== 'POST') return json(res, 405, { error: 'Phương thức không hỗ trợ.' });
        const input = await body(req);
        session.touched = Date.now();
        if (url.pathname === '/api/state') {
          if (Date.now() - session.lastState < 45) return json(res, 429, { error: 'Cập nhật quá nhanh.' });
          session.lastState = Date.now();
          session.player = sanitize(input); dirty = true;
          return json(res, 200, { ok: true });
        }
        if (url.pathname === '/api/chat') {
          const text = cleanText(input.text, 240);
          if (!session.stream) return json(res, 409, { error: 'Đang kết nối lại phòng chung.' });
          if (!text) return json(res, 400, { error: 'Nhập lời nhắn trước khi gửi.' });
          if (Date.now() - session.lastChat < 1000) return json(res, 429, { error: 'Chờ một giây rồi gửi tiếp nhé.' });
          session.lastChat = Date.now();
          message({ playerId: session.id, name: session.player.name, text });
          return json(res, 200, { ok: true });
        }
        return json(res, 404, { error: 'Không tìm thấy.' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      // Only public assets are served; never expose source, Git metadata, or dotfiles.
      if (!['index.html', 'style.css', 'game.js', 'room.js', 'lib/three.module.js', 'lib/RoomEnvironment.js'].includes(filename)) {
        res.writeHead(404); return res.end('Not found');
      }
      const data = await readFile(path.join(ROOT, filename));
      res.writeHead(200, { 'Content-Type': `${TYPES[path.extname(filename)]}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: 'Yêu cầu không hợp lệ.' });
      else res.end();
    }
  });
  const tick = setInterval(() => {
    if (dirty) { dirty = false; broadcast('players', players()); }
  }, 100);
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      if (session.stream) {
        if (session.stream.writableLength > 256 * 1024) session.stream.destroy();
        else session.stream.write(': heartbeat\n\n');
      } else if (now - session.touched > 45000) sessions.delete(session.id);
    }
  }, 15000);
  server.on('close', () => { clearInterval(tick); clearInterval(heartbeat); });
  server.closeRoom = () => {
    for (const session of sessions.values()) session.stream?.end();
    server.close();
  };
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createRoomServer();
  const port = Number(process.env.PORT || 8000);
  server.listen(port, '0.0.0.0', () => console.log(`Chùa Hà Online: http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.closeRoom());
}
