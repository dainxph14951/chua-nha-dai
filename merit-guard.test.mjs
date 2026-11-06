import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMeritAccount, performMeritAction, meritStatus } from './merit-guard.mjs';
import { openMeritLedger } from './merit-ledger.mjs';
import { createRoomServer } from './server.mjs';
import { getTopMerit } from './room.js';
import { bowCooldownMs } from './milestones.js';

test('exponential bow delay: exact thousand-point boundaries and five-minute ceiling', () => {
  for (const [merit, ms] of [[0, 6000], [999, 6000], [1000, 12000], [1999, 12000], [2000, 24000],
    [3000, 48000], [4000, 96000], [5000, 192000], [6000, 300000], [1e9, 300000], [NaN, 6000]]) {
    assert.equal(bowCooldownMs(merit), ms);
  }
});

test('bow cooldown is enforced server-side, survives reload and grows when merit crosses a threshold', () => {
  const account = createMeritAccount(100000); account.merit = 999;
  assert.equal(performMeritAction(account, 'bow', 104500).awarded, 3);
  assert.equal(account.merit, 1002);
  assert.equal(meritStatus(account, 104500).bowWaitMs, 12000);
  const restored = JSON.parse(JSON.stringify(account));
  assert.equal(performMeritAction(restored, 'bow', 116499).status, 429);
  assert.equal(performMeritAction(restored, 'bow', 116500).awarded, 3);
  restored.merit = 2000;
  assert.equal(meritStatus(restored, 116500).bowWaitMs, 24000);
  assert.equal(performMeritAction(restored, 'bow', 140499).status, 429);
  assert.equal(performMeritAction(restored, 'bow', 140500).awarded, 3);
  assert.equal(restored.blocked, false);
  assert.equal(meritStatus(createMeritAccount(100000), 100000).bowWaitMs, 0);
});

test('normal activities: measured time, full bead sequence, no false lock for a single fast click', () => {
  const account = createMeritAccount(100000);
  assert.equal(performMeritAction(account, 'offer', 100000).awarded, 5);
  assert.equal(performMeritAction(account, 'offer', 100100).status, 429);
  assert.equal(account.merit, 5);
  assert.equal(account.blocked, false);
  assert.equal(performMeritAction(account, 'offer', 110000).awarded, 5);
  assert.equal(performMeritAction(account, 'bow', 110001).awarded, 3);
  assert.equal(performMeritAction(account, 'chant', 110002).awarded, 1);
  assert.equal(performMeritAction(account, 'meditate', 110003).awarded, 1);
  for (let i = 0; i < 107; i++) assert.equal(performMeritAction(account, 'bead', 111000 + i * 500).awarded, 0);
  assert.equal(account.beads, 107);
  assert.equal(performMeritAction(account, 'bead', 164500).awarded, 20);
  assert.equal(account.beads, 0); assert.equal(account.rounds, 1);
  assert.equal(account.blocked, false);
  assert.equal(account.merit, 35);
});

test('daily prayer and fortune bonuses cannot be reset by rejoining', () => {
  const account = createMeritAccount(100000);
  assert.equal(performMeritAction(account, 'fortune', 100000).status, 403);
  account.merit = 50;
  for (let i = 0; i < 3; i++) assert.equal(performMeritAction(account, 'fortune', 101000 + 1500 * i).awarded, 2);
  assert.equal(performMeritAction(account, 'fortune', 106000).awarded, 0);
  assert.equal(performMeritAction(account, 'pray', 107000).awarded, 5);
  assert.equal(performMeritAction(account, 'pray', 109000).awarded, 0);
});

test('two minutes of fast legitimate play stays below the fraud threshold', () => {
  const account = createMeritAccount(0);
  for (let now = 0; now <= 120000; now += 250) {
    assert.equal(performMeritAction(account, 'bead', now).status, 200);
    if (now % 10000 === 0) assert.equal(performMeritAction(account, 'offer', now).status, 200);
    if (now > 0 && now % 6000 === 0) assert.equal(performMeritAction(account, 'bow', now).status, 200);
    if (now > 0 && now % 4000 === 0) assert.equal(performMeritAction(account, 'chant', now).status, 200);
    if (now > 0 && now % 10000 === 0) assert.equal(performMeritAction(account, 'meditate', now).status, 200);
  }
  assert.equal(account.blocked, false);
  assert.ok(account.merit > 200);
});

test('occasional overlapping bead requests from two tabs do not cause a fraud lock', () => {
  const account = createMeritAccount(0);
  for (let now = 0; now < 10000; now += 500) {
    assert.equal(performMeritAction(account, 'bead', now).status, 200);
    assert.equal(performMeritAction(account, 'bead', now + 10).status, 429);
  }
  assert.equal(account.blocked, false);
});

test('repeated abnormal requests zero points, revoke rewards and permanently lock this identity', () => {
  const account = createMeritAccount(100000); account.merit = 4000; account.rewardMerit = 4000;
  performMeritAction(account, 'offer', 100000);
  for (let i = 0; i < 12; i++) performMeritAction(account, 'offer', 100010 + i);
  assert.equal(account.blocked, true);
  assert.equal(account.merit, 0); assert.equal(account.rewardMerit, 0);
  assert.equal(performMeritAction(account, 'offer', 900000).status, 403);
  assert.equal(meritStatus(account, 900000).blocked, true);
  assert.deepEqual(getTopMerit([{ id: 'blocked', merit: 9999, meritBlocked: true }, { id: 'ok', merit: 5 }]).map(p => p.id), ['ok']);
  assert.equal(getTopMerit([{ id: 'tab-a', meritIdentity: 'same', merit: 10 }, { id: 'tab-b', meritIdentity: 'same', merit: 10 }]).length, 1);
});

test('a burst exceeding the minute budget locks rather than publishing the inflated score', () => {
  const account = createMeritAccount(100000); account.merit = 180;
  account.earnings = [{ time: 100000, points: 180 }];
  assert.equal(performMeritAction(account, 'pray', 100100).status, 403);
  assert.equal(account.merit, 0); assert.equal(account.blocked, true);
});

async function start(t, options = {}) {
  const server = createRoomServer(options);
  t.after(() => server.closeRoom());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    async post(route, data, session, cookie) {
      const response = await fetch(`${base}/api/${route}${session ? '?id=' + session.id : ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}),
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, body: JSON.stringify(data),
      });
      return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    },
    async stream(session) {
      const controller = new AbortController(); t.after(() => controller.abort());
      const response = await fetch(`${base}/api/events?id=${session.id}&token=${session.token}`, { signal: controller.signal });
      assert.equal(response.status, 200);
      return controller;
    },
  };
}

test('server ignores legacy scores, rejects forged state and keeps the lock after rename/rejoin/restart', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'chuaha-merit-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'ledger.json');
  const ledger = await openMeritLedger(filename);
  const app = await start(t, ledger);
  assert.equal((await app.post('join', { name: 'Old', merit: 8619 })).status, 426);
  const joined = await app.post('join', { protocol: 2, name: 'An' });
  assert.equal(joined.data.account.merit, 0);
  assert.match(joined.cookie, /^chuaha_identity=/);
  const session = joined.data; await app.stream(session);
  const earned = await app.post('merit', { action: 'offer' }, session);
  assert.equal(earned.data.account.merit, 5);
  const forged = await app.post('state', { name: 'An', merit: 8619, rewardMerit: 8619 }, session);
  assert.equal(forged.status, 403); assert.equal(forged.data.account.merit, 0);
  assert.equal(forged.data.account.blocked, true);
  const again = await app.post('join', { protocol: 2, name: 'Đổi tên' }, null, joined.cookie);
  assert.equal(again.data.account.blocked, true);
  await app.stream(again.data);
  assert.equal((await app.post('merit', { action: 'pray' }, again.data)).status, 403);
  const restoredApp = await start(t, await openMeritLedger(filename));
  const restored = await restoredApp.post('join', { protocol: 2, name: 'Sau restart' }, null, joined.cookie);
  assert.equal(restored.data.account.blocked, true); assert.equal(restored.data.account.merit, 0);
});

test('same browser tabs share cooldowns; arbitrary client amounts and forged join totals are blocked', async t => {
  const app = await start(t);
  const first = await app.post('join', { protocol: 2, name: 'One' }); await app.stream(first.data);
  const second = await app.post('join', { protocol: 2, name: 'Two' }, null, first.cookie); await app.stream(second.data);
  const results = await Promise.all([app.post('merit', { action: 'offer' }, first.data), app.post('merit', { action: 'offer' }, second.data)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
  assert.ok(results.every(r => r.data.account.merit === 5));
  const forged = await app.post('merit', { action: 'offer', amount: 50000 }, first.data);
  assert.equal(forged.status, 403); assert.equal(forged.data.account.blocked, true);
  const forgedJoin = await app.post('join', { protocol: 2, name: 'Hack', merit: 1000000 });
  assert.equal(forgedJoin.data.account.blocked, true); assert.equal(forgedJoin.data.account.merit, 0);
});
