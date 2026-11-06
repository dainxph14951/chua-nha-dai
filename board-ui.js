const CHESS_PIECES = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' };
export const XIANGQI_PIECES = { rk: '帥', ra: '仕', re: '相', rh: '傌', rr: '俥', rc: '炮', rp: '兵', bk: '將', ba: '士', be: '象', bh: '馬', br: '車', bc: '砲', bp: '卒' };
export function pieceLabel(type, piece) { return type === 'chess' ? CHESS_PIECES[piece] || '' : type === 'xiangqi' ? XIANGQI_PIECES[piece] || '' : piece || ''; }

export function setupBoardGames({ getRoom, onSeat, onLeave, onVisit, onUpdate, getMerit = () => 0, isMeritLocked = () => false }) {
  const $ = id => document.getElementById(id);
  let tables = [], selectedId = null, selectedCell = null, pending = false, lastSeat = '', stakeTableId = null;
  const identity = () => getRoom().session?.identity;
  const active = () => tables.find(t => t.id === selectedId);
  const seatOf = table => identity() ? (table?.seats.findIndex(s => s?.identity === identity()) ?? -1) : -1;
  const statusText = table => table.status === 'playing' ? 'Đang chơi' : table.status === 'finished' ? 'Đã kết thúc' : 'Chờ người chơi';
  function receive(data, reset = false) {
    if (!Array.isArray(data)) return;
    const previous = active();
    tables = data.map(table => {
      const current = tables.find(t => t.id === table.id);
      return !reset && current && current.version > table.version ? current : table;
    });
    if (previous && active()?.version !== previous.version) selectedCell = null;
    const mine = tables.find(t => seatOf(t) >= 0);
    const key = mine ? mine.id + ':' + seatOf(mine) : '';
    if (key !== lastSeat) {
      if (mine) onSeat(mine, seatOf(mine), { restoring: reset }); else if (lastSeat) onLeave();
      lastSeat = key;
    }
    onUpdate(tables); render();
  }
  function open(tableId = null) {
    if (tableId) { selectedId = tableId; selectedCell = null; }
    $('mBoardGames').classList.add('show'); $('boardError').textContent = ''; render();
  }
  async function request(action, extra = {}) {
    const table = active();
    if (pending || !table) return;
    if (!getRoom().ready) { $('boardError').textContent = 'Vào chùa và chờ kết nối phòng chung để chơi cờ.'; return; }
    pending = true; $('boardError').textContent = ''; render();
    try {
      const data = await getRoom().post('table', { tableId: table.id, action, version: table.version, ...extra });
      receive(data.tables);
    } catch (error) { $('boardError').textContent = error.message; }
    finally { pending = false; render(); }
  }
  function clickCell(index) {
    const table = active(), seat = seatOf(table);
    if (pending || !table || seat < 0 || table.status !== 'playing' || table.sides[seat] !== table.turn) return;
    if (table.id === 'caro') { if (!table.board[index]) request('move', { to: index }); return; }
    if (selectedCell !== null && table.legalMoves.some(m => m.from === selectedCell && m.to === index)) {
      const from = selectedCell; selectedCell = null;
      request('move', { from, to: index, promotion: $('boardPromotion').value }); return;
    }
    selectedCell = table.board[index]?.[0] === table.turn ? (selectedCell === index ? null : index) : null;
    renderBoard(table);
  }
  function renderBoard(table) {
    const board = $('gameBoard'); board.replaceChildren();
    board.className = 'game-board ' + table.id;
    board.style.setProperty('--cols', table.cols); board.style.setProperty('--rows', table.rows);
    const seat = seatOf(table), myTurn = seat >= 0 && table.status === 'playing' && table.sides[seat] === table.turn;
    const canPlay = myTurn && getRoom().ready && !pending && table.seats.every(s => s && s.offlineSince === null);
    const flip = seat === 1 && table.id !== 'caro';
    for (let display = 0; display < table.board.length; display++) {
      const index = flip ? table.board.length - 1 - display : display, piece = table.board[index];
      const row = Math.floor(index / table.cols), col = index % table.cols;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.cell = String(index);
      button.className = 'board-cell' + ((row + col) % 2 ? ' dark' : ' light');
      if (index === selectedCell) button.classList.add('selected');
      if (selectedCell !== null && table.legalMoves.some(m => m.from === selectedCell && m.to === index)) button.classList.add('legal');
      if (table.lastMove && (index === table.lastMove.from || index === table.lastMove.to)) button.classList.add('last-move');
      if (table.winningCells.includes(index)) button.classList.add('winning');
      if (table.inCheck && piece === table.turn + 'k') button.classList.add('in-check');
      if (piece) {
        const mark = document.createElement('span'); mark.className = 'piece side-' + piece[0]; mark.textContent = pieceLabel(table.id, piece); button.append(mark);
      }
      button.setAttribute('aria-label', `Hàng ${row + 1}, cột ${col + 1}${piece ? ', ' + pieceLabel(table.id, piece) : ', trống'}`);
      button.disabled = !canPlay; button.onclick = () => clickCell(index); board.append(button);
    }
    if (table.id === 'xiangqi') { const river = document.createElement('div'); river.className = 'board-river'; river.textContent = '楚 河     漢 界'; board.append(river); }
  }
  function render() {
    const list = $('tableChoices'); list.replaceChildren();
    for (const table of tables) {
      const card = document.createElement('button'); card.className = 'table-choice' + (table.id === selectedId ? ' selected' : '');
      const title = document.createElement('strong'); title.textContent = table.title;
      const detail = document.createElement('span'); detail.textContent = `${table.seats.filter(Boolean).length}/2 người · ${statusText(table)} · ${table.wager ? 'Cược ' + table.wager : 'Chơi thường'}`;
      card.append(title, detail); card.onclick = () => { selectedId = table.id; selectedCell = null; $('boardError').textContent = ''; render(); }; list.append(card);
    }
    $('boardWaiting').hidden = tables.length > 0;
    const table = active(); $('boardDetail').hidden = !table;
    if (!table) return;
    const seat = seatOf(table), occupied = table.seats.filter(Boolean).length;
    if (stakeTableId !== table.id) { $('boardStake').value = String(table.wager || 0); stakeTableId = table.id; }
    if (occupied > 0 && !(seat >= 0 && occupied === 1 && table.status === 'waiting')) $('boardStake').value = String(table.wager || 0);
    $('boardTitle').textContent = table.title;
    $('boardSeats').replaceChildren();
    table.seats.forEach((person, i) => {
      const line = document.createElement('div');
      line.textContent = `${table.labels[i]}: ${person ? person.name + (person.identity === identity() ? ' (bạn)' : '') + (person.offlineSince !== null ? ' · mất kết nối, giữ chỗ 30 giây' : '') : 'Chỗ trống'}`;
      $('boardSeats').append(line);
    });
    $('boardTurn').textContent = table.result ? table.result.text : occupied < 2 ? 'Chờ đủ 2 người để bắt đầu.'
      : table.seats.some(s => s.offlineSince !== null) ? 'Tạm dừng: chờ đối thủ kết nối lại.'
      : `${seat >= 0 && table.sides[seat] === table.turn ? 'Đến lượt bạn' : 'Lượt ' + table.labels[table.sides.indexOf(table.turn)]}${table.inCheck ? ' · Đang bị chiếu!' : ''}`;
    $('boardJoin').hidden = seat >= 0; $('boardJoin').disabled = pending || occupied >= 2 || !getRoom().ready;
    $('boardJoin').textContent = occupied >= 2 ? 'Bàn đã đủ 2 người · Bạn đang xem' : 'Ngồi vào bàn';
    $('boardReturn').hidden = seat < 0; $('boardReturn').disabled = pending;
    $('boardLeave').hidden = seat < 0; $('boardLeave').disabled = pending;
    $('boardResign').hidden = seat < 0; $('boardResign').disabled = pending || table.status !== 'playing';
    $('boardRematch').hidden = seat < 0 || table.status !== 'finished';
    $('boardRematch').disabled = pending || occupied < 2 || table.rematch.includes(identity());
    $('boardRematch').textContent = table.rematch.includes(identity()) ? 'Đã sẵn sàng · Chờ đối thủ' : 'Chơi ván mới (cần cả hai đồng ý)';
    renderStakeControls(table);
    $('promotionLabel').hidden = table.id !== 'chess';
    $('boardRules').textContent = table.id === 'caro' ? 'Ca-rô 15×15: X đi trước, từ 5 quân liên tiếp theo hàng, cột hoặc chéo là thắng; không xét chặn hai đầu.'
      : table.id === 'chess' ? 'Trắng đi trước. Chọn quân rồi chọn ô sáng. Có nhập thành, bắt tốt qua đường, phong cấp, chiếu hết và hòa.'
      : 'Đỏ đi trước. Chọn quân rồi chọn vị trí sáng. Có cản mã, cản tượng, pháo ăn qua ngòi và cấm lộ mặt tướng. Hòa khi lặp thế ba lần; chiếu liên tục lặp thế bị xử thua. Không phân xử đuổi quân liên tục theo luật thi đấu.';
    const history = $('boardHistory'); history.replaceChildren();
    table.history.forEach(text => { const line = document.createElement('li'); line.textContent = text; history.append(line); });
    renderBoard(table);
  }
  function renderStakeControls(table) {
    const seat = seatOf(table), occupied = table.seats.filter(Boolean).length;
    const editable = occupied === 0 || (seat >= 0 && occupied === 1 && table.status === 'waiting');
    const chosen = occupied === 0 ? Number($('boardStake').value) : table.wager || 0;
    const draft = Number($('boardStake').value), valid = Number.isInteger(draft) && draft >= 0 && draft <= 1000;
    const balance = getMerit(), locked = isMeritLocked();
    $('boardStake').disabled = pending || !editable;
    $('boardStakeBalance').textContent = `Số dư khả dụng: ${balance.toLocaleString('vi-VN')} công đức`;
    $('boardSetStake').hidden = !(seat >= 0 && occupied === 1 && table.status === 'waiting');
    $('boardSetStake').disabled = pending || !valid || draft > balance || (draft > 0 && locked);
    $('boardJoin').disabled = pending || occupied >= 2 || !getRoom().ready || !Number.isInteger(chosen) || chosen < 0 || chosen > 1000 || chosen > balance || (chosen > 0 && locked);
    $('boardJoin').textContent = occupied >= 2 ? 'Bàn đã đủ 2 người · Bạn đang xem' : chosen > 0 ? `Đồng ý cược ${chosen} và vào bàn` : 'Ngồi vào bàn · Chơi thường';
    $('boardRematch').disabled = pending || occupied < 2 || table.rematch.includes(identity()) || table.wager > balance || (table.wager > 0 && locked);
    if (!table.rematch.includes(identity())) $('boardRematch').textContent = table.wager ? `Đồng ý cược ${table.wager} và chơi ván mới` : 'Chơi ván mới (cần cả hai đồng ý)';
    $('boardStakeTerms').textContent = table.bet && !table.bet.settled
      ? `Đã giữ ${table.wager} công đức mỗi người. Tổng cược: ${table.bet.pot}. Thắng nhận tổng cược, hòa hoàn lại. Xin thua/rời bàn/mất mạng quá 30 giây tính thua.`
      : !valid && editable ? 'Nhập số nguyên từ 0 đến 1.000 công đức.'
      : chosen > balance ? `Bạn chưa đủ ${chosen} công đức để đồng ý mức cược này.`
      : chosen > 0 && locked ? 'Đang tạm khóa công đức. Bạn có thể chơi thường với mức 0.'
      : chosen > 0 ? `Mức cược ${chosen} công đức mỗi người. Chỉ giữ điểm khi đủ 2 người đồng ý. Thắng nhận ${chosen * 2}, hòa hoàn lại; rời bàn hoặc mất mạng quá 30 giây tính thua.`
      : 'Mức 0 là chơi thường, không thay đổi công đức. Điểm cược là điểm trong game, không quy đổi tiền.';
    $('boardBetResult').hidden = !table.bet?.settled;
    if (table.bet?.settled) {
      const payout = table.bet.payouts.find(p => p.identity === identity());
      $('boardBetResult').textContent = table.bet.note + (payout ? ` Bạn nhận lại ${payout.amount} công đức từ tổng cược.` : '');
    }
  }
  $('bGames').onclick = () => open();
  $('visitGarden').onclick = () => { $('mBoardGames').classList.remove('show'); onVisit(); };
  $('boardJoin').onclick = () => request('join', { stake: active()?.seats.some(Boolean) ? active().wager : Number($('boardStake').value) });
  $('boardSetStake').onclick = () => request('stake', { stake: Number($('boardStake').value) });
  $('boardStake').oninput = () => { const table = active(); if (table) renderStakeControls(table); };
  $('boardReturn').onclick = () => { const table = active(), seat = seatOf(table); if (seat >= 0) onSeat(table, seat); };
  $('boardLeave').onclick = () => request('leave');
  $('boardResign').onclick = () => request('resign');
  $('boardRematch').onclick = () => request('rematch', { stake: active()?.wager || 0 });
  return { receive, open, refresh: render };
}
