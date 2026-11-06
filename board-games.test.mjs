import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameTables, actOnTable, snapshotTables, initialXiangqi, xiangqiPseudoLegal, xiangqiInCheck, xiangqiLegalMoves, setTablePresence, expireTableSeats } from './board-games.mjs';
import { createRoomServer } from './server.mjs';

const A = { identity: 'a', name: 'An' }, B = { identity: 'b', name: 'Bình' }, C = { identity: 'c', name: 'Chi' };
function game(id) {
  const tables = createGameTables(), table = tables.find(t => t.id === id);
  const act = (actor, action, rest = {}) => actOnTable(tables, actor, { tableId: id, action, version: table.version, ...rest });
  act(A, 'join'); act(B, 'join'); return { tables, table, act };
}
test('three tables: two real identities, one table each, turns, spectator and stale-move checks', () => {
  const tables = createGameTables(); assert.equal(tables.length, 3);
  actOnTable(tables, A, { tableId: 'caro', action: 'join' });
  assert.throws(() => actOnTable(tables, A, { tableId: 'caro', action: 'move', to: 0 }), /đủ 2 người/);
  assert.throws(() => actOnTable(tables, A, { tableId: 'chess', action: 'join' }), /rời bàn/);
  actOnTable(tables, A, { tableId: 'caro', action: 'join' }); // Same identity never takes the other seat.
  assert.equal(tables[2].seats.filter(Boolean).length, 1);
  actOnTable(tables, B, { tableId: 'caro', action: 'join' });
  assert.throws(() => actOnTable(tables, C, { tableId: 'caro', action: 'join' }), /đủ 2 người/);
  assert.throws(() => actOnTable(tables, C, { tableId: 'caro', action: 'move', to: 0 }), /đang xem/);
  const version = tables[2].version;
  assert.throws(() => actOnTable(tables, B, { tableId: 'caro', action: 'move', to: 0, version }), /Chưa đến lượt/);
  assert.throws(() => actOnTable(tables, A, { tableId: 'caro', action: 'move', to: 0, version: version - 1 }), /cập nhật/);
});
test('caro: occupied square, five-in-a-row win, two-party rematch and leaving', () => {
  const { tables, table, act } = game('caro');
  act(A, 'move', { to: 0 });
  assert.throws(() => act(B, 'move', { to: 0 }), /đã có quân/);
  for (let i = 0; i < 4; i++) { act(B, 'move', { to: 15 + i }); act(A, 'move', { to: 1 + i }); }
  assert.equal(table.status, 'finished'); assert.equal(table.result.winner, 'X'); assert.equal(table.winningCells.length, 5);
  assert.throws(() => act(B, 'move', { to: 50 }), /ván đang diễn ra/);
  act(A, 'rematch'); assert.equal(table.status, 'finished');
  act(B, 'rematch'); assert.equal(table.status, 'playing'); assert.equal(table.seats[0].identity, B.identity);
  assert.ok(table.position.board.every(p => p === null));
  act(B, 'leave'); assert.equal(table.result.winner, 'O');
  act(A, 'leave'); assert.equal(table.status, 'waiting'); assert.equal(snapshotTables(tables)[2].seats.filter(Boolean).length, 0);
});
test('chess: illegal move rejection and Fool’s Mate', () => {
  const { table, act } = game('chess');
  assert.throws(() => act(A, 'move', { from: 52, to: 20 }), /không hợp lệ/);
  for (const [actor, from, to] of [[A, 53, 45], [B, 12, 28], [A, 54, 38], [B, 3, 39]]) act(actor, 'move', { from, to });
  assert.equal(table.status, 'finished'); assert.equal(table.result.winner, 'b');
});
test('caro recognizes vertical and both diagonal winning lines', () => {
  for (const cells of [[0, 15, 30, 45, 60], [0, 16, 32, 48, 64], [4, 18, 32, 46, 60]]) {
    const { table, act } = game('caro');
    for (let i = 0; i < 5; i++) { act(A, 'move', { to: cells[i] }); if (i < 4) act(B, 'move', { to: 100 + i }); }
    assert.equal(table.result.winner, 'X'); assert.deepEqual([...table.winningCells].sort((a, b) => a - b), [...cells].sort((a, b) => a - b));
  }
});
test('chess: castling, en passant, underpromotion and king safety', () => {
  const castle = game('chess'); castle.table.position.engine.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  castle.act(A, 'move', { from: 60, to: 62 });
  assert.equal(castle.table.position.engine.get('f1').type, 'r'); assert.equal(castle.table.position.engine.get('g1').type, 'k');
  const ep = game('chess');
  for (const [actor, from, to] of [[A, 52, 36], [B, 8, 16], [A, 36, 28], [B, 11, 27], [A, 28, 19]]) ep.act(actor, 'move', { from, to });
  assert.equal(ep.table.position.engine.get('d5'), undefined); assert.equal(ep.table.position.engine.get('d6').color, 'w');
  const promote = game('chess'); promote.table.position.engine.load('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  promote.act(A, 'move', { from: 8, to: 0, promotion: 'n' }); assert.equal(promote.table.position.engine.get('a8').type, 'n');
  const pin = game('chess'); pin.table.position.engine.load('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.throws(() => pin.act(A, 'move', { from: 52, to: 48 }), /không hợp lệ/);
});
test('xiangqi: horse leg, elephant eye and river, cannon screen, soldier direction', () => {
  const board = initialXiangqi();
  assert.equal(xiangqiPseudoLegal(board, 82, 65), true); board[73] = 'rp'; assert.equal(xiangqiPseudoLegal(board, 82, 65), false);
  const elephant = initialXiangqi(); assert.equal(xiangqiPseudoLegal(elephant, 83, 67), true);
  elephant[75] = 'rp'; assert.equal(xiangqiPseudoLegal(elephant, 83, 67), false);
  elephant[47] = 're'; assert.equal(xiangqiPseudoLegal(elephant, 47, 31), false);
  const cannon = initialXiangqi(); assert.equal(xiangqiPseudoLegal(cannon, 64, 1), true);
  cannon[46] = 'bp'; assert.equal(xiangqiPseudoLegal(cannon, 64, 1), false);
  const soldier = initialXiangqi(); assert.equal(xiangqiPseudoLegal(soldier, 54, 45), true); assert.equal(xiangqiPseudoLegal(soldier, 54, 55), false);
  soldier[36] = 'rp'; assert.equal(xiangqiPseudoLegal(soldier, 36, 37), true); assert.equal(xiangqiPseudoLegal(soldier, 36, 45), false);
});
test('xiangqi: flying generals forbidden and checkmate is detected', () => {
  const board = Array(90).fill(null); board[4] = 'bk'; board[85] = 'rk'; board[40] = 'rr';
  assert.equal(xiangqiInCheck(board, 'r'), false);
  assert.equal(xiangqiLegalMoves(board, 'r').some(m => m.from === 40 && m.to === 41), false);
  const { table, act } = game('xiangqi');
  table.position.board = Array(90).fill(null); table.position.board[4] = 'bk'; table.position.board[85] = 'rk';
  for (const index of [12, 14, 22]) table.position.board[index] = 'rr';
  act(A, 'move', { from: 22, to: 13 }); assert.equal(table.status, 'finished'); assert.equal(table.result.winner, 'r');
});
test('disconnect grace period: reconnect preserves game; 30 seconds releases seat and forfeits', () => {
  const { tables, table, act } = game('caro'); act(A, 'move', { to: 100 });
  setTablePresence(tables, A, false, 1000); assert.equal(expireTableSeats(tables, 30999), false);
  setTablePresence(tables, A, true, 30000); assert.equal(expireTableSeats(tables, 50000), false); assert.equal(table.position.board[100], 'X');
  setTablePresence(tables, A, false, 60000); assert.equal(expireTableSeats(tables, 90000), true);
  assert.equal(table.seats[0], null); assert.equal(table.status, 'finished'); assert.equal(table.result.winner, 'O');
});

test('HTTP/SSE: two clients see same table and board, spectator cannot move, yard positions stay synchronized', async t => {
  let time = Date.now(); const server = createRoomServer({ now: () => time }); t.after(() => server.closeRoom());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  async function post(route, body, session) {
    time += 200;
    const res = await fetch(`${base}/api/${route}${session ? '?id=' + session.id : ''}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.token } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }
  async function connect(name) {
    const joined = await post('join', { protocol: 2, name }); const controller = new AbortController(); t.after(() => controller.abort());
    const res = await fetch(`${base}/api/events?id=${joined.data.id}&token=${joined.data.token}`, { signal: controller.signal });
    const reader = res.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    return { session: joined.data, async next(type, predicate) {
      const timer = setTimeout(() => controller.abort(), 4000);
      try { while (true) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary < 0) { const { value, done } = await reader.read(); if (done) throw new Error('stream ended'); buffer += decoder.decode(value); continue; }
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        if (frame.startsWith('event: ' + type + '\n')) { const value = JSON.parse(frame.slice(frame.indexOf('data: ') + 6)); if (predicate(value)) return value; }
      }} finally { clearTimeout(timer); }
    }};
  }
  const one = await connect('An'), two = await connect('Bình'), viewer = await connect('Chi');
  assert.equal((await post('table', { tableId: 'chess', action: 'join' }, one.session)).status, 200);
  const started = await post('table', { tableId: 'chess', action: 'join' }, two.session);
  assert.equal(started.data.tables[1].status, 'playing');
  assert.equal((await post('table', { tableId: 'chess', action: 'join' }, viewer.session)).status, 409);
  assert.equal((await post('table', { tableId: 'chess', action: 'move', from: 52, to: 36, version: started.data.tables[1].version }, one.session)).status, 200);
  const update = await two.next('tables', data => data[1].board[36] === 'wp'); assert.equal(update[1].board[52], null);
  assert.equal((await post('table', { tableId: 'chess', action: 'move', from: 12, to: 28, version: update[1].version }, viewer.session)).status, 403);
  assert.equal((await post('state', { name: 'An', x: 0, z: 29.6, state: 'sit' }, one.session)).status, 200);
  const presence = await two.next('players', data => data.some(p => p.id === one.session.id && p.z === 29.6));
  assert.equal(presence.find(p => p.id === one.session.id).state, 'sit');
  assert.equal((await fetch(base + '/board-ui.js')).status, 200);
});
