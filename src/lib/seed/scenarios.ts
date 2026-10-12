import { cityPlace } from "../geo";
import { R } from "../money";
import { A, driverWallet, post } from "../ledger";
import { openTicket, replyTicket } from "../engine/trust";
import { DAY, HOUR, MIN, driverOf, orderOf, uid } from "../engine/core";
import { createOrders } from "../engine/orders";
import { payoutAction, requestPayout } from "../engine/payout";
import type { DriverProfile, OrderInput, State } from "../types";
import { buildInput, runOrder, type Sim } from "./history";
import { makeDriver, makeShipper } from "./people";

/** Fixed demo accounts (OTP 12345). Shown in the «حساب‌های دمو» drawer. */
export const DEMO_DRIVERS: { phone: string; name: string; note: string }[] = [
  { phone: "09100000001", name: "آرمان نوری", note: "تازه‌وارد، احراز شروع‌نشده" },
  { phone: "09100000002", name: "بابک سلیمانی", note: "مدارک در حال بررسی" },
  { phone: "09100000003", name: "داود کاظمی", note: "رد شده، نیازمند اصلاح" },
  { phone: "09100000004", name: "ایمان رضایی", note: "تأییدشده، نیسان یخچال‌دار" },
  { phone: "09100000005", name: "حسین رحیمی", note: "تأییدشده، خاور، سابقه‌ی زیاد" },
  { phone: "09100000006", name: "محمدرضا کریمی", note: "کامیون ۱۰ تن، نشان «تمیز»" },
  { phone: "09100000007", name: "مجتبی نظری", note: "دعوت‌شده به پرو" },
  { phone: "09100000008", name: "علی‌اکبر موسوی", note: "پرو، کامیون ۱۰ تن" },
  { phone: "09100000009", name: "سعید باقری", note: "پرو، تریلی" },
  { phone: "09100000010", name: "رضا یزدانی", note: "معلق، با درخواست تجدیدنظر" },
  { phone: "09100000011", name: "کامران شریفی", note: "بدهی کارمزد باز" },
  { phone: "09100000012", name: "فرهاد اکبری", note: "کامیون سرپوشیده (غیریخچالی)" },
  { phone: "09100000013", name: "وحید مرادی", note: "کامیونت، سفر برگشتی اعلام‌شده" },
];

export const DEMO_SHIPPERS: { phone: string; name: string; note: string }[] = [
  { phone: "09120000001", name: "نیما صالحی", note: "حساب تازه، بدون سفارش" },
  { phone: "09120000002", name: "فروشگاه گل‌سرخ", note: "حقیقی، چند سفارش" },
  { phone: "09120000003", name: "لبنیات سحر", note: "شرکت تأییدشده، سابقه‌ی زیاد" },
  { phone: "09120000004", name: "داروپخش البرز", note: "سازمانی، اعتبار و فاکتور" },
  { phone: "09120000005", name: "پروتئین آریا", note: "پرداخت نقدی به راننده فعال" },
  { phone: "09120000006", name: "افق‌کوروش", note: "فاکتور سررسیدگذشته" },
  { phone: "09120000007", name: "بستنی ماهان", note: "کیف پول پر، سفارش‌های فعال" },
  { phone: "09120000008", name: "میوه‌ی نسیم", note: "سفارش‌های تکرارشونده" },
];

export const ADMIN_DEMO = [
  { phone: "09130000001", name: "مدیر کل" }, { phone: "09130000002", name: "عملیات" }, { phone: "09130000003", name: "پشتیبانی" },
  { phone: "09130000004", name: "احراز هویت" }, { phone: "09130000005", name: "مدیر مالی" }, { phone: "09130000006", name: "پشتیبان کیف پول" }, { phone: "09130000007", name: "حسابدار" },
];

export function seedPersonas(sim: Sim, now: number) {
  const { s, r } = sim;
  const dd = (i: number, spec: Parameters<typeof makeDriver>[4]) => makeDriver(s, r, 1000 + i, now, { ...spec, phone: DEMO_DRIVERS[i - 1].phone, name: DEMO_DRIVERS[i - 1].name });
  dd(1, { kind: "nissan", kyc: "none" });
  dd(2, { kind: "khavar", kyc: "pending" });
  dd(3, { kind: "nissan", kyc: "rejected" });
  dd(4, { kind: "nissan", minTemp: 0 });
  dd(5, { kind: "khavar", minTemp: -18 });
  dd(6, { kind: "truck10", minTemp: -22, clean: true });
  dd(7, { kind: "truck10", minTemp: -22, pro: "invited" });
  dd(8, { kind: "truck10", minTemp: -25, pro: "pro", clean: true });
  dd(9, { kind: "trailer", minTemp: -25, pro: "pro" });
  const d10 = dd(10, { kind: "khavar", minTemp: 0 });
  dd(11, { kind: "truck10", minTemp: -18 });
  dd(12, { kind: "dry", minTemp: null, canRunAmbient: true });
  const d13 = dd(13, { kind: "kamionet", minTemp: 0 });
  for (const i of [4, 5, 6, 7]) { const dp = s.drivers.find((x) => x.personId === `p-d${1000 + i}`); if (dp) dp.controls.autoPro = false; }
  d10.suspension = { reason: "گزارش‌های مکرر خروج از بازه‌ی دما", since: now - 4 * DAY, appeal: "open", appealText: "یخچال خودرو تعمیر شده و فاکتور تعمیرگاه پیوست است." };
  d13.declaredTrips.push({ id: uid(s, "tr"), from: "تهران", to: "قزوین", departAt: now + 1 * DAY, backTo: "تهران", backAt: now + 1 * DAY + 8 * HOUR, active: true });
  for (const p of s.drivers) if (DEMO_DRIVERS.some((x) => x.phone === s.persons.find((q) => q.id === p.personId)?.phone) && p.kyc.status === "verified") p.controls.cashToDriver = true;

  const ss = (i: number, o: Parameters<typeof makeShipper>[4] = {}) => makeShipper(s, r, 1000 + i, now, { ...o, phone: DEMO_SHIPPERS[i - 1].phone, name: DEMO_SHIPPERS[i - 1].name });
  ss(1, { company: false });
  ss(2, { company: false, displayName: "فروشگاه گل‌سرخ" });
  ss(3, { company: true, displayName: "لبنیات سحر", businessVerified: true });
  const s4 = ss(4, { company: true, displayName: "داروپخش البرز", businessVerified: true });
  s4.controls = { ...s4.controls, creditLimit: R(1_500_000_000), creditTermsDays: 30, invoiceCycle: "monthly" };
  const s5 = ss(5, { company: true, displayName: "پروتئین آریا", businessVerified: true });
  s5.controls.cashToDriver = true;
  const s6 = ss(6, { company: true, displayName: "افق‌کوروش", businessVerified: true });
  s6.controls = { ...s6.controls, creditLimit: R(900_000_000), creditTermsDays: 15, invoiceCycle: "weekly" };
  ss(7, { company: true, displayName: "بستنی ماهان", businessVerified: true });
  ss(8, { company: true, displayName: "میوه‌ی نسیم", businessVerified: false });
  for (const x of s.shippers) if (DEMO_SHIPPERS.some((q) => q.phone === s.persons.find((p) => p.id === x.personId)?.phone)) x.prefs.autoPayDeposit = false; // demos should show the manual deposit step
}

const openOverrides: Partial<OrderInput>[] = [
  {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
  { cargoMode: "AMBIENT", cargo: "dry", tempMin: undefined, tempMax: undefined, vehicleKind: "dry", odor: "NONE", insuranceProductId: "ip-amb-basic" },
  { cargoMode: "AMBIENT", cargo: "dry", tempMin: undefined, tempMax: undefined, vehicleKind: "dry", odor: "NONE", insuranceProductId: "ip-amb-std" },
  { cargoMode: "AMBIENT", cargo: "dry", tempMin: undefined, tempMax: undefined, vehicleKind: "dry", odor: "NONE", insuranceProductId: null },
  { cargoMode: "AMBIENT", cargo: "other", tempMin: undefined, tempMax: undefined, vehicleKind: "dry", odor: "LOW", insuranceProductId: null },
  { cleanOnly: true, cargo: "dairy", tempMin: 0, tempMax: 4, odor: "NONE", odorSensitive: true },
  { cleanOnly: true, cargo: "pharma", tempMin: 2, tempMax: 8, odor: "NONE", odorSensitive: true },
];

export function seedOpenBoard(sim: Sim, count: number, now: number) {
  const { s, r } = sim;
  const shippers = s.shippers.filter((x) => !x.controls.blocked);
  for (let i = 0; i < count; i++) {
    sim.t = now - r.int(2, 600) * MIN;
    s._now = sim.t;
    const sh = r.pick(shippers);
    const pro = i % 7 === 3;
    const ov = openOverrides[i % openOverrides.length] ?? {};
    const input = buildInput(sim, sh.personId, null, { ...ov, ...(pro ? { serviceClass: "PRO", assignMode: "PRO_POOL" as const, vehicleKind: "truck10" } : {}) });
    if (input.cargoMode === "AMBIENT" || pro) input.couponCode = undefined;
    // keep a pickup window in the future so the board never shows expired loads
    const shift = Math.max(0, now + 2 * HOUR - input.pickupAt);
    input.pickupAt += shift; input.pickupTo += shift; input.deliverBy += shift;
    if (i % 11 === 0 && !pro) input.tipPre = R(500_000);
    const res = createOrders(s, sh.personId, input);
    if (!res.ok) sim.errors.push(`open: ${res.error}`);
  }
  // direct requests to the demo Pro drivers
  const pro8 = s.persons.find((p) => p.phone === DEMO_DRIVERS[7].phone)!.id;
  for (let i = 0; i < 2; i++) {
    sim.t = now - 3 * MIN; s._now = sim.t;
    const sh = s.shippers.find((x) => x.displayName === "لبنیات سحر")!;
    const input = buildInput(sim, sh.personId, pro8, { serviceClass: "PRO", assignMode: "DIRECT", directDriverId: pro8 });
    const res = createOrders(s, sh.personId, input);
    if (!res.ok) sim.errors.push(`direct: ${res.error}`);
  }
}

export function seedActive(sim: Sim, now: number, inTransit: number) {
  const { s, r } = sim;
  const drivers = s.drivers.filter((d) => d.kyc.status === "verified" && !d.suspension && d.vehicle.minTemp !== null);
  const pool = r.shuffle(drivers);
  const shippers = s.shippers;
  const take = (): DriverProfile => pool.pop()!;
  const plan: ("in_transit" | "assigned" | "at_pickup" | "delivered")[] = [
    ...Array(inTransit).fill("in_transit"), "assigned", "assigned", "assigned", "at_pickup", "at_pickup", "delivered", "delivered",
  ];
  for (const outcome of plan) {
    const d = take();
    if (driverOf(s, d.personId)?.pro.status === "invited") continue;
    sim.t = now - 7 * HOUR;
    s._now = sim.t;
    const sh = r.pick(shippers);
    const o = runOrder(sim, sh.personId, d.personId, outcome);
    if (o && outcome === "in_transit") {
      const real = orderOf(s, o.id)!;
      real.loadedAt = now - r.int(1, 7) * MIN; // so the demo clock shows trucks mid-route
      real.distanceKm = Math.max(real.distanceKm, 150);
      d.lastLoc = { lat: real.origin.lat, lng: real.origin.lng, at: now };
      if (!s.orders.some((x) => x.consignee.token === "demo")) real.consignee.token = "demo"; // sample consignee link: /track/?t=demo
    }
  }
}

export function seedDebtAndSupport(sim: Sim, now: number) {
  const { s, r } = sim;
  s._now = now;
  const d11 = s.persons.find((p) => p.phone === DEMO_DRIVERS[10].phone)!.id;
  const amount = R(1_850_000);
  post(s, { key: "seed:debt11", memo: "بدهی کارمزد (پرداخت نقدی به راننده)", ref: { personId: d11 }, lines: [[A.dDebt(d11), amount], [A.REV_COMM, -amount]] });
  s.debts.unshift({ id: uid(s, "dbt"), driverId: d11, amount, remaining: amount, at: now - 30 * HOUR, reason: "کارمزد پرداخت‌نشده در سفارش نقدی", stage: 1, reminders: 1, status: "OPEN" });

  // payouts in varied states (real engine calls)
  const rich = s.drivers.filter((d) => d.iban && driverWallet(s, d.personId).available >= R(3_000_000)).slice(0, 70);
  rich.forEach((d, i) => {
    sim.t = now - (i + 1) * 5 * HOUR; s._now = sim.t;
    const w = driverWallet(s, d.personId).available;
    const res = requestPayout(s, d.personId, Math.min(w, R(4_000_000 + (i % 5) * 2_000_000)), i % 9 === 0);
    if (!res.ok) return;
    const act = { type: "system" as const, id: "system", label: "سیستم" };
    const stage = i % 6;
    if (stage === 1) payoutAction(s, act, res.id, "approve");
    else if (stage === 2) { payoutAction(s, act, res.id, "approve"); payoutAction(s, act, res.id, "send"); payoutAction(s, act, res.id, "settle"); }
    else if (stage === 3) { payoutAction(s, act, res.id, "approve"); payoutAction(s, act, res.id, "send"); payoutAction(s, act, res.id, "fail", "شبای نامعتبر در شبکه‌ی بانکی"); }
    else if (stage === 4) payoutAction(s, act, res.id, "hold", "در انتظار بررسی هویتی");
  });

  // support tickets across the three channels
  const cats: [("trip" | "account" | "finance"), string, string, string][] = [
    ["trip", "تأخیر یا مشکل در مسیر", "تأخیر در تحویل", "گیرنده در مقصد پاسخ نمی‌دهد و مدتی منتظر مانده‌ام."],
    ["trip", "مغایرت بار", "وزن بار بیشتر از اظهار", "وزن واقعی بار حدود ۲۰ درصد بیشتر است."],
    ["account", "احراز هویت", "تأخیر در بررسی مدارک", "سه روز است مدارکم در بررسی است."],
    ["account", "قوانین و جریمه", "اعتراض به امتیاز منفی", "دلیل لغو خرابی یخچال بود."],
    ["finance", "پرداخت و فاکتور", "کسر مبلغ بدون ثبت سفارش", "از کارت من کسر شده اما بیعانه ثبت نشده."],
    ["finance", "برداشت", "برداشت من در انتظار است", "درخواست برداشت دو روز پیش ثبت شده است."],
    ["finance", "بازپرداخت", "درخواست بازپرداخت لغو", "سفارش لغو شد ولی مبلغ برنگشت."],
  ];
  for (let i = 0; i < 34; i++) {
    sim.t = i % 3 === 0 ? now - r.int(4, 90) * MIN : now - r.int(2, 240) * HOUR; s._now = sim.t;
    const [channel, category, subject, text] = cats[i % cats.length];
    const sh = channel !== "trip" || i % 2 ? r.pick(s.shippers) : undefined;
    const pid = channel === "account" && i % 4 === 2 ? r.pick(s.drivers).personId : (sh?.personId ?? r.pick(s.drivers).personId);
    const isDriver = pid.startsWith("p-d");
    const tk = openTicket(s, pid, isDriver ? "driver" : "shipper", { channel, category, subject, text });
    // older tickets are mostly handled already, so the queue shows a believable mix (new, pending, resolved, a few overdue)
    if (tk.ok && i % 3 !== 0 && i % 7 !== 1) {
      sim.t += r.int(5, 40) * MIN; s._now = sim.t;
      replyTicket(s, tk.id, "agent", "سلام، موضوع شما بررسی و اقدام لازم انجام شد.", s.admins.find((a) => a.id === s.tickets.find((x) => x.id === tk.id)?.assignee)?.name ?? "پشتیبان کامیونت");
      const t2 = s.tickets.find((x) => x.id === tk.id);
      if (t2 && i % 2 === 0) { t2.status = "RESOLVED"; if (i % 4 === 0) t2.csat = r.int(3, 5); }
    }
  }
}

/** Free-driver announcements: a few on busy routes (two cheap Karaj→Qom ones, one auto-accepting) so the shipper side always has suggestions to show. */
export function seedAvailability(sim: Sim, now: number) {
  const { s, r } = sim;
  const routes: [string, string[]][] = [["کرج", ["قم"]], ["کرج", ["قم", "اصفهان"]], ["تهران", ["اصفهان", "مشهد"]], ["تهران", []], ["شیراز", ["اهواز"]], ["تبریز", ["ارومیه"]], ["اصفهان", ["تهران"]], ["مشهد", []]];
  const pool = s.drivers.filter((d) => d.kyc.status === "verified" && !d.suspension && !d.controls.walletFrozen);
  routes.forEach(([from, to], i) => {
    const d = i < 2 ? pool.filter((x) => x.vehicle.kind === "truck10" && x.vehicle.minTemp !== null && x.vehicle.minTemp <= 0)[i] : pool[(i * 5 + 3) % pool.length];
    if (!d) return;
    s.availabilities.push({ id: uid(s, "av"), driverId: d.personId, from, to, fromAt: now - 2 * HOUR, until: now + (72 + i * 6) * HOUR, minFreight: R(i < 2 ? 500_000 : r.int(4, 25) * 1_000_000), note: i % 2 ? "بدون انتظار بیش از یک ساعت؛ تخلیه با کمک خودم" : "یخچال از شب قبل روشن است، آماده‌ی بارگیری", acceptAuto: i % 3 === 0, active: true, createdAt: now - (i + 1) * 20 * 60_000,
      cargoMode: i % 4 === 3 ? "BOTH" : "REFRIGERATED", maxFreight: i % 2 ? R(60_000_000) : undefined, minWeightKg: i % 3 === 1 ? 2000 : undefined, maxWeightKg: i % 3 === 0 ? 9000 : undefined, cargoKinds: i % 3 === 2 ? ["dairy", "icecream"] : [], terms: [], detourKm: 30, helpsLoading: i % 2 === 0, waitHours: i % 2 ? 1 : 2 });
  });
}

/** The demo «return trip» driver (09100000013) announces Isfahan → Tehran with conditions, so the merged «suggested for me» tab has content. */
export function seedReturnTrip(sim: Sim, now: number) {
  const { s } = sim;
  const p = s.persons.find((x) => x.phone === DEMO_DRIVERS[12]?.phone);
  if (!p) return;
  s.availabilities.push({ id: uid(s, "av"), driverId: p.id, from: "اصفهان", to: ["تهران", "کاشان"], fromAt: now, until: now + 4 * 24 * HOUR, minFreight: R(3_000_000), maxFreight: R(30_000_000), cargoMode: "BOTH", minWeightKg: 500, maxWeightKg: 3000, cargoKinds: [], terms: [], detourKm: 40, helpsLoading: true, waitHours: 2, note: "مسیر برگشت به تهران؛ بار شکستنی نمی‌برم", acceptAuto: false, active: true, createdAt: now - 10 * 60_000 });
}

/** Demo chats, calls and complaints: live chats on in-progress trips, plus complaints in every state on finished ones. */
export function seedComms(sim: Sim, now: number) {
  const { s } = sim;
  const live = s.orders.filter((o) => o.driverId && ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT"].includes(o.status)).slice(0, 6);
  const lines: [boolean, string][] = [[true, "سلام، من آماده‌ام؛ ساعت چند می‌رسید؟"], [false, "سلام، حدود ۴۰ دقیقه‌ی دیگر می‌رسم مبدأ."], [true, "باشه، انبار سمت راست است؛ زنگ بزنید در را باز کنم."], [false, "رسیدم، دم در هستم."]];
  live.forEach((o, i) => {
    s.chats.push({ orderId: o.id, shipperId: o.shipperId, driverId: o.driverId!, messages: lines.slice(0, 2 + (i % 3)).map(([sh, text], k) => ({ id: uid(s, "m"), from: sh ? o.shipperId : o.driverId!, text, at: now - (30 - k * 7) * 60_000 })), readAt: {} });
    if (i % 2 === 0) s.calls.push({ id: uid(s, "call"), orderId: o.id, from: o.shipperId, to: o.driverId!, status: i === 0 ? "MISSED" : "ENDED", at: now - 20 * 60_000, answeredAt: i === 0 ? undefined : now - 20 * 60_000 + 6000, endedAt: now - 20 * 60_000 + (i === 0 ? 30_000 : 95_000) });
  });
  const done = s.orders.filter((o) => o.driverId && o.status === "COMPLETED").slice(-4);
  const cats: [string, "OPEN" | "ANSWERED" | "RESOLVED" | "ESCALATED"][] = [["راننده دیر رسید", "RESOLVED"], ["بار با اعلام فرق دارد", "ESCALATED"], ["رفتار نامناسب", "ANSWERED"], ["دما رعایت نشد", "OPEN"]];
  done.forEach((o, i) => {
    const byShipper = i % 2 === 0;
    const [category, status] = cats[i % cats.length];
    const by = byShipper ? o.shipperId : o.driverId!, against = byShipper ? o.driverId! : o.shipperId;
    s.complaints.push({ id: uid(s, "cp"), orderId: o.id, byId: by, againstId: against, byRole: byShipper ? "shipper" : "driver", category, text: "توضیح مشکل: لطفاً بررسی کنید.", at: now - (2 + i) * 3_600_000, status, messages: [{ from: by, text: "توضیح مشکل: لطفاً بررسی کنید.", at: now - (2 + i) * 3_600_000 }, ...(status !== "OPEN" ? [{ from: against, text: "مشکل از طرف من نبود؛ توضیح می‌دهم.", at: now - (2 + i) * 3_600_000 + 600_000 }] : [])], resolvedAt: status === "RESOLVED" ? now - i * 3_600_000 : undefined, resolvedBy: status === "RESOLVED" ? "ثبت‌کننده" : undefined });
  });
}
