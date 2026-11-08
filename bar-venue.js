// Shared geometry and access rules. Admission uses the current verified balance, not past milestones.
export const BAR_MIN_MERIT = 10000;
export const BAR = { minX: 14.5, maxX: 29.5, minZ: 20.8, maxZ: 35.2, entry: { x: 17, z: 23.5 }, exit: { x: 12.5, z: 23.5 } };
export function canEnterBar(account) {
  return !account.blocked && Number.isFinite(account.merit) && account.merit >= BAR_MIN_MERIT;
}
export function isInBar(position) { return position.x > 13.2; }
export function barPosition(x, z, allowed) {
  if (!allowed || x <= 13.2) return { x: Math.max(-13.2, Math.min(13.2, x)), z: Math.max(-13.6, Math.min(37, z)) };
  return { x: Math.max(BAR.minX, Math.min(BAR.maxX, x)), z: Math.max(BAR.minZ, Math.min(BAR.maxZ, z)) };
}
