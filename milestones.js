export const MILESTONES = [
  { merit: 1000, title: 'Tâm An', robe: 0x9bc8ae, robeName: 'Sen ngọc', rewards: ['Áo sen ngọc · Cánh sen khi lạy', 'Huy hiệu Tâm An dưới tên'] },
  { merit: 2000, title: 'Duyên Lành', rewards: ['Hào quang nhẹ quanh nhân vật', 'Mở động tác chắp tay chào'] },
  { merit: 3000, title: 'Thiện Tâm', rewards: ['Viết lời nguyện, thả hoa đăng', 'Hoa đăng trôi trên hồ sen'] },
  { merit: 4000, title: 'Sen Vàng', robe: 0xffd15c, robeName: 'Sen vàng', rewards: ['Áo sen vàng · Hào quang hoa sen', 'Mở nghi thức dâng đèn trước Phật'] },
];

export function earnedMerit(merit, previous = 0) {
  const valid = value => Number.isFinite(value) ? Math.floor(Math.max(0, Math.min(1_000_000_000, value))) : 0;
  return Math.max(valid(merit), valid(previous));
}

export function milestoneTier(merit) {
  return MILESTONES.filter(m => earnedMerit(merit) >= m.merit).length;
}

export function canUseRitual(type, merit) {
  return type === 'lantern' ? milestoneTier(merit) >= 3 : type === 'lamp' && milestoneTier(merit) >= 4;
}
