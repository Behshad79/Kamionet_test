import { cv } from "../config";
import type { AdminUser, DriverProfile, Order, OrderStatus, Person, PortalId, ShipperProfile, State } from "../types";

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
export const ok = <T extends object = object>(x?: T): { ok: true } & T => ({ ok: true as const, ...((x ?? {}) as T) });
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export const now = (s: State) => s._now ?? Date.now();
export const uid = (s: State, p: string) => `${p}-${(++s.seq).toString(36)}`;
export { cv };

export const person = (s: State, id: string | undefined): Person | undefined => (id ? s.persons.find((p) => p.id === id) : undefined);
export const shipperOf = (s: State, id: string | undefined): ShipperProfile | undefined => (id ? s.shippers.find((p) => p.personId === id) : undefined);
export const driverOf = (s: State, id: string | undefined): DriverProfile | undefined => (id ? s.drivers.find((p) => p.personId === id) : undefined);
export const adminOf = (s: State, id: string | undefined): AdminUser | undefined => (id ? s.admins.find((p) => p.id === id) : undefined);
export const orderOf = (s: State, id: string | undefined): Order | undefined => (id ? s.orders.find((o) => o.id === id) : undefined);
export const nameOf = (s: State, id: string | undefined) => person(s, id)?.name ?? "—";

export interface Actor {
  type: "admin" | "system" | "person";
  id: string;
  label: string;
}
export const SYSTEM: Actor = { type: "system", id: "system", label: "سیستم" };
export const actorPerson = (s: State, id: string): Actor => ({ type: "person", id, label: nameOf(s, id) });

export function notify(s: State, personId: string, portal: PortalId, kind: string, text: string, href?: string) {
  s.notifications.unshift({ id: uid(s, "n"), personId, portal, kind, text, href, at: now(s), read: false });
  if (s.notifications.length > 1500) s.notifications.length = 1500;
}

export function audit(s: State, actor: Actor, action: string, detail: string, target?: string) {
  s.audit.unshift({ id: uid(s, "a"), at: now(s), actorType: actor.type, actorId: actor.id, actorLabel: actor.label, action, target, detail, ip: actor.type === "admin" ? "10.8.4." + (actor.id.length * 7 % 200 + 10) : undefined });
  if (s.audit.length > 4000) s.audit.length = 4000;
}

export function setStatus(s: State, o: Order, to: OrderStatus, by: Actor | string, note?: string) {
  const from = o.status;
  if (from === to) return;
  o.status = to;
  o.events.push({ at: now(s), from, to, by: typeof by === "string" ? by : by.label, note });
}

export const TERMINAL: OrderStatus[] = ["COMPLETED", "CANCELLED_BY_SHIPPER", "CANCELLED_BY_DRIVER", "CANCELLED_BY_SYSTEM", "EXPIRED"];
export const ACTIVE_TRIP: OrderStatus[] = ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW", "IN_TRANSIT", "AT_DELIVERY"];
export const BOARD: OrderStatus[] = ["OPEN", "PRO_POOL"];
export const PRE_ASSIGN: OrderStatus[] = ["OPEN", "PRO_POOL", "DIRECT_REQUESTED", "LOCKED", "AWAITING_DEPOSIT"];
export const isTerminal = (st: OrderStatus) => TERMINAL.includes(st);

export const paidTotal = (o: Order) => o.paid.insurance + o.paid.vat + o.paid.tip + o.paid.freight + o.paid.waiting;
