import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createMeritAccount } from './merit-guard.mjs';
import { createRoomServer } from './server.mjs';
import { getTopMerit } from './room.js';
import { earnedMerit, milestoneTier, canUseRitual } from './milestones.js';

test('milestones: exact thresholds, cumulative unlocks and retained earned rewards', () => {
  for (const [merit, tier] of [[0, 0], [999, 0], [1000, 1], [1999, 1], [2000, 2], [2999, 2], [3000, 3], [3999, 3], [4000, 4], [9000, 4]]) {
    assert.equal(milestoneTier(merit), tier);
  }
  assert.equal(earnedMerit(100, 4000), 4000);
  assert.equal(earnedMerit(NaN, -100), 0);
  assert.equal(earnedMerit(1000.9), 1000);
  assert.equal(canUseRitual('lantern', 2999), false);
  assert.equal(canUseRitual('lantern', 3000), true);
  assert.equal(canUseRitual('lamp', 3999), false);
  assert.equal(canUseRitual('lamp', 4000), true);
  assert.equal(canUseRitual('unknown', 9000), false);
});

test('merit leaderboard: top five, stable ties, empty room and no snapshot mutation', () => {
  const players = [
    { id: 'g', merit: 3 }, { id: 'b', merit: 100 }, { id: 'e', merit: 10 },
    { id: 'a', merit: 100 }, { id: 'c', merit: 70 }, { id: 'f', merit: 5 }, { id: 'd', merit: 20 },
  ];
  const before = structuredClone(players);
  assert.deepEqual(getTopMerit(players).map(p => p.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(players, before);
  assert.deepEqual(getTopMerit([]), []);
  assert.equal(getTopMerit(players.filter(p => p.id !== 'b'))[1].id, 'c');
  assert.deepEqual(getTopMerit([{ id: 'old-client' }]), [{ id: 'old-client' }]);
});

test('shared room: presence, state, chat, reconnect, validation and public assets', async t => {
  const accounts = new Map();
  const server = createRoomServer({ accounts });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.closeRoom());
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(route, data, session, cookie) {
    return fetch(`${base}/api/${route}${session ? '?id=' + session.id : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: JSON.stringify(data),
    });
  }
  async function join(name, score = 0) {
    // Trusted fixture: existing verified points are seeded in the server ledger, never by the client.
    const identity = randomBytes(24).toString('hex');
    const account = createMeritAccount(Date.now()); account.merit = score; account.rewardMerit = score; accounts.set(identity, account);
    const res = await post('join', { name, protocol: 2 }, null, 'chuaha_identity=' + identity);
    assert.equal(res.status, 201);
    return res.json();
  }
  async function stream(session) {
    const controller = new AbortController();
    t.after(() => controller.abort());
    const response = await fetch(`${base}/api/events?id=${session.id}&token=${session.token}`, { signal: controller.signal });
    assert.equal(response.status, 200);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '';
    return {
      close: () => controller.abort(),
      async next(type, predicate = () => true) {
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          while (true) {
            const boundary = buffer.indexOf('\n\n');
            if (boundary >= 0) {
              const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              if (frame.startsWith(`event: ${type}\n`)) {
                const data = JSON.parse(frame.slice(frame.indexOf('data: ') + 6));
                if (predicate(data)) return data;
              }
            } else {
              const { done, value } = await reader.read();
              if (done) throw new Error('Stream ended unexpectedly');
              buffer += decoder.decode(value, { stream: true });
            }
          }
        } finally { clearTimeout(timeout); }
      },
    };
  }
  const alice = await join('An Nhiên', 87), bob = await join('Tâm Duyên');
  const a = await stream(alice);
  assert.equal((await a.next('welcome')).players.length, 1);
  const b = await stream(bob);
  assert.equal((await b.next('welcome')).players.length, 2);
  assert.equal((await a.next('players', p => p.length === 2)).length, 2);

  const changed = { name: 'An Mới', merit: 87, robe: 0xf0a6b4, hair: 'bui', x: 4, z: -2, yaw: 1.2, state: 'sit', meditating: true, bowQueue: 3, bowT: 0.4 };
  assert.equal((await post('state', changed, alice)).status, 200);
  const snapshot = await b.next('players', p => p.some(person => person.name === 'An Mới'));
  const remote = snapshot.find(p => p.id === alice.id);
  for (const [key, value] of Object.entries(changed)) assert.equal(remote[key], value);
  assert.equal('token' in remote, false);
  assert.equal(getTopMerit(snapshot)[0].id, alice.id);

  assert.equal((await post('chat', { text: 'Xin chào 🙏 <script>test</script>' }, alice)).status, 200);
  const chat = await b.next('chat', msg => !msg.system);
  assert.equal(chat.text, 'Xin chào 🙏 <script>test</script>');
  assert.equal(chat.name, 'An Mới');
  assert.equal(chat.playerId, alice.id);
  assert.equal((await a.next('chat', msg => !msg.system)).id, chat.id);
  assert.equal((await post('chat', { text: 'spam' }, alice)).status, 429);
  assert.equal((await post('chat', { text: '   ' }, bob)).status, 400);
  assert.equal((await post('chat', { text: 'forged' }, { ...alice, token: bob.token })).status, 401);

  b.close();
  const remaining = await a.next('players', p => p.length === 1);
  assert.deepEqual(getTopMerit(remaining).map(p => p.id), [alice.id]);
  const reconnected = await stream(bob);
  const welcome = await reconnected.next('welcome');
  assert.equal(welcome.players.length, 2);
  assert.ok(welcome.history.some(msg => msg.id === chat.id));
  assert.equal(welcome.players.filter(p => p.id === bob.id).length, 1);

  assert.equal((await post('state', { merit: -10, x: 99999, z: -99999, name: 'n'.repeat(100), robe: 'red', hair: '<bad>', state: 'bad' }, bob)).status, 200);
  const sanitized = (await a.next('players', p => p.some(person => person.x === 13.2))).find(p => p.id === bob.id);
  assert.equal(sanitized.z, -13.6);
  assert.equal(sanitized.name.length, 18);
  assert.equal(sanitized.state, 'stand');
  assert.equal(sanitized.hair, 'ngan');
  assert.equal(sanitized.merit, 0);

  assert.equal((await post('ritual', { type: 'lamp' }, bob)).status, 403);
  const gold = await join('Sen Vàng', 4000);
  const g = await stream(gold); await g.next('welcome');
  assert.equal((await post('state', { name: 'Sen Vàng', robe: 0xffd15c, greeting: true }, gold)).status, 200);
  const rewarded = (await a.next('players', p => p.some(person => person.greeting))).find(p => p.id === gold.id);
  assert.equal(rewarded.robe, 0xffd15c);
  assert.equal(rewarded.rewardMerit, 4000);
  assert.equal(rewarded.greeting, true);
  assert.equal((await post('ritual', { type: 'lamp', wish: 'Bình an' }, gold)).status, 200);
  const ritual = await a.next('ritual');
  assert.equal(ritual.type, 'lamp');
  assert.equal(ritual.name, 'Sen Vàng');
  assert.equal((await post('ritual', { type: 'lantern' }, gold)).status, 429);
  assert.equal((await post('ritual', { type: 'unknown' }, gold)).status, 403);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await post('state', { merit: 10, robe: 0xffd15c }, gold)).status, 200);
  const retained = (await a.next('players', p => p.some(person => person.id === gold.id && !person.greeting))).find(p => p.id === gold.id);
  assert.equal(retained.merit, 4000); // A lower client value cannot replace server points either.
  assert.equal(retained.rewardMerit, 4000);
  assert.equal(retained.robe, 0xffd15c);
  const observer = await stream(await join('Người mới'));
  assert.ok((await observer.next('welcome')).rituals.some(item => item.id === ritual.id));

  assert.equal((await fetch(`${base}/api/join`, { method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/api/join`, { method: 'POST', body: '[]' })).status, 400);
  assert.equal((await post('join', { name: 'a'.repeat(5000) })).status, 400);
  for (const asset of ['/', '/game.js', '/room.js', '/milestones.js', '/work-fortunes.js', '/style.css', '/lib/three.module.js']) {
    assert.equal((await fetch(base + asset)).status, 200);
  }
  for (const secret of ['/.git/config', '/server.mjs', '/package.json', '/lib/../server.mjs', '/.data/merit-ledger.json', '/merit-guard.mjs', '/merit-ledger.mjs']) {
    assert.equal((await fetch(base + secret)).status, 404);
  }
});
