import { cv } from "../config";
import type { CallLog, Chat, Complaint, Order, State } from "../types";
import { MIN, HOUR, audit, fail, notify, now, ok, orderOf, person, uid, type Actor, type Result } from "./core";
import { openTicket } from "./trust";

/** Statuses in which the shipper and the confirmed driver may write and call each other. */
export const COMMS_LIVE = ["AWAITING_DEPOSIT", "ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW", "IN_TRANSIT", "AT_DELIVERY"];
/** Statuses in which the counterparty's phone number is visible (never after delivery). */
export const PHONE_LIVE = COMMS_LIVE.filter((x) => x !== "AWAITING_DEPOSIT");

export const parties = (o: Order) => (o.driverId ? [o.shipperId, o.driverId] : [o.shipperId]);
const isParty = (o: Order, pid: string) => parties(o).includes(pid);
const other = (o: Order, pid: string) => (pid === o.shipperId ? o.driverId : o.shipperId);

/** Write access: during the live statuses, plus a short grace period after delivery. */
export function commsWritable(s: State, o: Order): boolean {
  if (!o.driverId) return false;
  if (COMMS_LIVE.includes(o.status)) return true;
  return ["DELIVERED", "COMPLETED"].includes(o.status) && !!o.deliveredAt && now(s) - o.deliveredAt < cv<number>(s, "chat.afterDoneH") * HOUR;
}

export function chatOf(s: State, o: Order): Chat | undefined {
  return s.chats.find((c) => c.orderId === o.id);
}

export function sendChat(s: State, pid: string, orderId: string, text: string): Result {
  const o = orderOf(s, orderId);
  if (!o || !isParty(o, pid) || !o.driverId) return fail("گفتگو برای این سفارش در دسترس نیست.");
  if (!commsWritable(s, o)) return fail("گفتگوی این سفارش بسته شده است.");
  const t = text.trim();
  if (!t) return fail("پیام خالی است.");
  let c = chatOf(s, o);
  if (!c) { c = { orderId, shipperId: o.shipperId, driverId: o.driverId, messages: [], readAt: {} }; s.chats.unshift(c); }
  c.messages.push({ id: uid(s, "m"), from: pid, text: t.slice(0, 600), at: now(s) });
  c.readAt[pid] = now(s);
  const to = other(o, pid)!;
  notify(s, to, pid === o.shipperId ? "driver" : "shipper", "chat", `پیام جدید از ${person(s, pid)?.name ?? "طرف مقابل"}: ${t.slice(0, 60)}`, pid === o.shipperId ? `/driver/order/?id=${o.id}` : `/app/order/?id=${o.id}`);
  return ok();
}

export function markChatRead(s: State, pid: string, orderId: string) {
  const c = s.chats.find((x) => x.orderId === orderId);
  if (c) c.readAt[pid] = now(s);
}
export const unreadCount = (s: State, pid: string, orderId: string) => { const c = s.chats.find((x) => x.orderId === orderId); return c ? c.messages.filter((m) => m.from !== pid && m.at > (c.readAt[pid] ?? 0)).length : 0; };

/* ───────── calls (simulated VoIP: numbers stay hidden) ───────── */

export const RING_SEC = 30;
export const activeCall = (s: State, pid: string) => s.calls.find((c) => (c.status === "RINGING" || c.status === "ACTIVE") && (c.from === pid || c.to === pid));

export function startCall(s: State, pid: string, orderId: string): Result<{ id: string }> {
  const o = orderOf(s, orderId);
  if (!o || !isParty(o, pid) || !o.driverId) return fail("تماس برای این سفارش در دسترس نیست.");
  if (!commsWritable(s, o)) return fail("تماس این سفارش بسته شده است.");
  const to = other(o, pid)!;
  if (activeCall(s, pid) || activeCall(s, to)) return fail("یکی از طرفین در تماس دیگری است.");
  const c: CallLog = { id: uid(s, "call"), orderId, from: pid, to, status: "RINGING", at: now(s) };
  s.calls.unshift(c);
  notify(s, to, pid === o.shipperId ? "driver" : "shipper", "call", `تماس ورودی از ${person(s, pid)?.name ?? "طرف مقابل"} برای سفارش ${o.origin.city} ← ${o.dest.city}`, pid === o.shipperId ? `/driver/order/?id=${o.id}` : `/app/order/?id=${o.id}`);
  return ok({ id: c.id });
}

export function answerCall(s: State, pid: string, id: string): Result {
  const c = s.calls.find((x) => x.id === id);
  if (!c || c.to !== pid || c.status !== "RINGING") return fail("تماس دیگر فعال نیست.");
  c.status = "ACTIVE"; c.answeredAt = now(s);
  return ok();
}
export function declineCall(s: State, pid: string, id: string): Result {
  const c = s.calls.find((x) => x.id === id);
  if (!c || c.to !== pid || c.status !== "RINGING") return fail("تماس دیگر فعال نیست.");
  c.status = "DECLINED"; c.endedAt = now(s);
  return ok();
}
export function endCall(s: State, pid: string, id: string): Result {
  const c = s.calls.find((x) => x.id === id);
  if (!c || (c.from !== pid && c.to !== pid) || !["RINGING", "ACTIVE"].includes(c.status)) return fail("تماس دیگر فعال نیست.");
  c.status = c.status === "RINGING" ? (c.from === pid ? "MISSED" : "DECLINED") : "ENDED"; c.endedAt = now(s);
  if (c.status === "MISSED") { const o = orderOf(s, c.orderId); if (o) notify(s, c.to, c.to === o.shipperId ? "shipper" : "driver", "call_missed", `تماس بی‌پاسخ از ${person(s, c.from)?.name ?? "طرف مقابل"}`, c.to === o.shipperId ? `/app/order/?id=${o.id}` : `/driver/order/?id=${o.id}`); }
  return ok();
}

/* ───────── complaints ───────── */

export const COMPLAINT_CATEGORIES = {
  shipper: ["راننده دیر رسید", "راننده پاسخ نمی‌دهد", "رفتار نامناسب", "دما رعایت نشد", "بار آسیب دید / کم شد", "خودرو با مشخصات فرق دارد", "درخواست پول خارج از قرارداد", "سایر"],
  driver: ["بار با اعلام فرق دارد", "صاحب بار پاسخ نمی‌دهد", "بار آماده نیست / انتظار طولانی", "رفتار نامناسب", "گیرنده همکاری نمی‌کند", "درخواست کار خارج از قرارداد", "پرداخت یا نقدی مشکل دارد", "سایر"],
} as const;

export function fileComplaint(s: State, pid: string, orderId: string, category: string, text: string): Result<{ id: string }> {
  const o = orderOf(s, orderId);
  if (!o || !o.driverId || !isParty(o, pid)) return fail("برای این سفارش نمی‌توانید شکایت ثبت کنید.");
  if (!text.trim() || text.trim().length < 5) return fail("شرح مشکل را بنویسید.");
  if (s.complaints.some((c) => c.orderId === orderId && c.byId === pid && c.category === category && ["OPEN", "ANSWERED"].includes(c.status))) return fail("همین شکایت قبلاً ثبت شده و در جریان است.");
  const role = pid === o.shipperId ? "shipper" : "driver";
  const c: Complaint = { id: uid(s, "cp"), orderId, byId: pid, againstId: other(o, pid)!, byRole: role, category, text: text.trim(), at: now(s), status: "OPEN", messages: [{ from: pid, text: text.trim(), at: now(s) }] };
  s.complaints.unshift(c);
  notify(s, c.againstId, role === "shipper" ? "driver" : "shipper", "complaint", `شکایت «${category}» درباره‌ی سفارش ${o.origin.city} ← ${o.dest.city} ثبت شد؛ همین حالا پاسخ دهید.`, role === "shipper" ? `/driver/order/?id=${o.id}` : `/app/order/?id=${o.id}`);
  return ok({ id: c.id });
}

export function replyComplaint(s: State, pid: string, id: string, text: string): Result {
  const c = s.complaints.find((x) => x.id === id);
  if (!c || (c.byId !== pid && c.againstId !== pid)) return fail("شکایت پیدا نشد.");
  if (["RESOLVED"].includes(c.status)) return fail("این شکایت بسته شده است.");
  if (!text.trim()) return fail("پیام خالی است.");
  c.messages.push({ from: pid, text: text.trim(), at: now(s) });
  if (c.status === "OPEN" && pid === c.againstId) c.status = "ANSWERED";
  const o = orderOf(s, c.orderId);
  const to = pid === c.byId ? c.againstId : c.byId;
  notify(s, to, to === o?.shipperId ? "shipper" : "driver", "complaint", `پاسخ جدید در شکایت «${c.category}»`, to === o?.shipperId ? `/app/order/?id=${c.orderId}` : `/driver/order/?id=${c.orderId}`);
  return ok();
}

/** Only the person who raised it can close it as solved. */
export function resolveComplaint(s: State, pid: string, id: string): Result {
  const c = s.complaints.find((x) => x.id === id);
  if (!c || c.byId !== pid) return fail("فقط ثبت‌کننده می‌تواند شکایت را «حل‌شده» کند.");
  if (c.status === "RESOLVED") return ok();
  c.status = "RESOLVED"; c.resolvedAt = now(s); c.resolvedBy = person(s, pid)?.name;
  return ok();
}

/** Either party (or the timer) sends it to staff as a support ticket linked to the order. */
export function escalateComplaint(s: State, pid: string | "system", id: string): Result {
  const c = s.complaints.find((x) => x.id === id);
  if (!c || (pid !== "system" && c.byId !== pid && c.againstId !== pid)) return fail("شکایت پیدا نشد.");
  if (c.status === "ESCALATED" || c.status === "RESOLVED") return ok();
  const t = openTicket(s, c.byId, c.byRole, { channel: "trip", category: "شکایت", subject: `شکایت: ${c.category}`, text: c.messages.map((m) => `${person(s, m.from)?.name ?? "—"}: ${m.text}`).join("\n"), orderId: c.orderId });
  c.status = "ESCALATED";
  if (t.ok) c.ticketId = t.id;
  return ok();
}

export function adminResolveComplaint(s: State, actor: Actor, id: string, note: string): Result {
  const c = s.complaints.find((x) => x.id === id);
  if (!c) return fail("شکایت پیدا نشد.");
  c.status = "RESOLVED"; c.resolvedAt = now(s); c.resolvedBy = actor.label;
  c.messages.push({ from: "staff", text: `پشتیبانی: ${note || "رسیدگی و بسته شد."}`, at: now(s) });
  const o = orderOf(s, c.orderId);
  for (const p of [c.byId, c.againstId]) notify(s, p, p === o?.shipperId ? "shipper" : "driver", "complaint", `شکایت «${c.category}» توسط پشتیبانی بررسی و بسته شد.`, p === o?.shipperId ? `/app/order/?id=${c.orderId}` : `/driver/order/?id=${c.orderId}`);
  audit(s, actor, "complaint.resolve", note || c.category, c.id);
  return ok();
}

/** Tick: unanswered ringing calls become missed; unanswered complaints go to staff after the configured time. */
export function commsDue(s: State): boolean {
  const t = now(s);
  return s.calls.some((c) => c.status === "RINGING" && t - c.at > RING_SEC * 1000) || s.complaints.some((c) => c.status === "OPEN" && t - c.at > cv<number>(s, "complaint.replyMin") * MIN);
}
export function commsTick(s: State): boolean {
  const t = now(s);
  let ch = false;
  for (const c of s.calls) if (c.status === "RINGING" && t - c.at > RING_SEC * 1000) { endCall(s, c.from, c.id); ch = true; }
  for (const c of s.complaints) if (c.status === "OPEN" && t - c.at > cv<number>(s, "complaint.replyMin") * MIN) { escalateComplaint(s, "system", c.id); ch = true; }
  return ch;
}
