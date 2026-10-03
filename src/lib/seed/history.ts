import { cityPlace, roadKm } from "../geo";
import { R } from "../money";
import type { Rng } from "../rng";
import { VEHICLES } from "../vehicles";
import { DAY, HOUR, MIN, driverOf, orderOf, uid } from "../engine/core";
import { arriveDelivery, arrivePickup, cancelByDriver, cancelByShipper, claimOrder, confirmAssign, createOrders, deliver, engineTick, startToPickup, startTrip } from "../engine/orders";
import { pay } from "../engine/pay";
import { submitReview } from "../engine/trust";
import { DRIVER_CRITERIA, SHIPPER_CRITERIA } from "../engine/stats";
import { outstanding } from "../engine/pay";
import type { CargoKind, Media, Order, OrderInput, State } from "../types";

const MAJORS = ["تهران", "اصفهان", "مشهد", "شیراز", "تبریز", "اهواز", "رشت", "قم", "کرج", "کرمان", "یزد", "ساری", "ارومیه", "بندرعباس", "گرگان", "همدان", "کرمانشاه", "اراک", "زنجان", "قزوین"];
const CARGO: { kind: CargoKind; temp: [number, number]; packaging: string; value: number; odor: "NONE" | "LOW" | "STRONG" }[] = [
  { kind: "dairy", temp: [0, 4], packaging: "پالت", value: 600, odor: "LOW" },
  { kind: "meat", temp: [-2, 2], packaging: "کارتن", value: 900, odor: "STRONG" },
  { kind: "meat", temp: [-25, -18], packaging: "کارتن", value: 1200, odor: "STRONG" },
  { kind: "icecream", temp: [-25, -18], packaging: "پالت", value: 800, odor: "NONE" },
  { kind: "pharma", temp: [2, 8], packaging: "جعبه", value: 3000, odor: "NONE" },
  { kind: "produce", temp: [8, 15], packaging: "جعبه چوبی", value: 250, odor: "LOW" },
  { kind: "fish", temp: [-2, 2], packaging: "یونولیت", value: 700, odor: "STRONG" },
];
const IMG = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const media = (kind: Media["kind"], at: number, items?: number): Media => ({ kind, dataUrl: IMG, takenAt: at, lat: 35.7, lng: 51.4, items });

export interface Sim {
  s: State;
  r: Rng;
  t: number;
  /** Failures are collected so the seed script/test can assert there are none. */
  errors: string[];
}

const must = (sim: Sim, label: string, res: { ok: boolean; error?: string }) => {
  if (!res.ok) sim.errors.push(`${label}: ${(res as { error: string }).error}`);
  return res.ok;
};

export function topUp(sim: Sim, shipperId: string, amount: number) {
  const res = pay(sim.s, { payerId: shipperId, purpose: "topup", amount, method: "card", outcome: "success" });
  must(sim, "topup", res);
}

/** Freight in Rial for a route, using the same per-km logic as the rate cards. */
export function fareFor(r: Rng, km: number, kind: keyof typeof VEHICLES, frozen: boolean) {
  const perKm = r.int(34_000, 48_000) * VEHICLES[kind].priceFactor * (frozen ? 1.12 : 1);
  return R(Math.max(2_500_000, Math.round((perKm * Math.max(km, 60)) / 100_000) * 100_000));
}

export function buildInput(sim: Sim, shipperId: string, driverId: string | null, over: Partial<OrderInput> = {}): OrderInput {
  const { s, r } = sim;
  const c = r.pick(CARGO);
  const from = r.pick(MAJORS);
  let to = r.pick(MAJORS);
  while (to === from) to = r.pick(MAJORS);
  const origin = cityPlace(from, "شهرک صنعتی، خیابان ۱۲");
  const dest = cityPlace(to, "میدان مرکزی، انبار ۴");
  const d = driverId ? driverOf(s, driverId) : undefined;
  const kind = over.vehicleKind ?? d?.vehicle.kind ?? r.pick(["nissan", "kamionet", "khavar", "truck10", "trailer"] as const);
  const cap = d?.vehicle.capacityKg ?? VEHICLES[kind].capacityKg;
  const weight = Math.round(cap * (0.4 + r.next() * 0.5));
  const km = roadKm(origin, dest);
  const pickupAt = sim.t + r.int(3, 30) * HOUR;
  const price = fareFor(r, km, kind, c.temp[1] <= -18);
  const minTemp = d?.vehicle.minTemp;
  // Fit the temperature class to what the driver's unit can hold.
  let temp = c.temp;
  if (typeof minTemp === "number" && minTemp > temp[0]) temp = [Math.max(minTemp, 0), Math.max(minTemp, 0) + 4] as [number, number];
  const input: OrderInput = {
    origin, dest, pickupAt, pickupTo: pickupAt + 2 * HOUR, deliverBy: pickupAt + (Math.max(km, 60) / 55 + 6) * HOUR,
    count: 1, cargoMode: "REFRIGERATED", cargo: c.kind, odor: c.odor, odorSensitive: false, tempMin: temp[0], tempMax: temp[1],
    vehicleKind: kind, weightKg: weight, pallets: Math.max(1, Math.round(weight / 500)), packaging: c.packaging, itemizedInvoice: r.chance(0.3),
    declaredValue: R(c.value * 1_000_000 * (weight / 8000 + 0.3)), cleanOnly: false, serviceClass: "STANDARD", assignMode: "OPEN",
    freightBase: price, tipPre: r.chance(0.12) ? R(r.pick([200_000, 300_000, 500_000])) : 0,
    insuranceProductId: r.chance(0.55) ? r.pick(["ip-basic", "ip-std", "ip-comp"]) : null, coveragePct: 1,
    terms: r.pick(["PREPAID", "DEPOSIT_BALANCE_BEFORE_LOADING", "DEPOSIT_BALANCE_AFTER_DELIVERY", "DEPOSIT_BALANCE_AFTER_DELIVERY"] as const), autoPayDeposit: false,
    consignee: { name: "گیرنده‌ی نمونه", phone: `0912${r.int(1000000, 9999999)}` },
    ...over,
  };
  return input;
}

/** Fund the shipper wallet generously, then pay whatever is outstanding for an order from it. */
export function payOutstanding(sim: Sim, o: Order, purpose: "deposit" | "balance") {
  const due = outstanding(o);
  if (due <= 0) return;
  const need = purpose === "deposit" ? Math.min(due, o.depositRequired - (o.paid.insurance + o.paid.vat + o.paid.tip + o.paid.freight)) : due;
  const amt = Math.max(0, Math.min(due, need));
  if (amt <= 0) return;
  topUp(sim, o.shipperId, amt);
  must(sim, `pay:${purpose}`, pay(sim.s, { payerId: o.shipperId, orderId: o.id, purpose, amount: amt, method: "wallet" }));
}

const advance = (sim: Sim, ms: number) => {
  sim.t += ms;
  sim.s._now = sim.t;
};
const tickAll = (sim: Sim) => { engineTick(sim.s); };

export type Outcome = "completed" | "cancel_shipper" | "cancel_driver" | "in_transit" | "assigned" | "at_pickup" | "delivered";

/** Drive one order through the real engine. `sim.t` moves forward between steps. */
export function runOrder(sim: Sim, shipperId: string, driverId: string, outcome: Outcome, over: Partial<OrderInput> = {}): Order | undefined {
  const { s, r } = sim;
  s._now = sim.t;
  const input = buildInput(sim, shipperId, driverId, over);
  const res = createOrders(s, shipperId, input);
  if (!res.ok) { sim.errors.push(`create: ${res.error}`); return undefined; }
  const id = res.ids[0];
  advance(sim, r.int(5, 40) * MIN);
  if (outcome === "cancel_shipper" && r.chance(0.5)) { must(sim, "cancelS0", cancelByShipper(s, shipperId, id, "تغییر برنامه")); return orderOf(s, id); }
  if (!must(sim, "claim", claimOrder(s, driverId, id))) return orderOf(s, id);
  advance(sim, 60_000);
  if (!must(sim, "confirm", confirmAssign(s, driverId, id))) return orderOf(s, id);
  let o = orderOf(s, id)!;
  if (o.status === "AWAITING_DEPOSIT") { payOutstanding(sim, o, "deposit"); advance(sim, 2 * MIN); }
  o = orderOf(s, id)!;
  if (outcome === "assigned") return o;
  if (outcome === "cancel_shipper") { must(sim, "cancelS", cancelByShipper(s, shipperId, id, "صاحب بار آماده نبود")); return orderOf(s, id); }
  if (outcome === "cancel_driver") { must(sim, "cancelD", cancelByDriver(s, driverId, id, "خرابی خودرو")); return orderOf(s, id); }
  advance(sim, r.int(30, 120) * MIN);
  must(sim, "toPickup", startToPickup(s, driverId, id));
  advance(sim, r.int(20, 90) * MIN);
  must(sim, "arrPickup", arrivePickup(s, driverId, id));
  if (outcome === "at_pickup") return orderOf(s, id);
  advance(sim, r.int(10, 50) * MIN);
  o = orderOf(s, id)!;
  if (outstanding(o) > 0 && o.terms !== "DEPOSIT_BALANCE_AFTER_DELIVERY") payOutstanding(sim, o, "balance");
  const items = r.int(20, 200);
  must(sim, "startTrip", startTrip(s, driverId, id, { cargo: media("cargo", sim.t), invoice: media("invoice_pickup", sim.t, items), items }));
  if (outcome === "in_transit") return orderOf(s, id);
  o = orderOf(s, id)!;
  advance(sim, Math.max(60, o.distanceKm) / 55 * HOUR);
  must(sim, "arrDelivery", arriveDelivery(s, driverId, id));
  advance(sim, r.int(10, 60) * MIN);
  o = orderOf(s, id)!;
  must(sim, "deliver", deliver(s, driverId, id, { otp: o.consignee.otp, invoice: media("invoice_delivery", sim.t, items), items, cashReceived: o.cashAgreed > 0 ? o.cashAgreed : undefined }));
  o = orderOf(s, id)!;
  if (outstanding(o) > 0) { payOutstanding(sim, o, "balance"); }
  if (outcome === "delivered") return orderOf(s, id);
  // reviews, then let the dispute window elapse so earnings become available
  advance(sim, r.int(1, 20) * HOUR);
  if (r.chance(0.8)) must(sim, "reviewS", submitReview(s, shipperId, id, { criteria: Object.fromEntries(DRIVER_CRITERIA.map((c) => [c.id, r.chance(0.85) ? r.int(4, 5) : r.int(2, 4)])), comment: r.pick(["عالی بود", "به موقع رسید", "دما کاملاً ثابت بود", "برخورد محترمانه", "", ""]) }));
  if (r.chance(0.5)) must(sim, "reviewD", submitReview(s, driverId, id, { criteria: Object.fromEntries(SHIPPER_CRITERIA.map((c) => [c.id, r.int(4, 5)])), comment: r.pick(["بارگیری سریع", "همکاری خوب", "", ""]) }));
  advance(sim, 26 * HOUR);
  tickAll(sim);
  return orderOf(s, id);
}

export { uid, DAY };
