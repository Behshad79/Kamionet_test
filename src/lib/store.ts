"use client";

import { useSyncExternalStore } from "react";
import { MATCH_FAIL_TEXT, matchVehicle, standing } from "./matching";
import { cityPlace, roadKm } from "./geo";
import { cancelFeeFor, insuranceFee } from "./pricing";
import { tempClassLabel, tempRange, VEHICLE_CAPACITY } from "./format";
import { ADMIN_PHONE, buildSeed, EMPTY_STATE } from "./seed";
import type {
  CargoType, Config, DocFile, DocKey, DriverProfile, Media, Order, Payment, Place, RateEntry, Role, Session, State, Template, User, Vehicle, VehicleType,
} from "./types";

/**
 * In-browser mock backend.
 *
 * Every action re-reads the shared blob from localStorage, applies the change
 * on a clone and writes it back, so two tabs behave like two clients hitting
 * one database: the first `claimOrder` wins and the other gets an error plus a
 * live update through the `storage` event. Session lives per-tab so two tabs
 * can be two different users.
 */

const DATA_KEY = "kamionet:v2";
const SESSION_KEY = "kamionet:session";
export const OTP_CODE = "12345";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

let state: State = EMPTY_STATE;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

function readBlob(): State | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

function writeBlob(s: State) {
  try {
    const { session: _s, ...rest } = s;
    void _s;
    localStorage.setItem(DATA_KEY, JSON.stringify(rest));
  } catch {
    /* quota exceeded: keep in-memory state only */
  }
}

function readSession(): Session {
  const fallback: Session = { userId: null, role: "shipper", admin: false };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(sess: Session) {
  try {
    const raw = JSON.stringify(sess);
    sessionStorage.setItem(SESSION_KEY, raw);
    localStorage.setItem(SESSION_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function hydrate() {
  if (state.ready || typeof window === "undefined") return;
  const blob = readBlob() ?? buildSeed();
  state = { ...blob, session: readSession(), ready: true };
  writeBlob(state);
  emit();
  window.addEventListener("storage", (e) => {
    if (e.key !== DATA_KEY) return;
    const b = readBlob();
    if (b) {
      state = { ...b, session: state.session, ready: true };
      emit();
    }
  });
}

function mutate<T>(fn: (s: State) => T): T {
  const fresh = readBlob();
  const base = fresh ? { ...fresh, session: state.session, ready: true } : state;
  const draft = structuredClone(base) as State;
  reap(draft, Date.now());
  const out = fn(draft);
  state = draft;
  writeBlob(draft);
  emit();
  return out;
}

const me = (s: State) => s.users.find((u) => u.id === s.session.userId);
const notify = (s: State, userId: string, text: string, href?: string) =>
  s.notifications.unshift({ id: uid("n"), userId, text, href, at: Date.now(), read: false });

function ensureDriver(s: State, userId: string): DriverProfile {
  let p = s.drivers.find((d) => d.userId === userId);
  if (!p) {
    p = {
      userId,
      kyc: "none",
      vehicle: { type: "khavar", plate: "", fridgeBrand: "", minTemp: 0, capacityKg: VEHICLE_CAPACITY.khavar },
      docs: {},
    };
    s.drivers.push(p);
  }
  return p;
}

/* ───────── Time-driven transitions ───────── */

const HOUR = 3_600_000;
const STEP = { daily: 24 * HOUR, weekly: 7 * 24 * HOUR };
const SPAWN_AHEAD = 12 * HOUR;

function reap(s: State, now: number): boolean {
  let changed = false;
  for (const o of s.orders) {
    if (o.status === "LOCKED" && (o.lockedUntil ?? 0) <= now) {
      if (o.lockedBy) notify(s, o.lockedBy, "مهلت تأیید سفارش تمام شد و سفارش دوباره آزاد شد.");
      o.status = "OPEN";
      o.lockedBy = undefined;
      o.lockedUntil = undefined;
      changed = true;
    }
    if (o.status === "OPEN" && o.pickupAt < now - 2 * HOUR) {
      o.status = "EXPIRED";
      changed = true;
    }
  }
  for (const t of s.templates) {
    while (t.active && t.nextRunAt - SPAWN_AHEAD <= now) {
      spawnFromTemplate(s, t);
      changed = true;
    }
  }
  return changed;
}

function needsTick(s: State, now: number) {
  return (
    s.orders.some(
      (o) => (o.status === "LOCKED" && (o.lockedUntil ?? 0) <= now) || (o.status === "OPEN" && o.pickupAt < now - 2 * HOUR),
    ) || s.templates.some((t) => t.active && t.nextRunAt - SPAWN_AHEAD <= now)
  );
}

export function tick() {
  if (state.ready && needsTick(state, Date.now())) mutate(() => undefined);
}

/* ───────── Orders ───────── */

export interface OrderInput {
  origin: Place;
  dest: Place;
  pickupAt: number;
  pickupTo: number;
  deliverBy: number;
  count: number;
  cargo: CargoType;
  tempMin: number;
  tempMax: number;
  vehicleType: VehicleType;
  weightKg: number;
  pallets?: number;
  volumeM3?: number;
  declaredValue: number;
  price: number;
  payment: Payment;
  insurance: boolean;
  note?: string;
}

function insertOrders(s: State, shipperId: string, input: OrderInput, templateId?: string) {
  const insured = s.config.insuranceMode === "mandatory" ? true : input.insurance;
  const groupId = uid("g");
  // One distance for the whole life of the order, from the real pickup/drop points.
  const distanceKm = roadKm(input.origin, input.dest);
  const created: Order[] = [];
  for (let i = 1; i <= input.count; i++) {
    created.push({
      id: uid("o"),
      groupId,
      groupIndex: i,
      groupSize: input.count,
      shipperId,
      status: "OPEN",
      origin: input.origin,
      dest: input.dest,
      pickupAt: input.pickupAt,
      pickupTo: input.pickupTo,
      deliverBy: input.deliverBy,
      cargo: input.cargo,
      tempMin: input.tempMin,
      tempMax: input.tempMax,
      vehicleType: input.vehicleType,
      weightKg: input.weightKg,
      pallets: input.pallets,
      volumeM3: input.volumeM3,
      declaredValue: input.declaredValue,
      price: input.price,
      payment: input.payment,
      insurance: insured,
      // Premium is a share of the declared cargo value, never of the fare.
      insuranceFee: insured ? insuranceFee(input.declaredValue, s.config) : 0,
      distanceKm,
      note: input.note,
      createdAt: Date.now(),
      media: [],
      templateId,
    });
  }
  s.orders.unshift(...created);
  // Notify verified drivers whose vehicle (type, payload AND fridge) fits.
  for (const d of s.drivers) {
    if (d.userId === shipperId || standing(d) !== "verified" || !matchVehicle(d.vehicle, input).ok) continue;
    notify(
      s,
      d.userId,
      `سفارش جدید: ${input.origin.city} ← ${input.dest.city} · ${tempClassLabel(input.tempMin, input.tempMax)} ${tempRange(input.tempMin, input.tempMax)}`,
      `/driver/order/?id=${created[0].id}`,
    );
  }
  return created;
}

function spawnFromTemplate(s: State, t: Template) {
  const d = t.draft;
  insertOrders(
    s,
    t.shipperId,
    {
      origin: d.origin, dest: d.dest, pickupAt: t.nextRunAt, pickupTo: t.nextRunAt + t.windowMs, deliverBy: t.nextRunAt + t.deliverAfterMs,
      count: 1, cargo: d.cargo, tempMin: d.tempMin, tempMax: d.tempMax, vehicleType: d.vehicleType, weightKg: d.weightKg,
      pallets: d.pallets, volumeM3: d.volumeM3, declaredValue: d.declaredValue, price: d.price, payment: d.payment,
      insurance: d.insurance, note: d.note,
    },
    t.id,
  );
  t.nextRunAt += STEP[t.cadence];
}

export function login(phoneRaw: string, code: string, name?: string): Result<{ admin: boolean }> {
  const phone = phoneRaw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
  if (!/^09\d{9}$/.test(phone)) return fail("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷");
  if (code !== OTP_CODE) return fail("کد تأیید اشتباه است.");
  return mutate((s) => {
    if (phone === ADMIN_PHONE) {
      s.session = { userId: null, role: "shipper", admin: true };
      writeSession(s.session);
      return { ok: true as const, admin: true };
    }
    let u = s.users.find((x) => x.phone === phone);
    if (!u) {
      u = { id: uid("u"), phone, name: name?.trim() || "کاربر جدید", createdAt: Date.now() };
      s.users.push(u);
    } else if (name?.trim() && u.name === "کاربر جدید") u.name = name.trim();
    s.session = { userId: u.id, role: s.session.role, admin: false };
    writeSession(s.session);
    return { ok: true as const, admin: false };
  });
}

export function logout() {
  mutate((s) => {
    s.session = { userId: null, role: "shipper", admin: false };
    writeSession(s.session);
  });
}

export function switchRole(role: Role) {
  mutate((s) => {
    s.session = { ...s.session, role };
    writeSession(s.session);
  });
}

export function updateName(name: string) {
  mutate((s) => {
    const u = me(s);
    if (u) u.name = name.trim() || u.name;
  });
}

export function createOrders(input: OrderInput): Result<{ id: string; count: number }> {
  return mutate((s) => {
    const u = me(s);
    if (!u) return fail("ابتدا وارد حساب شوید.");
    if (input.origin.city === input.dest.city && input.origin.address === input.dest.address) return fail("مبدأ و مقصد نمی‌توانند یکسان باشند.");
    if (input.price < 500_000) return fail("مبلغ پیشنهادی معتبر نیست.");
    if (!(input.declaredValue >= 1_000_000)) return fail("ارزش اعلامی بار را وارد کنید.");
    if (!(input.weightKg > 0) || input.weightKg > VEHICLE_CAPACITY[input.vehicleType]) return fail("وزن بار با ظرفیت خودروی انتخابی نمی‌خواند.");
    if (input.tempMin > input.tempMax) return fail("بازه‌ی دمایی معتبر نیست.");
    if (input.pickupTo <= input.pickupAt || input.deliverBy <= input.pickupTo) return fail("بازه‌ی بارگیری و مهلت تحویل را بررسی کنید.");
    const created = insertOrders(s, u.id, input);
    return { ok: true as const, id: created[0].id, count: created.length };
  });
}

/** Atomic soft-lock. Only the first caller gets OPEN → LOCKED. */
export function claimOrder(orderId: string): Result {
  return mutate((s): Result => {
    const u = me(s);
    if (!u) return fail("ابتدا وارد حساب شوید.");
    if (s.session.role !== "driver") return fail("برای انتخاب سفارش باید در نقش راننده باشید.");
    const o = s.orders.find((x) => x.id === orderId);
    if (!o) return fail("سفارش پیدا نشد.");
    if (o.shipperId === u.id) return fail("شما نمی‌توانید سفارش ثبت‌شده‌ی خودتان را انتخاب کنید.");
    const p = s.drivers.find((d) => d.userId === u.id);
    if (standing(p) !== "verified") return fail("حساب راننده‌ی شما هنوز تأیید نشده یا معلق است.");
    const m = matchVehicle(p!.vehicle, o);
    if (!m.ok) return fail(MATCH_FAIL_TEXT[m.why]);
    if (s.orders.some((x) => x.status === "LOCKED" && x.lockedBy === u.id)) return fail("یک سفارش در انتظار تأیید شماست؛ ابتدا آن را نهایی یا رها کنید.");
    if (o.status !== "OPEN") return fail("این سفارش هم‌اکنون به راننده دیگری اختصاص یافته است.");
    o.status = "LOCKED";
    o.lockedBy = u.id;
    o.lockedUntil = Date.now() + s.config.lockSeconds * 1000;
    return { ok: true };
  });
}

export function releaseLock(orderId: string): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.status !== "LOCKED" || o.lockedBy !== s.session.userId) return fail("قفلی برای رها کردن وجود ندارد.");
    o.status = "OPEN";
    o.lockedBy = undefined;
    o.lockedUntil = undefined;
    return { ok: true };
  });
}

export function confirmAssign(orderId: string): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o) return fail("سفارش پیدا نشد.");
    if (o.status !== "LOCKED" || o.lockedBy !== s.session.userId) return fail("مهلت تأیید به پایان رسید و سفارش آزاد شد.");
    if (o.shipperId === o.lockedBy) return fail("تخصیص به صاحب سفارش ممکن نیست.");
    o.status = "ASSIGNED";
    o.driverId = o.lockedBy;
    o.assignedAt = Date.now();
    o.lockedBy = undefined;
    o.lockedUntil = undefined;
    const n = s.orders.filter((x) => x.waybillNo).length + 1;
    o.waybillNo = `KM-${new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(1404000 + n)}`;
    const d = s.users.find((x) => x.id === o.driverId);
    notify(s, o.shipperId, `راننده برای سفارش ${o.origin.city} ← ${o.dest.city} تعیین شد: ${d?.name}`, `/shipper/order/?id=${o.id}`);
    return { ok: true };
  });
}

export function driverDrop(orderId: string): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.status !== "ASSIGNED" || o.driverId !== s.session.userId) return fail("امکان انصراف وجود ندارد.");
    notify(s, o.shipperId, `راننده از سفارش ${o.origin.city} ← ${o.dest.city} انصراف داد؛ سفارش دوباره باز شد.`, `/shipper/order/?id=${o.id}`);
    o.status = "OPEN";
    o.driverId = undefined;
    o.assignedAt = undefined;
    o.waybillNo = undefined;
    return { ok: true };
  });
}

export function startTrip(orderId: string, cargo: Media, invoice: Media): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.status !== "ASSIGNED" || o.driverId !== s.session.userId) return fail("شروع سفر برای این سفارش ممکن نیست.");
    o.media.push(cargo, invoice);
    o.status = "IN_TRANSIT";
    o.startedAt = Date.now();
    notify(s, o.shipperId, `بار شما ${o.origin.city} ← ${o.dest.city} بارگیری شد و در مسیر است.`, `/shipper/order/?id=${o.id}`);
    return { ok: true };
  });
}

export function deliver(orderId: string, invoice: Media): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.status !== "IN_TRANSIT" || o.driverId !== s.session.userId) return fail("ثبت تحویل برای این سفارش ممکن نیست.");
    o.media.push(invoice);
    const pickup = o.media.find((m) => m.kind === "invoice_pickup");
    if (pickup?.items !== undefined && invoice.items !== undefined && pickup.items !== invoice.items) {
      o.flag = {
        note: `مغایرت خودکار: ${pickup.items} قلم در مبدأ، ${invoice.items} قلم در مقصد`,
        by: "system",
        at: Date.now(),
        status: "open",
      };
    }
    o.status = "DELIVERED";
    o.deliveredAt = Date.now();
    notify(s, o.shipperId, `بار شما در ${o.dest.city} تحویل شد. لطفاً به راننده امتیاز دهید.`, `/shipper/order/?id=${o.id}`);
    return { ok: true };
  });
}

export function cancelOrder(orderId: string, reason: string): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.shipperId !== s.session.userId) return fail("دسترسی ندارید.");
    if (!["OPEN", "LOCKED", "ASSIGNED"].includes(o.status)) return fail("در این مرحله امکان لغو وجود ندارد.");
    const other = o.driverId ?? o.lockedBy;
    if (other) notify(s, other, `سفارش ${o.origin.city} ← ${o.dest.city} توسط صاحب بار لغو شد.`);
    // Free before a driver is committed; a fee applies once one is assigned.
    if (o.status === "ASSIGNED") o.cancelFee = cancelFeeFor(o.price, s.config);
    o.status = "CANCELLED";
    o.cancelReason = reason;
    o.lockedBy = undefined;
    o.lockedUntil = undefined;
    return { ok: true };
  });
}

export function reportMismatch(orderId: string, note: string): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    const uid_ = s.session.userId;
    if (!o || (o.shipperId !== uid_ && o.driverId !== uid_)) return fail("دسترسی ندارید.");
    o.flag = { note, by: uid_!, at: Date.now(), status: "open" };
    return { ok: true };
  });
}

export function resolveFlag(orderId: string) {
  mutate((s) => {
    const o = s.orders.find((x) => x.id === orderId);
    if (o?.flag) o.flag.status = "resolved";
  });
}

export function rate(orderId: string, stars: number, comment: string): Result {
  return mutate((s): Result => {
    const o = s.orders.find((x) => x.id === orderId);
    const me_ = s.session.userId;
    if (!o || o.status !== "DELIVERED" || !me_) return fail("امتیازدهی فقط پس از تحویل ممکن است.");
    if (o.shipperId !== me_ && o.driverId !== me_) return fail("دسترسی ندارید.");
    if (s.ratings.some((r) => r.orderId === orderId && r.from === me_)) return fail("قبلاً امتیاز داده‌اید.");
    const to = o.shipperId === me_ ? o.driverId! : o.shipperId;
    s.ratings.push({ orderId, from: me_, to, stars, comment, at: Date.now() });
    return { ok: true };
  });
}

/* ───────── Recurring templates ───────── */

export function createTemplate(input: OrderInput, cadence: "daily" | "weekly", hour: number): Result {
  return mutate((s): Result => {
    const u = me(s);
    if (!u) return fail("ابتدا وارد حساب شوید.");
    const first = new Date();
    first.setHours(hour, 0, 0, 0);
    if (first.getTime() <= Date.now()) first.setDate(first.getDate() + 1);
    s.templates.push({
      id: uid("t"),
      shipperId: u.id,
      cadence,
      hour,
      active: true,
      nextRunAt: first.getTime(),
      windowMs: input.pickupTo - input.pickupAt,
      deliverAfterMs: input.deliverBy - input.pickupAt,
      draft: {
        shipperId: u.id, origin: input.origin, dest: input.dest, cargo: input.cargo, tempMin: input.tempMin, tempMax: input.tempMax,
        vehicleType: input.vehicleType, weightKg: input.weightKg, pallets: input.pallets, volumeM3: input.volumeM3,
        declaredValue: input.declaredValue, price: input.price, payment: input.payment, insurance: input.insurance,
        insuranceFee: 0, distanceKm: roadKm(input.origin, input.dest), note: input.note,
      },
    });
    return { ok: true };
  });
}

export function toggleTemplate(id: string) {
  mutate((s) => {
    const t = s.templates.find((x) => x.id === id);
    if (t) t.active = !t.active;
  });
}

export function deleteTemplate(id: string) {
  mutate((s) => {
    s.templates = s.templates.filter((t) => t.id !== id);
  });
}

export function runTemplateNow(id: string) {
  mutate((s) => {
    const t = s.templates.find((x) => x.id === id);
    if (t) spawnFromTemplate(s, t);
  });
}

/* ───────── Driver KYC ───────── */

export function saveDriver(patch: { vehicle?: Partial<Vehicle>; docs?: Partial<Record<DocKey, DocFile>> }) {
  mutate((s) => {
    const u = me(s);
    if (!u) return;
    const p = ensureDriver(s, u.id);
    if (p.kyc === "none" || p.kyc === "rejected") p.kyc = "draft";
    if (patch.vehicle) p.vehicle = { ...p.vehicle, ...patch.vehicle };
    if (patch.docs) for (const [k, v] of Object.entries(patch.docs)) p.docs[k as DocKey] = { ...p.docs[k as DocKey], ...v };
  });
}

export const REQUIRED_DOCS: DocKey[] = [
  "nationalFront", "nationalBack", "license", "smartCard", "selfie",
  "regFront", "regBack", "insurance", "inspection", "carExterior", "carInterior",
];

export function submitKyc(): Result {
  return mutate((s): Result => {
    const u = me(s);
    if (!u) return fail("ابتدا وارد حساب شوید.");
    const p = ensureDriver(s, u.id);
    const missing = REQUIRED_DOCS.filter((k) => !p.docs[k]?.dataUrl);
    if (missing.length) return fail("همه‌ی مدارک باید بارگذاری شوند.");
    if (!p.docs.insurance?.expiresAt || !p.docs.inspection?.expiresAt) return fail("تاریخ انقضای بیمه و معاینه فنی را وارد کنید.");
    if (!p.vehicle.plate || !p.vehicle.fridgeBrand) return fail("مشخصات خودرو و یخچال را کامل کنید.");
    p.kyc = "pending";
    p.rejectReason = undefined;
    p.submittedAt = Date.now();
    return { ok: true };
  });
}

export function reviewKyc(userId: string, approve: boolean, reason?: string) {
  mutate((s) => {
    const p = s.drivers.find((d) => d.userId === userId);
    if (!p) return;
    p.kyc = approve ? "verified" : "rejected";
    p.rejectReason = approve ? undefined : reason;
    notify(
      s,
      userId,
      approve ? "مدارک شما تأیید شد؛ اکنون می‌توانید سفارش انتخاب کنید." : `مدارک شما نیاز به اصلاح دارد: ${reason ?? ""}`,
      "/driver/",
    );
  });
}

/* ───────── Support ───────── */

export function createTicket(subject: string, text: string, orderId?: string) {
  mutate((s) => {
    const u = me(s);
    if (!u) return;
    s.tickets.unshift({ id: uid("t"), userId: u.id, orderId, subject, status: "open", messages: [{ from: "user", text, at: Date.now() }] });
  });
}

export function addTicketMsg(id: string, text: string, from: "user" | "admin") {
  mutate((s) => {
    const t = s.tickets.find((x) => x.id === id);
    if (!t) return;
    t.messages.push({ from, text, at: Date.now() });
    if (from === "admin") notify(s, t.userId, "پاسخ جدید از پشتیبانی کامیونت", "/support/");
  });
}

export function closeTicket(id: string) {
  mutate((s) => {
    const t = s.tickets.find((x) => x.id === id);
    if (t) t.status = "closed";
  });
}

export function markNotificationsRead() {
  mutate((s) => {
    for (const n of s.notifications) if (n.userId === s.session.userId) n.read = true;
  });
}

/* ───────── Admin ───────── */

export function setConfig(patch: Partial<Config>) {
  mutate((s) => {
    s.config = { ...s.config, ...patch };
  });
}

export function upsertRate(r: Omit<RateEntry, "id"> & { id?: string }) {
  mutate((s) => {
    const i = r.id ? s.rates.findIndex((x) => x.id === r.id) : -1;
    if (i >= 0) s.rates[i] = { ...s.rates[i], ...r } as RateEntry;
    else s.rates.push({ ...r, id: uid("r") });
  });
}

export function deleteRate(id: string) {
  mutate((s) => {
    s.rates = s.rates.filter((r) => r.id !== id);
  });
}

/* ───────── Demo helpers (prototype only) ───────── */

const DEMO_ROUTES: { a: string; b: string; cargo: CargoType; temp: [number, number]; vehicle: VehicleType; kg: number; value: number }[] = [
  { a: "تهران", b: "ساری", cargo: "dairy", temp: [0, 4], vehicle: "truck10", kg: 7000, value: 500_000_000 },
  { a: "اصفهان", b: "یزد", cargo: "icecream", temp: [-25, -18], vehicle: "truck10", kg: 8000, value: 700_000_000 },
  { a: "مشهد", b: "گرگان", cargo: "meat", temp: [-2, 2], vehicle: "khavar", kg: 3500, value: 380_000_000 },
  { a: "شیراز", b: "بوشهر", cargo: "pharma", temp: [2, 8], vehicle: "pickup", kg: 500, value: 4_000_000_000 },
  { a: "تبریز", b: "ارومیه", cargo: "dairy", temp: [1, 5], vehicle: "khavar", kg: 3000, value: 200_000_000 },
  { a: "قزوین", b: "همدان", cargo: "other", temp: [8, 15], vehicle: "khavar", kg: 2500, value: 150_000_000 },
];

export function demoSpawnOrder() {
  mutate((s) => {
    const r = DEMO_ROUTES[Math.floor(Math.random() * DEMO_ROUTES.length)];
    const shipper = ["u-shipper1", "u-shipper2", "u-shipper3"][Math.floor(Math.random() * 3)];
    const at = Date.now() + (3 + Math.random() * 20) * HOUR;
    insertOrders(s, shipper, {
      origin: cityPlace(r.a, "انبار مرکزی"), dest: cityPlace(r.b, "بازار عمده"), pickupAt: at, pickupTo: at + 2 * HOUR, deliverBy: at + 14 * HOUR,
      count: 1, cargo: r.cargo, tempMin: r.temp[0], tempMax: r.temp[1], vehicleType: r.vehicle, weightKg: r.kg, declaredValue: r.value,
      price: Math.round(((6 + Math.random() * 14) * 1_000_000) / 500_000) * 500_000, payment: { method: "prepaid" }, insurance: Math.random() > 0.5,
    });
  });
}

export function demoRivalClaim(orderId?: string): boolean {
  return mutate((s) => {
    const open = s.orders.filter((o) => o.status === "OPEN" && o.shipperId !== s.session.userId);
    const o = orderId ? s.orders.find((x) => x.id === orderId && x.status === "OPEN") : open[Math.floor(Math.random() * open.length)];
    if (!o) return false;
    const rival = s.drivers.find((d) => ["u-driver1", "u-driver2"].includes(d.userId) && matchVehicle(d.vehicle, o).ok);
    if (!rival) return false;
    o.status = "ASSIGNED";
    o.driverId = rival.userId;
    o.assignedAt = Date.now();
    o.waybillNo = `KM-${new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(1405000 + s.orders.length)}`;
    return true;
  });
}

export function demoApproveMe() {
  mutate((s) => {
    const u = me(s);
    if (!u) return;
    const p = ensureDriver(s, u.id);
    p.kyc = "verified";
    if (!p.vehicle.plate) p.vehicle = { type: "truck10", plate: "۲۲ ص ۵۵۵ ایران ۱۰", fridgeBrand: "Thermo King", minTemp: -20, capacityKg: VEHICLE_CAPACITY.truck10 };
    p.docs.insurance = { ...p.docs.insurance, expiresAt: p.docs.insurance?.expiresAt ?? Date.now() + 200 * 86_400_000 };
    p.docs.inspection = { ...p.docs.inspection, expiresAt: p.docs.inspection?.expiresAt ?? Date.now() + 200 * 86_400_000 };
  });
}

export function demoExpireInsurance() {
  mutate((s) => {
    const u = me(s);
    if (!u) return;
    const p = ensureDriver(s, u.id);
    p.docs.insurance = { ...p.docs.insurance, expiresAt: Date.now() - 86_400_000 };
  });
}

export function demoReset() {
  const sess = state.session;
  const seed = buildSeed();
  state = { ...seed, session: sess.admin ? sess : { userId: null, role: "shipper", admin: false } };
  writeSession(state.session);
  writeBlob(state);
  emit();
}

/* ───────── Hooks ───────── */

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY_STATE);
}

export type { User };
