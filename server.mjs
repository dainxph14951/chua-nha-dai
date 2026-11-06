import http from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { earnedMerit, canUseRitual, MILESTONES } from './milestones.js';
import { createMeritAccount, meritStatus, performMeritAction, lockMerit } from './merit-guard.mjs';
import { openMeritLedger } from './merit-ledger.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const ROBES = [0x5d7fb0, 0x8a5a3a, 0x8d8d92, 0xf0a6b4, 0xb9a3dc, 0xeee4d0, 0xe0a13e];
const HAIRS = ['troc', 'ngan', 'bui', 'bac'];
const cleanText = (value, max) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const number = (value, min, max, fallback) => Number.isFinite(value)
  ? Math.max(min, Math.min(max, value)) : fallback;

function sanitize(input = {}) {
  const merit = Math.floor(number(input.merit, 0, 1_000_000_000, 0));
  const rewardMerit = earnedMerit(merit, input.rewardMerit);
  const rewardRobe = MILESTONES.find(m => m.robe !== undefined && m.robe === input.robe && rewardMerit >= m.merit);
  return {
    name: cleanText(input.name, 18) || 'Phật tử',
    robe: ROBES.includes(input.robe) || rewardRobe ? input.robe : ROBES[0],
    hair: HAIRS.includes(input.hair) ? input.hair : 'ngan',
    level: Math.floor(number(input.level, 1, 999, 1)),
    merit, rewardMerit,
    greeting: input.greeting === true && rewardMerit >= 2000,
    x: number(input.x, -13.2, 13.2, 0), z: number(input.z, -13.6, 15.2, 13.5),
    yaw: number(input.yaw, -Math.PI * 2, Math.PI * 2, Math.PI),
    state: ['stand', 'walk', 'sit'].includes(input.state) ? input.state : 'stand',
    meditating: input.meditating === true,
    bowQueue: Math.floor(number(input.bowQueue, 0, 3, 0)),
    bowT: number(input.bowT, 0, 1, 0),
  };
}

export function createRoomServer({ accounts = new Map(), persist = async () => {}, now = () => Date.now() } = {}) {
  const sessions = new Map();
  const history = [];
  const rituals = [];
  let dirty = false;
  const verified = account => ({ merit: account.merit, rewardMerit: account.rewardMerit, level: Math.floor(Math.sqrt(account.merit / 12)) + 1 });
  const players = () => [...sessions.values()].filter(s => s.stream).map(s => ({ id: s.id,
    ...sanitize({ ...s.player, ...verified(s.account) }), meritBlocked: s.account.blocked, meritIdentity: s.account.publicId }));
  function updateMerit(account) {
    dirty = true;
    for (const session of sessions.values()) if (session.account === account) send(session, 'merit', meritStatus(account, now()));
  }
  function forgedPoints(input, account) {
    return (typeof input.merit === 'number' && input.merit > account.merit)
      || (typeof input.rewardMerit === 'number' && input.rewardMerit > account.rewardMerit);
  }
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
          if (input.protocol !== 2) return json(res, 426, { error: 'Đã có bản chống gian lận mới. Hãy tải lại trang để vào chùa.' });
          if (sessions.size >= 200) return json(res, 503, { error: 'Chùa đang đông, vui lòng thử lại sau.' });
          const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('chuaha_identity='))?.slice('chuaha_identity='.length);
          const accountId = cookie && accounts.has(cookie) ? cookie : randomBytes(24).toString('hex');
          if (!accounts.has(accountId)) accounts.set(accountId, createMeritAccount(now()));
          const account = accounts.get(accountId);
          account.publicId ??= randomUUID(); // Public ranking key is separate from the private identity cookie.
          if (forgedPoints(input, account)) lockMerit(account, 'Gửi số công đức tự sửa khi vào phòng.');
          await persist();
          const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
          res.setHeader('Set-Cookie', `chuaha_identity=${accountId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure ? '; Secure' : ''}`);
          const session = {
            id: randomUUID(), token: randomBytes(24).toString('hex'), account,
            player: sanitize({ ...input, ...verified(account) }),
            stream: null, touched: Date.now(), lastChat: 0, lastState: 0, lastRitual: 0,
          };
          sessions.set(session.id, session);
          return json(res, 201, { id: session.id, token: session.token, account: meritStatus(account, now()) });
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
          send(session, 'welcome', { players: players(), history, rituals, account: meritStatus(session.account, now()) });
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
          if (forgedPoints(input, session.account)) {
            const result = lockMerit(session.account, 'Tự sửa tổng công đức gửi lên máy chủ.');
            await persist(); updateMerit(session.account);
            return json(res, result.status, { ...result, account: meritStatus(session.account, now()) });
          }
          session.player = sanitize({ ...input, ...verified(session.account) }); dirty = true;
          return json(res, 200, { ok: true });
        }
        if (url.pathname === '/api/merit') {
          if (!session.stream) return json(res, 409, { error: 'Chờ kết nối phòng chung trước khi tích công đức.' });
          const result = Object.hasOwn(input, 'amount') || forgedPoints(input, session.account)
            ? lockMerit(session.account, 'Gửi yêu cầu tự cộng số điểm không hợp lệ.')
            : performMeritAction(session.account, input.action, now());
          await persist(); updateMerit(session.account);
          return json(res, result.status, { ...result, account: meritStatus(session.account, now()) });
        }
        if (url.pathname === '/api/ritual') {
          if (!session.stream) return json(res, 409, { error: 'Hãy kết nối phòng chung trước.' });
          if (session.account.blocked || !canUseRitual(input.type, session.account.rewardMerit)) return json(res, 403, { error: 'Bạn chưa mở khóa nghi thức này.' });
          if (Date.now() - session.lastRitual < 10000) return json(res, 429, { error: 'Chờ 10 giây giữa hai nghi thức nhé.' });
          session.lastRitual = Date.now();
          const ritual = { id: randomUUID(), type: input.type, name: session.player.name, wish: cleanText(input.wish, 120), time: Date.now() };
          rituals.push(ritual);
          if (rituals.length > 20) rituals.shift();
          broadcast('ritual', ritual);
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
      if (!['index.html', 'style.css', 'game.js', 'room.js', 'milestones.js', 'work-fortunes.js', 'lib/three.module.js', 'lib/RoomEnvironment.js'].includes(filename)) {
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
  const ledger = await openMeritLedger(process.env.MERIT_DATA_FILE || path.join(ROOT, '.data/merit-ledger.json'));
  const server = createRoomServer(ledger);
  const port = Number(process.env.PORT || 8000);
  server.listen(port, '0.0.0.0', () => console.log(`Chùa Hà Online: http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.closeRoom());
}
