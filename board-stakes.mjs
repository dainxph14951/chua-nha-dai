import { randomUUID } from 'node:crypto';
import { actOnTable, expireTableSeats } from './board-games.mjs';

export const MAX_BOARD_STAKE = 1000;
const fail = message => { const error = new Error(message); error.status = 409; throw error; };
const lookup = (accounts, identity) => [...accounts.values()].find(account => account.publicId === identity);
function amount(value) {
  const stake = value === undefined ? 0 : value;
  if (!Number.isInteger(stake) || stake < 0 || stake > MAX_BOARD_STAKE) fail(`Mức cược phải là số nguyên từ 0 đến ${MAX_BOARD_STAKE} công đức.`);
  return stake;
}
function canFund(accounts, identities, stake) {
  if (!stake) return;
  for (const identity of identities) {
    const account = lookup(accounts, identity);
    if (!account || account.blocked) fail('Người đang tạm khóa công đức không thể tham gia cược. Có thể chọn mức 0 để chơi thường.');
    if (account.boardEscrow) fail('Bạn còn điểm đang được giữ ở ván khác.');
    if (account.merit < stake) fail('Một trong hai người không đủ công đức cho mức cược này. Chưa trừ điểm của ai.');
  }
}
function fund(table, accounts, changed) {
  table.bet = null;
  if (!table.wager) return;
  const bet = { id: randomUUID(), amount: table.wager, identities: table.seats.map(s => s.identity), settled: false, payouts: [] };
  for (const identity of bet.identities) {
    const account = lookup(accounts, identity);
    account.merit -= bet.amount; account.boardEscrow = { matchId: bet.id, tableId: table.id, amount: bet.amount };
    account.revision++; changed.add(account);
  }
  table.bet = bet;
}
function settle(table, accounts, changed, refund = false) {
  const bet = table.bet;
  if (!bet || bet.settled || table.status !== 'finished') return;
  bet.settled = true;
  const winner = refund || table.result?.winner === null ? -1 : table.sides.indexOf(table.result?.winner);
  for (let i = 0; i < bet.identities.length; i++) {
    const account = lookup(accounts, bet.identities[i]);
    if (!account || account.boardEscrow?.matchId !== bet.id) continue;
    const payout = account.blocked ? 0 : winner < 0 ? bet.amount : i === winner ? bet.amount * 2 : 0;
    account.merit += payout; account.rewardMerit = Math.max(account.rewardMerit, account.merit);
    delete account.boardEscrow; account.revision++; changed.add(account);
    bet.payouts.push({ identity: bet.identities[i], amount: payout });
  }
  bet.note = refund ? 'Ván hủy. Hoàn cược cho người hợp lệ; danh tính bị tạm khóa không nhận lại cược.'
    : winner < 0 ? 'Ván hòa. Mỗi người đã được hoàn lại điểm cược công đức.' : `Người thắng đã nhận ${bet.amount * 2} công đức trong tổng cược.`;
}

export function actOnStakedTable(tables, accounts, actor, input) {
  const table = tables.find(t => t.id === input.tableId);
  if (!table) fail('Không tìm thấy bàn cờ.');
  const mySeat = table.seats.findIndex(s => s?.identity === actor.identity), occupied = table.seats.filter(Boolean);
  if (input.action === 'stake') {
    if (mySeat < 0 || occupied.length !== 1 || table.status !== 'waiting') fail('Chỉ người đang chờ một mình ở bàn mới được đổi mức cược.');
    if (input.version !== table.version) fail('Bàn vừa cập nhật. Hãy kiểm tra lại mức cược.');
    const stake = amount(input.stake); canFund(accounts, [actor.identity], stake);
    table.wager = stake; table.rematch = []; table.version++;
    return new Set();
  }
  let proposed = table.wager, starting = false;
  if (input.action === 'join' && mySeat < 0) {
    proposed = occupied.length ? table.wager : amount(input.stake);
    if (occupied.length && amount(input.stake) !== table.wager) fail('Mức cược đã thay đổi. Hãy đọc và đồng ý đúng mức đang hiển thị.');
    if (proposed > 0 && input.version !== table.version) fail('Bàn vừa cập nhật. Hãy đọc lại mức cược trước khi đồng ý.');
    if (proposed > 0 && occupied.some(s => s.offlineSince !== null)) fail('Đối thủ đang mất kết nối. Chưa giữ điểm, hãy chờ họ quay lại.');
    canFund(accounts, [...occupied.map(s => s.identity), actor.identity], proposed);
    starting = occupied.length === 1;
  } else if (input.action === 'rematch') {
    if (amount(input.stake) !== table.wager) fail('Cần đồng ý đúng mức cược để chơi ván mới.');
    if (table.wager > 0 && input.version !== table.version) fail('Bàn vừa cập nhật. Hãy kiểm tra lại mức cược.');
    if (table.wager > 0 && occupied.some(s => s.offlineSince !== null)) fail('Cần cả hai người đang kết nối để cược ván mới.');
    canFund(accounts, occupied.map(s => s.identity), table.wager);
    starting = table.rematch.length === 1 && !table.rematch.includes(actor.identity);
  }
  const previousWager = table.wager;
  if (input.action === 'join' && occupied.length === 0) table.wager = proposed;
  try { actOnTable(tables, actor, input); } catch (error) { table.wager = previousWager; throw error; }
  const changed = new Set();
  if (starting && table.status === 'playing') fund(table, accounts, changed);
  settle(table, accounts, changed);
  return changed;
}

export function cancelBlockedBets(tables, accounts) {
  const changed = new Set();
  for (const table of tables) if (table.bet && !table.bet.settled && table.bet.identities.some(id => lookup(accounts, id)?.blocked)) {
    table.status = 'finished'; table.result = { winner: null, text: 'Ván hủy do một người bị tạm khóa công đức. Người còn lại được hoàn cược.' };
    table.rematch = []; table.version++; settle(table, accounts, changed, true);
  }
  return changed;
}

export function expireStakedSeats(tables, accounts, now) {
  const changed = new Set();
  for (const table of tables) if (table.bet && !table.bet.settled && table.seats.every(s => s && s.offlineSince !== null && now - s.offlineSince >= 30000)) {
    table.status = 'finished'; table.result = { winner: null, text: 'Hai người cùng mất kết nối. Ván hủy và hoàn cược.' };
    table.rematch = []; table.version++; settle(table, accounts, changed, true);
  }
  const expired = expireTableSeats(tables, now);
  for (const table of tables) settle(table, accounts, changed);
  return { changed, expired };
}

// Game positions are transient. Any funded game left in the ledger by a crash is refunded once on startup.
export function recoverBoardEscrows(accounts) {
  let recovered = false;
  for (const account of accounts.values()) if (account.boardEscrow) {
    const stake = account.boardEscrow.amount;
    if (Number.isInteger(stake) && stake > 0 && stake <= MAX_BOARD_STAKE && !account.blocked) {
      account.merit += stake; account.rewardMerit = Math.max(account.rewardMerit, account.merit);
    }
    delete account.boardEscrow; account.revision++; recovered = true;
  }
  return recovered;
}
