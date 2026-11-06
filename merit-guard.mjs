// Only this module decides how many points an activity earns.
import { bowCooldownMs } from './milestones.js';
export const MERIT_LIMIT_PER_MINUTE = 180;
const RULES = {
  bow: { points: 3, interval: 4000, initialWait: true },
  bead: { points: 0, interval: 150 },
  chant: { points: 1, interval: 2500, initialWait: true },
  meditate: { points: 1, interval: 9500, initialWait: true },
  offer: { points: 5, interval: 10000 },
  pray: { points: 5, interval: 1000 },
  fortune: { points: 2, interval: 1400 },
};
const dayInVietnam = time => new Date(time + 7 * 3600000).toISOString().slice(0, 10);

export function createMeritAccount(now) {
  return { merit: 0, rewardMerit: 0, beads: 0, rounds: 0, blocked: false, reason: '',
    revision: 0, createdAt: now, last: {}, earnings: [], violations: [], prayerDay: '', fortuneDay: '', fortuneCount: 0 };
}

export function meritStatus(account, now) {
  return { merit: account.merit, rewardMerit: account.rewardMerit, beads: account.beads,
    rounds: account.rounds, blocked: account.blocked, reason: account.reason, revision: account.revision,
    offerWaitMs: Math.max(0, (account.last.offer ?? now - 10000) + 10000 - now),
    bowWaitMs: account.last.bow === undefined ? 0 : Math.max(0, account.last.bow + bowCooldownMs(account.merit) - now),
    bowCooldownMs: bowCooldownMs(account.merit) };
}

export function lockMerit(account, reason) {
  account.merit = 0; account.rewardMerit = 0; account.beads = 0; account.rounds = 0;
  account.blocked = true; account.reason = reason; account.revision++;
  return { status: 403, error: 'Phát hiện tích công đức bất thường. Công đức đã về 0 và bị khóa tích điểm.' };
}

function tooFast(account, now, wait) {
  account.violations = account.violations.filter(time => now - time < 2000);
  account.violations.push(now);
  if (account.violations.length >= 12) return lockMerit(account, 'Gửi yêu cầu cộng công đức quá nhanh nhiều lần.');
  return { status: 429, error: `Thao tác quá nhanh, chờ ${Math.max(1, Math.ceil(wait / 1000))} giây rồi thử lại.`, retryAfterMs: wait };
}

export function performMeritAction(account, action, now) {
  if (account.blocked) return { status: 403, error: 'Tích công đức đã bị khóa do hoạt động bất thường.' };
  const rule = Object.hasOwn(RULES, action) ? RULES[action] : null;
  if (!rule) return { status: 400, error: 'Hoạt động tích công đức không hợp lệ.' };
  if (action === 'fortune' && account.merit < 50) return { status: 403, error: 'Cần đủ 50 công đức để rút quẻ cầu duyên.' };
  const last = account.last[action] ?? (rule.initialWait ? account.createdAt : null);
  const interval = action === 'bow' && account.last.bow !== undefined ? bowCooldownMs(account.merit) : rule.interval;
  if (last !== null && now - last < interval) return tooFast(account, now, interval - (now - last));
  const day = dayInVietnam(now);
  let points = rule.points;
  if (action === 'pray' && account.prayerDay === day) points = 0;
  if (action === 'fortune') {
    if (account.fortuneDay !== day) { account.fortuneDay = day; account.fortuneCount = 0; }
    if (account.fortuneCount >= 3) points = 0;
  }
  if (action === 'bead') points = account.beads === 107 ? 20 : 0;
  account.earnings = account.earnings.filter(entry => now - entry.time < 60000);
  if (account.earnings.reduce((sum, entry) => sum + entry.points, 0) + points > MERIT_LIMIT_PER_MINUTE) {
    return lockMerit(account, `Công đức tăng vượt ${MERIT_LIMIT_PER_MINUTE} điểm trong 60 giây.`);
  }
  account.last[action] = now;
  if (action === 'pray') account.prayerDay = day;
  if (action === 'fortune') account.fortuneCount++;
  if (action === 'bead') {
    account.beads = (account.beads + 1) % 108;
    if (account.beads === 0) account.rounds++;
  }
  if (points) {
    account.merit += points; account.rewardMerit = Math.max(account.rewardMerit, account.merit);
    account.earnings.push({ time: now, points });
  }
  account.revision++;
  return { status: 200, awarded: points };
}
