import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGameTables, snapshotTables, setTablePresence } from './board-games.mjs';
import { actOnStakedTable, cancelBlockedBets, expireStakedSeats, recoverBoardEscrows } from './board-stakes.mjs';
import { createMeritAccount, lockMerit, performMeritAction } from './merit-guard.mjs';
import { openMeritLedger } from './merit-ledger.mjs';

const A = { identity: 'a', name: 'An' }, B = { identity: 'b', name: 'Bình' };
function fixture(id = 'caro', pointsA = 100, pointsB = 100) {
  const tables = createGameTables(), accounts = new Map();
  for (const [actor, points] of [[A, pointsA], [B, pointsB]]) {
    const account = createMeritAccount(100000); account.publicId = actor.identity; account.merit = points; account.rewardMerit = points; accounts.set(actor.identity, account);
  }
  const table = tables.find(t => t.id === id);
  const act = (actor, action, data = {}) => actOnStakedTable(tables, accounts, actor, { tableId: id, action, version: table.version, ...data });
  const join = stake => { act(A, 'join', { stake }); act(B, 'join', { stake }); };
  return { tables, table, accounts, act, join, a: accounts.get('a'), b: accounts.get('b') };
}
test('stake requires matching consent and sufficient funds; waiting proposals do not debit anyone', () => {
  const f = fixture('caro', 50, 20);
  f.act(A, 'join', { stake: 50 });
  assert.equal(f.a.merit, 50); assert.equal(f.a.boardEscrow, undefined);
  assert.throws(() => f.act(B, 'join', { stake: 10 }), /đồng ý đúng mức/);
  assert.throws(() => f.act(B, 'join', { stake: 50 }), /không đủ/);
  assert.equal(f.table.seats.filter(Boolean).length, 1);
  f.act(A, 'stake', { stake: 20 });
  assert.throws(() => f.act(B, 'join', { stake: 50 }), /đồng ý đúng mức/);
  f.act(B, 'join', { stake: 20 });
  assert.equal(f.a.merit, 30); assert.equal(f.b.merit, 0);
  assert.equal(f.table.bet.amount, 20); assert.equal(snapshotTables(f.tables)[2].bet.pot, 40);
  assert.throws(() => f.act(A, 'stake', { stake: 0 }), /đang chờ/);
});
test('invalid, negative and over-limit wagers cannot reserve points', () => {
  for (const stake of [-1, 0.1, 1001, '50', NaN, Infinity]) {
    const f = fixture(); assert.throws(() => f.act(A, 'join', { stake }), /số nguyên/);
    assert.equal(f.a.merit, 100); assert.equal(f.table.seats.filter(Boolean).length, 0);
  }
  const f = fixture(); f.a.blocked = true;
  assert.throws(() => f.act(A, 'join', { stake: 10 }), /tạm khóa/);
  f.join(0); f.act(B, 'resign'); assert.equal(f.a.merit, 100); assert.equal(f.b.merit, 100);
});
test('resignation pays the existing pot exactly once and keeps previous unlocked milestones', () => {
  const f = fixture(); f.join(50);
  assert.equal(f.a.merit, 50); assert.equal(f.b.merit, 50);
  assert.equal(f.a.rewardMerit, 100);
  f.act(B, 'resign');
  assert.equal(f.a.merit, 150); assert.equal(f.b.merit, 50); assert.equal(f.a.merit + f.b.merit, 200);
  assert.equal(f.a.rewardMerit, 150); assert.equal(f.b.rewardMerit, 100);
  assert.equal(f.a.boardEscrow, undefined); assert.equal(f.b.boardEscrow, undefined);
  assert.equal(f.table.bet.settled, true);
  assert.throws(() => f.act(B, 'resign'), /Chưa có ván/);
  assert.equal(recoverBoardEscrows(f.accounts), false); assert.equal(f.a.merit, 150);
});
test('a natural caro win settles the same pot without creating new points', () => {
  const f = fixture(); f.join(25);
  for (let i = 0; i < 5; i++) { f.act(A, 'move', { to: i }); if (i < 4) f.act(B, 'move', { to: 15 + i }); }
  assert.equal(f.table.result.winner, 'X'); assert.equal(f.a.merit, 125); assert.equal(f.b.merit, 75);
});
test('a chess draw returns each stake', () => {
  const f = fixture('chess'); f.join(30);
  f.table.position.engine.load('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  f.act(A, 'move', { from: 60, to: 59 });
  assert.equal(f.table.result.winner, null); assert.equal(f.a.merit, 100); assert.equal(f.b.merit, 100);
  assert.equal(f.table.bet.payouts[0].amount, 30);
});
test('rematch needs both consents and fresh funds; payout follows swapped sides', () => {
  const f = fixture(); f.join(50); f.act(B, 'resign');
  f.act(A, 'rematch', { stake: 50 }); assert.equal(f.a.merit, 150); assert.equal(f.b.merit, 50);
  f.act(B, 'rematch', { stake: 50 }); assert.equal(f.a.merit, 100); assert.equal(f.b.merit, 0);
  assert.equal(f.table.seats[0].identity, B.identity);
  f.act(A, 'resign'); assert.equal(f.a.merit, 100); assert.equal(f.b.merit, 100);
});
test('leave and one-player disconnect forfeit; simultaneous disconnect refunds both', () => {
  const leave = fixture(); leave.join(25); leave.act(A, 'leave');
  assert.equal(leave.a.merit, 75); assert.equal(leave.b.merit, 125);
  const gone = fixture(); gone.join(25); setTablePresence(gone.tables, A, false, 1000);
  expireStakedSeats(gone.tables, gone.accounts, 31000);
  assert.equal(gone.a.merit, 75); assert.equal(gone.b.merit, 125);
  const both = fixture(); both.join(25); setTablePresence(both.tables, A, false, 1000); setTablePresence(both.tables, B, false, 1000);
  expireStakedSeats(both.tables, both.accounts, 31000);
  assert.equal(both.a.merit, 100); assert.equal(both.b.merit, 100);
});
test('a blocked participant cancels the bet and refunds the honest opponent', () => {
  const f = fixture(); f.join(50); lockMerit(f.a, 'test', 100000);
  const changed = cancelBlockedBets(f.tables, f.accounts);
  assert.equal(changed.size, 2); assert.equal(f.table.status, 'finished');
  assert.equal(f.a.merit, 0); assert.equal(f.b.merit, 100); assert.equal(f.a.boardEscrow, undefined);
});
test('legitimate pot winnings are not treated as abnormal activity earnings', () => {
  const f = fixture('caro', 1000, 1000); f.join(1000); f.act(B, 'resign');
  assert.equal(f.a.merit, 2000); assert.deepEqual(f.a.earnings, []);
  assert.equal(performMeritAction(f.a, 'offer', 100000).status, 200); assert.equal(f.a.blocked, false);
});
test('restart recovery refunds unfinished escrow once, while settled payouts are never refunded twice', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'chuaha-stakes-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'ledger.json');
  const f = fixture(); const ledger = await openMeritLedger(filename);
  for (const [key, account] of f.accounts) ledger.accounts.set(key, account);
  f.join(50); await ledger.persist();
  const recovered = await openMeritLedger(filename);
  assert.equal(recovered.accounts.get('a').merit, 100); assert.equal(recovered.accounts.get('b').merit, 100);
  assert.equal(recovered.accounts.get('a').boardEscrow, undefined);
  const repeated = await openMeritLedger(filename); assert.equal(repeated.accounts.get('a').merit, 100);
  const tables = createGameTables();
  const act = (actor, action) => actOnStakedTable(tables, repeated.accounts, actor, { tableId: 'caro', action, stake: 50, version: tables[2].version });
  act(A, 'join'); act(B, 'join'); act(B, 'resign'); await repeated.persist();
  const settled = await openMeritLedger(filename);
  assert.equal(settled.accounts.get('a').merit, 150); assert.equal(settled.accounts.get('b').merit, 50);
});
