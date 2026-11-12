// Tạo nhân vật người chơi (phi hành gia, chỉ Cấp Neo, không chỉ số chiến đấu) và nhật ký cốt truyện.
import { zoneClears } from './stage.js';
const fail = (reason) => ({ ok: false, reason });
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export const newPlayer = () => ({ name: '', callsign: '', hometown: '', avatar: 0, culture: null });

// input: { name, callsign, hometown?, avatar, culture }. Quê hương là chuỗi tự do (tránh danh sách quốc gia nhạy cảm).
export function finishOnboarding(ctx, progress, input) {
  const o = ctx.config.onboarding;
  const name = clean(input.name);
  const callsign = clean(input.callsign);
  const hometown = clean(input.hometown);
  if (!name || name.length > o.nameMax) return fail('bad_name');
  if (!callsign || callsign.length > o.callsignMax) return fail('bad_callsign');
  if (hometown.length > o.hometownMax) return fail('bad_hometown');
  if (!Number.isInteger(input.avatar) || input.avatar < 0 || input.avatar >= o.avatars) return fail('bad_avatar');
  if (!ctx.config.summon.cultures.includes(input.culture)) return fail('bad_culture');
  if (progress.onboarding.done) return fail('already_done');
  const p = structuredClone(progress);
  p.player = { name, callsign, hometown, avatar: input.avatar, culture: input.culture };
  p.onboarding.done = true;
  p.inventory.tickets += ctx.config.summon.welcomeTickets; // quà chào mừng để thử Nghi Thức
  return { ok: true, progress: p };
}

// Sửa hồ sơ sau onboarding. Tín Vật (culture) đã neo lượt triệu hồi đầu nên không đổi.
export function updateProfile(ctx, progress, input) {
  const o = ctx.config.onboarding;
  const name = clean(input.name);
  const callsign = clean(input.callsign);
  const hometown = clean(input.hometown);
  if (!progress.onboarding.done) return fail('not_ready');
  if (!name || name.length > o.nameMax) return fail('bad_name');
  if (!callsign || callsign.length > o.callsignMax) return fail('bad_callsign');
  if (hometown.length > o.hometownMax) return fail('bad_hometown');
  if (!Number.isInteger(input.avatar) || input.avatar < 0 || input.avatar >= o.avatars) return fail('bad_avatar');
  const p = structuredClone(progress);
  p.player = { ...p.player, name, callsign, hometown, avatar: input.avatar };
  return { ok: true, progress: p };
}

export function completeTutorial(progress) {
  const p = structuredClone(progress);
  p.onboarding.tutorialDone = true;
  return p;
}

// Các đoạn nhật ký đã mở: đoạn mở đầu (sau onboarding) và đoạn theo từng khu đã vượt.
export function storyUnlocked(ctx, progress) {
  if (!progress.onboarding.done) return [];
  return ctx.storyList.filter((s) => s.after === null || zoneClears(progress, s.after) > 0).map((s) => s.id);
}
