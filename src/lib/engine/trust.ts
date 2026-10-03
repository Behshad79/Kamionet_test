import { A, bal, driverWallet, shipperWallet } from "../ledger";
import type { AdminRole, AdminUser, Review, RuleAcceptance, RuleDoc, State, Ticket, TicketChannel } from "../types";
import { cv } from "../config";
import { actorPerson, audit, DAY, driverOf, fail, HOUR, MIN, notify, now, ok, orderOf, person, shipperOf, uid, type Actor, type Result } from "./core";
import { DRIVER_CRITERIA, SHIPPER_CRITERIA } from "./stats";

/* ───────────────────────── blind reviews ───────────────────────── */

export function reviewCriteria(role: "shipper" | "driver") {
  return role === "shipper" ? DRIVER_CRITERIA : SHIPPER_CRITERIA;
}

export function myReview(s: State, personId: string, orderId: string) {
  return s.reviews.find((r) => r.orderId === orderId && r.fromId === personId);
}

export function submitReview(s: State, personId: string, orderId: string, a: { criteria: Record<string, number>; comment: string; photo?: string }): Result {
  const o = orderOf(s, orderId);
  if (!o || !["DELIVERED", "COMPLETED"].includes(o.status)) return fail("امتیازدهی پس از تحویل ممکن است.");
  const role = personId === o.shipperId ? "shipper" : personId === o.driverId ? "driver" : null;
  if (!role) return fail("دسترسی ندارید.");
  if (myReview(s, personId, orderId)) return fail("قبلاً نظر داده‌اید.");
  const crit = reviewCriteria(role);
  if (crit.some((c) => !(a.criteria[c.id] >= 1))) return fail("همه‌ی معیارها را امتیاز دهید.");
  const to = role === "shipper" ? o.driverId! : o.shipperId;
  const vals = crit.map((c) => a.criteria[c.id]);
  const overall = vals.reduce((n, x) => n + x, 0) / vals.length;
  const other = s.reviews.find((r) => r.orderId === orderId && r.fromId === to);
  const r: Review = { id: uid(s, "rv"), orderId, fromId: personId, toId: to, fromRole: role, criteria: a.criteria, overall, comment: a.comment.trim(), photo: a.photo, at: now(s), revealed: !!other, moderation: "ok" };
  s.reviews.unshift(r);
  if (other) other.revealed = true; // both sides have spoken → both become visible
  if (role === "shipper") {
    const d = driverOf(s, to);
    if (d) d.clean.score = Math.round(d.clean.score * 0.8 + a.criteria.cleanliness * 20 * 0.2);
    if (a.criteria.cleanliness <= 2 && o.odor !== "NONE") d && (d.vehicle.lastCargoOdor = o.odor);
  } else {
    const sh = shipperOf(s, to);
    if (sh) sh.honesty = Math.round(sh.honesty * 0.8 + a.criteria.honesty * 20 * 0.2);
  }
  notify(s, to, role === "shipper" ? "driver" : "shipper", "review", other ? "نظرها آشکار شد؛ نظر طرف مقابل را ببینید." : "طرف مقابل نظر داده است؛ پس از ثبت نظر شما هر دو آشکار می‌شوند.", role === "shipper" ? `/driver/trip/?id=${orderId}` : `/app/order/?id=${orderId}`);
  return ok();
}

export function reportReview(s: State, reviewId: string): Result {
  const r = s.reviews.find((x) => x.id === reviewId);
  if (!r) return fail("نظر پیدا نشد.");
  r.moderation = "reported";
  return ok();
}

export function moderateReview(s: State, actor: Actor, reviewId: string, to: "ok" | "hidden"): Result {
  const r = s.reviews.find((x) => x.id === reviewId);
  if (!r) return fail("نظر پیدا نشد.");
  r.moderation = to;
  audit(s, actor, "review.moderate", to, r.id);
  return ok();
}

/* ───────────────────────── rules ───────────────────────── */

export const currentRule = (s: State, audience: "driver" | "shipper"): RuleDoc | undefined =>
  s.rules.filter((r) => r.audience === audience && !r.draft).sort((a, b) => b.version - a.version)[0] ?? s.rules.filter((r) => r.audience === audience).sort((a, b) => b.version - a.version)[0];

export function needsAcceptance(s: State, personId: string, audience: "driver" | "shipper") {
  const rule = currentRule(s, audience);
  if (!rule) return false;
  return !s.acceptances.some((a) => a.personId === personId && a.audience === audience && a.version >= rule.version);
}

export function acceptRules(s: State, personId: string, audience: "driver" | "shipper", meta: string): Result {
  const rule = currentRule(s, audience);
  if (!rule) return fail("متن قوانین پیدا نشد.");
  const a: RuleAcceptance = { personId, audience, version: rule.version, at: now(s), meta };
  s.acceptances.unshift(a);
  return ok();
}

export function publishRule(s: State, actor: Actor, audience: "driver" | "shipper", patch: { sections: RuleDoc["sections"]; keyPoints: RuleDoc["keyPoints"] }): Result {
  const cur = currentRule(s, audience);
  s.rules.unshift({ id: uid(s, "rule"), audience, version: (cur?.version ?? 0) + 1, publishedAt: now(s), draft: false, keyPoints: patch.keyPoints, sections: patch.sections });
  audit(s, actor, "rules.publish", `نسخه‌ی ${(cur?.version ?? 0) + 1} برای ${audience === "driver" ? "رانندگان" : "صاحبان بار"}`, audience);
  return ok();
}

/* ───────────────────────── support ───────────────────────── */

export const CHANNELS: Record<TicketChannel, { label: string; sla: number; hint: string }> = {
  trip: { label: "پشتیبانی سفر", sla: 30 * MIN, hint: "مشکل در سفارش یا سفر جاری؛ پاسخ معمولاً کمتر از ۳۰ دقیقه" },
  account: { label: "پشتیبانی حساب و احراز هویت", sla: 4 * HOUR, hint: "احراز هویت، مدارک، ورود و برنامه؛ پاسخ تا چند ساعت" },
  finance: { label: "پشتیبانی مالی و کیف پول", sla: 2 * HOUR, hint: "پرداخت، شارژ، برداشت و فاکتور؛ پاسخ تا ۲ ساعت" },
};

export const CATEGORIES: Record<TicketChannel, string[]> = {
  trip: ["تأخیر در تخصیص راننده", "مشکل در بارگیری", "مغایرت بار", "مشکل دمای بار", "تحویل و کد گیرنده", "حادثه یا خرابی", "رفتار طرف مقابل", "سایر"],
  account: ["احراز هویت و مدارک", "رد مدارک", "ورود و کد پیامکی", "تعلیق و تجدیدنظر", "ویرایش اطلاعات حساب", "مشکل برنامه", "سایر"],
  finance: ["پرداخت ناموفق ولی مبلغ کسر شد", "شارژ کیف پول اعمال نشد", "پیگیری بازپرداخت", "تأخیر یا ناموفق‌بودن برداشت", "کارمزد یا مبلغ اشتباه", "اعتراض به جریمه‌ی لغو", "انعام", "کد تخفیف اعمال نشد", "درخواست یا اصلاح فاکتور", "درخواست اعتبار سازمانی", "اختلاف پرداخت نقدی", "سؤال درباره‌ی بدهی کارمزد"],
};

export const MACROS: Record<TicketChannel, { id: string; title: string; text: string }[]> = {
  trip: [
    { id: "m1", title: "بررسی در حال انجام", text: "سلام، موضوع شما را بررسی می‌کنیم و تا چند دقیقه‌ی دیگر نتیجه را اعلام می‌کنیم." },
    { id: "m2", title: "تماس با راننده", text: "با راننده تماس گرفتیم و وضعیت را پیگیری می‌کنیم. لطفاً در دسترس باشید." },
    { id: "m3", title: "اصلاح مغایرت", text: "مغایرت بار بررسی شد و بارنامه‌ی جدید صادر خواهد شد. ممنون از همکاری شما." },
  ],
  account: [
    { id: "a1", title: "مدارک ناخوانا", text: "تصویر مدرک شما خوانا نیست. لطفاً از قاب «راهنمای دوربین» دوباره عکس بگیرید." },
    { id: "a2", title: "عدم تطابق شناسه و سیم‌کارت", text: "سیم‌کارت باید به نام خودتان ثبت باشد. پس از اصلاح در اپراتور دوباره تلاش کنید." },
    { id: "a3", title: "تجدیدنظر تعلیق", text: "درخواست تجدیدنظر شما ثبت شد و ظرف ۴۸ ساعت نتیجه اعلام می‌شود." },
  ],
  finance: [
    { id: "f1", title: "برگشت وجه کسرشده", text: "وجه کسرشده معمولاً تا ۷۲ ساعت کاری به حساب شما برمی‌گردد؛ اگر برنگشت، شماره‌ی پیگیری را بفرستید." },
    { id: "f2", title: "توضیح صورت‌حساب", text: "صورت‌حساب شما را بررسی کردیم؛ جزئیات هر ردیف در بخش «کیف پول ← تراکنش‌ها» قابل مشاهده است." },
    { id: "f3", title: "اعمال شارژ", text: "رسید شما تأیید و مبلغ به کیف پول افزوده شد." },
    { id: "f4", title: "تأخیر برداشت", text: "برداشت شما در صف بررسی است و تا پایان روز کاری واریز می‌شود." },
  ],
};

const CHANNEL_ROLES: Record<TicketChannel, AdminRole[]> = { trip: ["support", "ops"], account: ["kyc", "support"], finance: ["wallet_support", "finance_op"] };

/** The agent who would pick up a new ticket on this channel right now: the least-loaded active specialist. */
export function agentFor(s: State, channel: TicketChannel): AdminUser | undefined {
  const pool = s.admins.filter((a) => a.active && CHANNEL_ROLES[channel].includes(a.role));
  const load = (a: AdminUser) => s.tickets.filter((t) => t.assignee === a.id && !["RESOLVED", "CLOSED"].includes(t.status)).length;
  return [...pool].sort((a, b) => load(a) - load(b) || a.id.localeCompare(b.id))[0];
}

export function openTicket(s: State, personId: string, portal: "shipper" | "driver", a: { channel: TicketChannel; category: string; subject: string; text: string; orderId?: string }): Result<{ id: string }> {
  if (!a.text.trim()) return fail("شرح مشکل را بنویسید.");
  const o = orderOf(s, a.orderId);
  const ctx: Record<string, string> = {};
  if (o) { ctx["سفارش"] = `${o.origin.city} ← ${o.dest.city}`; ctx["مرحله‌ی سفر"] = o.status; }
  if (a.channel === "finance") {
    const w = portal === "driver" ? driverWallet(s, personId) : shipperWallet(s, personId);
    ctx["موجودی"] = `${w.available / 10} تومان`;
    ctx["در انتظار"] = `${w.pending / 10} تومان`;
    if (w.debt) ctx["بدهی"] = `${w.debt / 10} تومان`;
    const last = s.payments.find((p) => p.payerId === personId);
    if (last) ctx["آخرین پرداخت"] = `${last.status} · ${last.amount / 10} تومان`;
  }
  if (a.channel === "account") {
    const d = driverOf(s, personId);
    if (d) ctx["وضعیت احراز"] = d.kyc.status;
  }
  const t: Ticket = {
    id: uid(s, "tk"), channel: a.channel, category: a.category, personId, portal, orderId: a.orderId, subject: a.subject || a.category, status: "OPEN",
    priority: a.channel === "trip" && (a.category.includes("حادثه") || a.category.includes("دما")) ? "high" : "normal", at: now(s), slaDueAt: now(s) + CHANNELS[a.channel].sla,
    messages: [{ from: "user", text: a.text.trim(), at: now(s) }, { from: "system", text: `درخواست شما ثبت شد. پاسخ‌گویی ${CHANNELS[a.channel].hint.split("؛")[1]?.trim() ?? "در اسرع وقت"}.`, at: now(s) }],
    context: ctx, linked: [],
  };
  const agent = agentFor(s, a.channel);
  if (agent) { t.assignee = agent.id; t.messages[1].text = `درخواست شما ثبت شد و به ${agent.name.replace(/\s*\(.*\)\s*/, "")} سپرده شد. پاسخ‌گویی ${CHANNELS[a.channel].hint.split("؛")[1]?.trim() ?? "در اسرع وقت"}.`; }
  s.tickets.unshift(t);
  return ok({ id: t.id });
}

export function replyTicket(s: State, id: string, from: "user" | "agent", text: string, by?: string): Result {
  const t = s.tickets.find((x) => x.id === id);
  if (!t || !text.trim()) return fail("پیام معتبر نیست.");
  if (t.status === "CLOSED") return fail("این تیکت بسته شده است.");
  t.messages.push({ from, by, text: text.trim(), at: now(s) });
  if (from === "agent") {
    if (t.status === "OPEN") t.status = "PENDING";
    notify(s, t.personId, t.portal, "support", "پاسخ جدید از پشتیبانی کامیونت", t.portal === "driver" ? "/driver/support/" : "/app/support/");
  } else if (t.status === "PENDING" || t.status === "RESOLVED") t.status = "OPEN";
  return ok();
}

export function setTicketStatus(s: State, actor: Actor, id: string, status: Ticket["status"]) {
  const t = s.tickets.find((x) => x.id === id);
  if (!t) return;
  t.status = status;
  audit(s, actor, "ticket.status", status, id);
}

export function assignTicket(s: State, actor: Actor, id: string, assignee: string) {
  const t = s.tickets.find((x) => x.id === id);
  if (!t) return;
  t.assignee = assignee;
  audit(s, actor, "ticket.assign", assignee, id);
}

export function rateTicket(s: State, id: string, csat: number): Result {
  const t = s.tickets.find((x) => x.id === id);
  if (!t || !["RESOLVED", "CLOSED"].includes(t.status)) return fail("پس از حل مشکل می‌توانید امتیاز دهید.");
  t.csat = csat;
  return ok();
}

/* ───────────────────────── appeals ───────────────────────── */

export function submitAppeal(s: State, driverId: string, text: string): Result {
  const d = driverOf(s, driverId);
  if (!d?.suspension) return fail("حساب شما معلق نیست.");
  if (d.suspension.appeal === "open") return fail("درخواست تجدیدنظر شما در حال بررسی است.");
  if (text.trim().length < 10) return fail("دلیل اعتراض را کامل‌تر بنویسید.");
  d.suspension.appeal = "open";
  d.suspension.appealText = text.trim();
  openTicket(s, driverId, "driver", { channel: "account", category: "تعلیق و تجدیدنظر", subject: "درخواست تجدیدنظر تعلیق", text });
  return ok();
}

void bal;
void A;
void DAY;
void person;
void actorPerson;
void cv;
