import { Chess } from 'chess.js';

const DEFINITIONS = [
  { id: 'xiangqi', title: 'Cờ tướng', rows: 10, cols: 9, sides: ['r', 'b'], labels: ['Đỏ', 'Đen'], x: -8 },
  { id: 'chess', title: 'Cờ vua', rows: 8, cols: 8, sides: ['w', 'b'], labels: ['Trắng', 'Đen'], x: 0 },
  { id: 'caro', title: 'Cờ ca-rô', rows: 15, cols: 15, sides: ['X', 'O'], labels: ['X', 'O'], x: 8 },
];
const fail = (message, status = 409) => { const error = new Error(message); error.status = status; throw error; };
const cell = (row, col) => row * 9 + col;
const coords = index => [Math.floor(index / 9), index % 9];
const square = index => 'abcdefgh'[index % 8] + (8 - Math.floor(index / 8));
const squareIndex = name => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

export function initialXiangqi() {
  const board = Array(90).fill(null), back = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];
  for (let col = 0; col < 9; col++) { board[cell(0, col)] = 'b' + back[col]; board[cell(9, col)] = 'r' + back[col]; }
  for (const col of [1, 7]) { board[cell(2, col)] = 'bc'; board[cell(7, col)] = 'rc'; }
  for (const col of [0, 2, 4, 6, 8]) { board[cell(3, col)] = 'bp'; board[cell(6, col)] = 'rp'; }
  return board;
}
function blockers(board, from, to) {
  const [r, c] = coords(from), [nr, nc] = coords(to);
  if (r !== nr && c !== nc) return -1;
  const dr = Math.sign(nr - r), dc = Math.sign(nc - c);
  let count = 0;
  for (let rr = r + dr, cc = c + dc; rr !== nr || cc !== nc; rr += dr, cc += dc) if (board[cell(rr, cc)]) count++;
  return count;
}
function palace(side, row, col) { return col >= 3 && col <= 5 && (side === 'r' ? row >= 7 : row <= 2); }
export function xiangqiPseudoLegal(board, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 90 || to < 0 || to >= 90 || from === to) return false;
  const piece = board[from], target = board[to];
  if (!piece || (target && target[0] === piece[0])) return false;
  const [r, c] = coords(from), [nr, nc] = coords(to), dr = nr - r, dc = nc - c;
  const ar = Math.abs(dr), ac = Math.abs(dc), side = piece[0];
  switch (piece[1]) {
    case 'r': return blockers(board, from, to) === 0;
    case 'c': return blockers(board, from, to) === (target ? 1 : 0);
    case 'h': return ((ar === 2 && ac === 1) || (ar === 1 && ac === 2))
      && !board[cell(r + (ar === 2 ? Math.sign(dr) : 0), c + (ac === 2 ? Math.sign(dc) : 0))];
    case 'e': return ar === 2 && ac === 2 && (side === 'r' ? nr >= 5 : nr <= 4) && !board[cell(r + dr / 2, c + dc / 2)];
    case 'a': return ar === 1 && ac === 1 && palace(side, nr, nc);
    case 'k': return (target?.[1] === 'k' && c === nc && blockers(board, from, to) === 0)
      || (ar + ac === 1 && palace(side, nr, nc));
    case 'p': return (dc === 0 && dr === (side === 'r' ? -1 : 1))
      || ((side === 'r' ? r <= 4 : r >= 5) && dr === 0 && ac === 1);
    default: return false;
  }
}
export function xiangqiInCheck(board, side) {
  const king = board.indexOf(side + 'k');
  return king < 0 || board.some((piece, from) => piece && piece[0] !== side && xiangqiPseudoLegal(board, from, king));
}
export function xiangqiLegalMoves(board, side) {
  const moves = [];
  for (let from = 0; from < 90; from++) {
    if (board[from]?.[0] !== side) continue;
    for (let to = 0; to < 90; to++) if (xiangqiPseudoLegal(board, from, to)) {
      const next = [...board]; next[to] = next[from]; next[from] = null;
      if (!xiangqiInCheck(next, side)) moves.push({ from, to });
    }
  }
  return moves;
}

function newPosition(type) {
  if (type === 'chess') return { engine: new Chess() };
  const board = type === 'xiangqi' ? initialXiangqi() : Array(225).fill(null), turn = type === 'xiangqi' ? 'r' : 'X';
  return { board, turn, quiet: 0, repetitions: new Map([[board.join(',') + turn, 1]]), checks: [] };
}
export function createGameTables() {
  return DEFINITIONS.map(definition => ({ ...definition, seats: [null, null], status: 'waiting', version: 0,
    position: newPosition(definition.id), result: null, history: [], lastMove: null, winningCells: [], rematch: [] }));
}
function reset(table) {
  table.position = newPosition(table.id); table.result = null; table.history = []; table.lastMove = null;
  table.winningCells = []; table.rematch = []; table.status = table.seats.every(Boolean) ? 'playing' : 'waiting';
}
function finish(table, winner, text) { table.status = 'finished'; table.result = { winner, text }; table.rematch = []; }
function currentTurn(table) { return table.id === 'chess' ? table.position.engine.turn() : table.position.turn; }
function legalMoves(table) {
  if (table.status !== 'playing') return [];
  if (table.id === 'chess') return table.position.engine.moves({ verbose: true }).map(m => ({ from: squareIndex(m.from), to: squareIndex(m.to), ...(m.promotion ? { promotion: m.promotion } : {}) }));
  return table.id === 'xiangqi' ? xiangqiLegalMoves(table.position.board, table.position.turn) : [];
}
export function snapshotTables(tables) {
  return tables.map(table => ({ id: table.id, title: table.title, rows: table.rows, cols: table.cols, sides: table.sides, labels: table.labels,
    x: table.x, z: 27, seats: table.seats.map(seat => seat ? { identity: seat.identity, name: seat.name, offlineSince: seat.offlineSince } : null),
    status: table.status, version: table.version, result: table.result, rematch: [...table.rematch],
    board: table.id === 'chess' ? table.position.engine.board().flat().map(p => p ? p.color + p.type : null) : [...table.position.board],
    turn: currentTurn(table), legalMoves: legalMoves(table), lastMove: table.lastMove, winningCells: [...table.winningCells], history: table.history.slice(-12),
    inCheck: table.id === 'chess' ? table.position.engine.isCheck() : table.id === 'xiangqi' && xiangqiInCheck(table.position.board, table.position.turn),
  }));
}
function playMove(table, input) {
  const { from, to } = input;
  if (!Number.isInteger(to) || to < 0 || to >= table.rows * table.cols) fail('Ô cờ không hợp lệ.', 400);
  const side = currentTurn(table);
  if (table.id === 'caro') {
    const board = table.position.board;
    if (board[to]) fail('Ô này đã có quân.');
    board[to] = side;
    const row = Math.floor(to / 15), col = to % 15;
    for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const run = [to];
      for (const direction of [-1, 1]) for (let n = 1; n < 15; n++) {
        const r = row + dr * n * direction, c = col + dc * n * direction;
        if (r < 0 || r >= 15 || c < 0 || c >= 15 || board[r * 15 + c] !== side) break;
        run.push(r * 15 + c);
      }
      if (run.length >= 5) { table.winningCells = run; finish(table, side, `${side} thắng với 5 quân liên tiếp!`); break; }
    }
    if (table.status === 'playing' && board.every(Boolean)) finish(table, null, 'Hòa: bàn cờ đã đầy.');
    table.position.turn = side === 'X' ? 'O' : 'X';
    table.history.push(`${side}: hàng ${row + 1}, cột ${col + 1}`);
  } else if (table.id === 'chess') {
    if (!Number.isInteger(from) || from < 0 || from >= 64) fail('Quân cờ không hợp lệ.', 400);
    let move;
    try { move = table.position.engine.move({ from: square(from), to: square(to), promotion: ['q', 'r', 'b', 'n'].includes(input.promotion) ? input.promotion : 'q' }); }
    catch { fail('Nước đi không hợp lệ hoặc không giải được thế chiếu.'); }
    table.history.push(move.san);
    if (table.position.engine.isCheckmate()) finish(table, side, `${side === 'w' ? 'Trắng' : 'Đen'} thắng chiếu hết!`);
    else if (table.position.engine.isDraw()) finish(table, null, 'Ván cờ hòa.');
  } else {
    if (!legalMoves(table).some(m => m.from === from && m.to === to)) fail('Nước đi không hợp lệ: hãy kiểm tra luật quân và thế chiếu.');
    const position = table.position, captured = position.board[to];
    position.board[to] = position.board[from]; position.board[from] = null;
    position.quiet = captured ? 0 : position.quiet + 1;
    position.turn = side === 'r' ? 'b' : 'r';
    const check = xiangqiInCheck(position.board, position.turn);
    position.checks.push({ side, check });
    if (position.checks.length > 12) position.checks.shift();
    table.history.push(`${side === 'r' ? 'Đỏ' : 'Đen'}: ${from % 9 + 1},${Math.floor(from / 9) + 1} → ${to % 9 + 1},${Math.floor(to / 9) + 1}${check ? ' (chiếu)' : ''}`);
    if (!xiangqiLegalMoves(position.board, position.turn).length) finish(table, side, `${side === 'r' ? 'Đỏ' : 'Đen'} thắng: đối thủ hết nước đi hợp lệ.`);
    else {
      const key = position.board.join(',') + position.turn;
      const count = (position.repetitions.get(key) ?? 0) + 1; position.repetitions.set(key, count);
      if (count >= 3) {
        const checker = ['r', 'b'].find(color => { const turns = position.checks.filter(m => m.side === color); return turns.length >= 3 && turns.every(m => m.check); });
        if (checker) finish(table, checker === 'r' ? 'b' : 'r', `${checker === 'r' ? 'Đỏ' : 'Đen'} thua do chiếu liên tục lặp thế.`);
        else finish(table, null, 'Hòa: thế cờ lặp lại ba lần.');
      } else if (position.quiet >= 120) finish(table, null, 'Hòa: 120 lượt đi không bắt quân.');
    }
  }
  table.lastMove = { from: table.id === 'caro' ? to : from, to };
  if (table.history.length > 120) table.history.shift();
}

export function actOnTable(tables, actor, input) {
  const table = tables.find(t => t.id === input.tableId);
  if (!table) fail('Không tìm thấy bàn cờ.', 404);
  const seatIndex = table.seats.findIndex(seat => seat?.identity === actor.identity);
  if (input.action === 'join') {
    const other = tables.find(t => t.id !== table.id && t.seats.some(s => s?.identity === actor.identity));
    if (other) fail('Bạn cần rời bàn hiện tại trước khi chọn bàn khác.');
    if (seatIndex >= 0) {
      table.seats[seatIndex].name = actor.name; table.seats[seatIndex].offlineSince = null;
    } else {
      const empty = table.seats.indexOf(null);
      if (empty < 0) fail('Bàn đã đủ 2 người. Bạn có thể xem ván hoặc chọn bàn khác.');
      table.seats[empty] = { identity: actor.identity, name: actor.name, offlineSince: null };
      if (table.seats.every(Boolean)) reset(table);
    }
  } else {
    if (seatIndex < 0) fail('Bạn đang xem ván. Hãy vào một chỗ trống để chơi.', 403);
    if (input.action === 'leave') {
      if (table.status === 'playing') finish(table, table.sides[1 - seatIndex], 'Đối thủ rời bàn. Người ở lại thắng.');
      table.seats[seatIndex] = null; table.rematch = [];
      if (!table.seats.some(Boolean)) reset(table);
    } else if (input.action === 'resign') {
      if (table.status !== 'playing') fail('Chưa có ván đang chơi.');
      finish(table, table.sides[1 - seatIndex], `${table.labels[1 - seatIndex]} thắng: đối thủ xin thua.`);
    } else if (input.action === 'rematch') {
      if (table.status !== 'finished' || !table.seats.every(Boolean)) fail('Cần đủ hai người ở ván đã kết thúc để chơi lại.');
      if (!table.rematch.includes(actor.identity)) table.rematch.push(actor.identity);
      if (table.rematch.length === 2) { table.seats.reverse(); reset(table); }
    } else if (input.action === 'move') {
      if (table.status !== 'playing') fail('Cần đủ 2 người và một ván đang diễn ra.');
      if (table.seats.some(s => s.offlineSince !== null)) fail('Đối thủ mất kết nối. Chờ tối đa 30 giây để kết nối lại.');
      if (input.version !== table.version) fail('Bàn vừa được cập nhật. Hãy chọn lại nước đi.');
      if (table.sides[seatIndex] !== currentTurn(table)) fail('Chưa đến lượt của bạn.');
      playMove(table, input);
    } else fail('Thao tác bàn cờ không hợp lệ.', 400);
  }
  table.version++;
  return table;
}

export function setTablePresence(tables, actor, connected, now) {
  let changed = false;
  for (const table of tables) for (const seat of table.seats) if (seat?.identity === actor.identity) {
    if (connected && actor.name && seat.name !== actor.name) { seat.name = actor.name; changed = true; table.version++; }
    if (connected && seat.offlineSince !== null) { seat.offlineSince = null; changed = true; table.version++; }
    else if (!connected && seat.offlineSince === null) { seat.offlineSince = now; changed = true; table.version++; }
  }
  return changed;
}
export function expireTableSeats(tables, now) {
  let changed = false;
  for (const table of tables) for (const seat of [...table.seats]) if (seat && seat.offlineSince !== null && now - seat.offlineSince >= 30000) {
    actOnTable(tables, { identity: seat.identity }, { tableId: table.id, action: 'leave' }); changed = true;
  }
  return changed;
}
