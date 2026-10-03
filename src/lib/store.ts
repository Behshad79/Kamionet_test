"use client";

import { useSyncExternalStore } from "react";
import { adminActor } from "./engine/admin";
import { ensureDriver, ensureShipper } from "./engine/profiles";
import { engineTick, tickDue } from "./engine/orders";
import { markOverdue } from "./engine/payout";
import { audit, uid, type Result, fail, ok } from "./engine/core";
import { EMPTY_STATE } from "./seedBase";
import { buildSeed } from "./seed";
import { normalizeDigits } from "./money";
import type { PortalId, SessionInfo, State } from "./types";

/**
 * In-browser mock backend (see DECISIONS.md #2).
 * Every action re-reads the shared blob, applies the change on a clone and writes it back, so two
 * tabs behave like two clients on one database. Sessions are per portal and per tab.
 */

const DATA_KEY = "kamionet:v3";
const sessKey = (p: PortalId) => `kamionet:sess:${p}`;
export const OTP_CODE = "12345";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "0";
export const PORTAL_HOME: Record<PortalId, string> = { shipper: "/app/", driver: "/driver/", admin: "/admin/" };
export const PORTAL_LOGIN: Record<PortalId, string> = { shipper: "/app/login/", driver: "/driver/login/", admin: "/admin/login/" };

let state: State = EMPTY_STATE;
let persistFailed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

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
    const { session: _s, _now, ready: _r, ...rest } = s;
    void _s; void _now; void _r;
    localStorage.setItem(DATA_KEY, JSON.stringify(rest));
    persistFailed = false;
  } catch {
    persistFailed = true; // storage full: keep working in memory
  }
}

function readSessions(): Record<PortalId, SessionInfo> {
  const out: Record<PortalId, SessionInfo> = { shipper: {}, driver: {}, admin: {} };
  for (const p of ["shipper", "driver", "admin"] as PortalId[]) {
    try {
      const raw = sessionStorage.getItem(sessKey(p)) ?? localStorage.getItem(sessKey(p));
      if (raw) out[p] = JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return out;
}

function writeSession(p: PortalId, info: SessionInfo) {
  try {
    const raw = JSON.stringify(info);
    sessionStorage.setItem(sessKey(p), raw);
    localStorage.setItem(sessKey(p), raw);
  } catch { /* ignore */ }
}

function clearSession(p: PortalId) {
  try {
    sessionStorage.removeItem(sessKey(p));
    localStorage.removeItem(sessKey(p));
  } catch { /* ignore */ }
}

export function hydrate() {
  if (state.ready || typeof window === "undefined") return;
  const blob = readBlob();
  const fresh = blob && blob.version === EMPTY_STATE.version ? blob : buildSeed();
  state = { ...fresh, ready: true, session: readSessions() };
  writeBlob(state);
  emit();
  window.addEventListener("storage", (e) => {
    if (e.key !== DATA_KEY) return;
    const b = readBlob();
    if (b) {
      state = { ...b, ready: true, session: state.session };
      emit();
    }
  });
}

/** Run one atomic action. The draft is a deep clone; throw-free actions return Result. */
export function act<T>(fn: (s: State) => T): T {
  const fresh = readBlob();
  const base = fresh ? { ...fresh, ready: true, session: state.session } : state;
  const draft = structuredClone(base) as State;
  if (tickDue(draft)) engineTick(draft);
  const out = fn(draft);
  state = draft;
  writeBlob(draft);
  emit();
  return out;
}

export function tick() {
  if (!state.ready) return;
  if (tickDue(state) || state.invoices.some((i) => i.status === "ISSUED" && i.dueAt && i.dueAt < Date.now() && i.kind === "tax_invoice")) {
    act((s) => { engineTick(s); markOverdue(s); });
  }
}

/* ───────────────────────── authentication (per portal) ───────────────────────── */

export function normalizePhone(raw: string) {
  const p = normalizeDigits(raw).replace(/\D/g, "");
  if (/^989\d{9}$/.test(p)) return "0" + p.slice(2);
  if (/^9\d{9}$/.test(p)) return "0" + p;
  return p;
}

export function loginPerson(portal: "shipper" | "driver", phoneRaw: string, code: string, name?: string): Result<{ isNew: boolean }> {
  const phone = normalizePhone(phoneRaw);
  if (!/^09\d{9}$/.test(phone)) return fail("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷");
  if (normalizeDigits(code) !== OTP_CODE) return fail("کد تأیید اشتباه است.");
  if (state.admins.some((a) => a.phone === phone)) return fail("این شماره متعلق به تیم مدیریت است؛ از ورودی «مدیریت» وارد شوید.");
  return act((s) => {
    let p = s.persons.find((x) => x.phone === phone);
    const isNew = !p;
    if (!p) {
      p = { id: uid(s, "p"), phone, name: name?.trim() || "کاربر جدید", createdAt: Date.now() };
      s.persons.push(p);
    } else if (name?.trim() && p.name === "کاربر جدید") p.name = name.trim();
    if (portal === "shipper") { const sh = ensureShipper(s, p.id); if (name?.trim() && sh.displayName === "کاربر جدید") { sh.displayName = name.trim(); sh.completeness.name = true; } }
    else ensureDriver(s, p.id);
    s.session = { ...s.session, [portal]: { personId: p.id } };
    writeSession(portal, { personId: p.id });
    return ok({ isNew });
  });
}

export function loginAdmin(phoneRaw: string, code: string): Result {
  const phone = normalizePhone(phoneRaw);
  if (normalizeDigits(code) !== OTP_CODE) return fail("کد تأیید اشتباه است.");
  return act((s) => {
    const a = s.admins.find((x) => x.phone === phone && x.active);
    if (!a) return fail("این شماره مجاز به ورود به مدیریت نیست.");
    s.session = { ...s.session, admin: { adminId: a.id } };
    writeSession("admin", { adminId: a.id });
    a.devices = [{ id: uid(s, "dv"), label: "مرورگر فعلی", lastAt: Date.now(), current: true }, ...a.devices.filter((d) => !d.current)].slice(0, 5);
    audit(s, adminActor(s, a.id), "login", "ورود به کنسول مدیریت");
    return ok();
  });
}

export function logout(portal: PortalId) {
  clearSession(portal);
  state = { ...state, session: { ...state.session, [portal]: {} } };
  emit();
}

/** Demo drawer: sign out of the current portal session and into the chosen account. */
export function demoSignIn(portal: PortalId, phone: string): Result {
  logout(portal);
  return portal === "admin" ? loginAdmin(phone, OTP_CODE) : loginPerson(portal, phone, OTP_CODE);
}

export function resetDemo() {
  const sessions = state.session;
  state = { ...buildSeed(), ready: true, session: sessions };
  writeBlob(state);
  emit();
}

/* ───────────────────────── hooks ───────────────────────── */

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY_STATE);
}

export const storageFailed = () => persistFailed;
