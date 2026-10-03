import { rng, type Rng } from "../rng";
import { R } from "../money";
import { MAKES, VEHICLES } from "../vehicles";
import type { CargoKind, DriverProfile, Person, ShipperProfile, State, Thermo, VehicleKind } from "../types";

const DAY = 86_400_000;
const docImg = (n: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" rx="6" fill="#f3f4f6" stroke="#9ca3af"/><rect x="10" y="12" width="60" height="6" rx="3" fill="#9ca3af"/><rect x="10" y="26" width="90" height="4" rx="2" fill="#d1d5db"/><rect x="10" y="36" width="80" height="4" rx="2" fill="#d1d5db"/><text x="60" y="66" font-size="11" text-anchor="middle" fill="#374151" font-family="sans-serif">${n}</text></svg>`)}`;
const logoFor = (n: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#146EB4"/><text x="20" y="27" font-size="20" font-family="sans-serif" text-anchor="middle" fill="#fff">${n.trim()[0] ?? "ک"}</text></svg>`)}`;

const FIRST = ["محمد", "علی", "حسین", "رضا", "مهدی", "امیر", "حسن", "ابراهیم", "مجتبی", "سعید", "کامران", "بهرام", "جواد", "یوسف", "اصغر", "قاسم", "مسعود", "وحید", "فرهاد", "ناصر", "حمید", "پیمان", "هادی", "داریوش"];
const LAST = ["کریمی", "رحیمی", "موسوی", "نظری", "احمدی", "حسینی", "جعفری", "صادقی", "قاسمی", "رضایی", "محمدی", "کاظمی", "عباسی", "باقری", "نوری", "طاهری", "فرهادی", "یزدانی", "شریفی", "اکبری", "سلیمانی", "مرادی"];
const BRANDS = ["Thermo King", "Carrier", "Hwasung", "Zanotti", "Mini Cooler"];
const FRIDGE_MODELS = ["T-600R", "X430", "V-300", "Supra 850", "ZX-20"];
/** Exact make/model, box length, fridge model/year and thermometer answers so every seeded truck has a complete card. */
function vehicleExtras(r: Rng, kind: VehicleKind, fridge: boolean, pro?: boolean) {
  const mk = r.pick(MAKES[kind]);
  const thermoKind: Thermo["kind"] = fridge ? r.pick(["digital", "digital", "logger", "analog"] as const) : "none";
  return {
    make: mk.make, modelName: r.pick(mk.models), bodyLengthM: Math.round((3 + r.next() * 9) * 10) / 10,
    ...(fridge ? { fridgeModel: r.pick(FRIDGE_MODELS), fridgeYear: r.int(1394, 1403) } : {}),
    thermo: { kind: thermoKind, brand: thermoKind === "none" ? undefined : r.pick(["Elitech", "Testo", "Sensitech", "Dickson"]), connected: fridge && thermoKind !== "analog" && r.chance(pro ? 0.7 : 0.35), connectedAt: undefined as number | undefined },
  };
}
const COMPANY_A = ["لبنیات", "پروتئین", "داروپخش", "بستنی", "میوه و تره‌بار", "پخش مواد غذایی", "سردخانه", "صنایع غذایی", "زنجیره‌ای", "تجارت"];
const COMPANY_B = ["سحر", "البرز", "پارس‌گستر", "آرمان", "کوروش", "دماوند", "نسیم", "آراد", "مهرآوران", "طلوع", "ایران‌دشت", "زاگرس", "کاسپین", "ماهان"];
const LETTERS = ["الف", "ب", "ج", "د", "س", "ص", "ط", "ق", "ل", "م", "ن", "و", "ه", "ی"];
const COLORS = ["white", "silver", "blue", "red", "green", "black"];
const HOME = ["تهران", "تهران", "کرج", "اصفهان", "مشهد", "شیراز", "تبریز", "اهواز", "رشت", "قم", "کرمان", "یزد", "ساری"];

export const faNational = (r: Rng) => String(r.int(1_000_000_000, 4_999_999_999));

function plate(r: Rng) {
  return { two: String(r.int(11, 99)), letter: r.pick(LETTERS), three: String(r.int(100, 999)), prov: String(r.pick([11, 22, 33, 44, 55, 68, 78, 98])), variant: "public" as const };
}

const defaultNotify = { orders: true, payments: true, chat: true, marketing: false };

export function makeShipper(s: State, r: Rng, i: number, now: number, o: Omit<Partial<ShipperProfile>, "company"> & { name?: string; phone?: string; company?: boolean } = {}): ShipperProfile {
  const pid = `p-s${i}`;
  const company = o.company ?? r.chance(0.7);
  const name = o.name ?? `${r.pick(FIRST)} ${r.pick(LAST)}`;
  s.persons.push({ id: pid, phone: o.phone ?? `0912${String(1000000 + i * 7).slice(-7)}`, name, nationalId: faNational(r), createdAt: now - r.int(30, 360) * DAY });
  const cname = `${r.pick(COMPANY_A)} ${r.pick(COMPANY_B)}`;
  const sh: ShipperProfile = {
    personId: pid,
    displayName: company ? cname : name,
    company: company ? { name: cname, economicCode: String(r.int(100000000000, 999999999999)), sector: r.pick(["لبنیات", "پروتئین", "دارو", "غذایی", "میوه و سبزی"]) } : undefined,
    businessVerified: false,
    memberSince: now - r.int(30, 360) * DAY,
    favorites: [],
    cargoCategories: r.shuffle<CargoKind>(["dairy", "meat", "produce", "icecream", "pharma", "fish"]).slice(0, r.int(1, 3)),
    controls: { creditLimit: 0, creditTermsDays: 0, invoiceCycle: "order", blockCardToCard: false, cashToDriver: false, couponEligible: true, walletFrozen: false, blocked: false },
    honesty: r.int(70, 98),
    prefs: { autoPayDeposit: r.chance(0.4), refundTo: "wallet", quietHours: false, notify: { ...defaultNotify } },
    referralCode: `KM${String(100000 + i * 37)}`,
    loyaltyTier: "bronze",
    notes: [],
    hue: r.int(0, 359),
    address: r.chance(0.7) ? { text: "شهرک صنعتی، خیابان ۱۲، انبار مرکزی", lat: 35.7 + r.next() * 0.1, lng: 51.3 + r.next() * 0.2 } : undefined,
    logo: r.chance(0.35) ? logoFor(name) : undefined,
    verifyDoc: company && r.chance(0.7) ? { dataUrl: docImg("جواز کسب"), at: now - 40 * DAY, status: r.chance(0.2) ? "pending" : "approved" } : undefined,
  };
  const { company: _c, name: _n, phone: _p, ...rest } = o;
  void _c; void _n; void _p;
  Object.assign(sh, rest);
  if (sh.businessVerified && !sh.verifyDoc) sh.verifyDoc = { dataUrl: docImg("جواز کسب"), at: now - 60 * DAY, status: "approved" };
  if (sh.verifyDoc?.status === "approved") sh.businessVerified = true;
  s.shippers.push(sh);
  return sh;
}

export interface DriverSpec {
  kind: VehicleKind;
  kyc?: DriverProfile["kyc"]["status"];
  pro?: DriverProfile["pro"]["status"];
  name?: string;
  phone?: string;
  minTemp?: number | null;
  canRunAmbient?: boolean;
  clean?: boolean;
}

export function makeDriver(s: State, r: Rng, i: number, now: number, spec: DriverSpec): DriverProfile {
  const pid = `p-d${i}`;
  const meta = VEHICLES[spec.kind];
  const name = spec.name ?? `${r.pick(FIRST)} ${r.pick(LAST)}`;
  const person: Person = { id: pid, phone: spec.phone ?? `0935${String(1000000 + i * 13).slice(-7)}`, name, nationalId: faNational(r), birthDate: `${r.int(1350, 1380)}/${String(r.int(1, 12)).padStart(2, "0")}/${String(r.int(1, 28)).padStart(2, "0")}`, createdAt: now - r.int(20, 360) * DAY };
  s.persons.push(person);
  const kyc = spec.kyc ?? "verified";
  if (kyc !== "none") person.tourDone = true;
  const verified = kyc === "verified";
  const minTemp = spec.minTemp !== undefined ? spec.minTemp : meta.fridge ? r.pick([-25, -22, -18, 0, 2]) : null;
  const home = r.pick(HOME);
  const d: DriverProfile = {
    personId: pid,
    kyc: { status: kyc, step: verified ? 7 : kyc === "none" ? 0 : kyc === "draft" ? 3 : 7, submittedAt: verified || kyc === "pending" || kyc === "rejected" ? now - r.int(1, 200) * DAY : undefined, idMatch: { status: verified ? "ok" : "idle", attempts: verified ? 1 : 0 }, rejectReasons: kyc === "rejected" ? ["تصویر کارت خودرو ناخوانا است", "گواهینامه منقضی شده است"] : undefined },
    vehicle: {
      kind: spec.kind, capacityKg: Math.round(meta.capacityKg * r.pick([0.9, 1, 1.05])), color: r.pick(COLORS), plate: plate(r), minTemp,
      canRunAmbient: spec.canRunAmbient ?? (!meta.fridge || r.chance(0.5)), fridgeBrand: meta.fridge ? r.pick(BRANDS) : "—", lastCargoOdor: "NONE", year: r.int(1390, 1403), ...vehicleExtras(r, spec.kind, meta.fridge, spec.pro === "pro"),
    },
    docs: verified || kyc === "pending" || kyc === "rejected" ? { selfie: { dataUrl: docImg("سلفی"), reviewed: verified }, license: { dataUrl: docImg("گواهینامه"), reviewed: verified }, insurance: { dataUrl: docImg("بیمه‌نامه"), expiresAt: now + r.int(25, 300) * DAY, reviewed: verified }, inspection: { dataUrl: docImg("معاینه فنی"), expiresAt: now + r.int(25, 300) * DAY, reviewed: verified }, regFront: { dataUrl: docImg("کارت خودرو"), reviewed: verified }, smartCard: { dataUrl: docImg("کارت هوشمند"), reviewed: verified } } : {},
    iban: verified ? { sheba: `IR${r.int(10, 99)}0170000000${String(r.int(10000000000, 99999999999))}`, holder: name, holderMatches: true, addedAt: now - 120 * DAY } : undefined,
    pro: { status: spec.pro ?? "none", inspection: spec.pro === "pro" ? "passed" : "none", since: spec.pro === "pro" ? now - r.int(20, 150) * DAY : undefined, invitedAt: spec.pro === "invited" ? now - 3 * DAY : undefined },
    strikes: [],
    clean: { score: r.int(60, 95), badgeUntil: spec.clean ? now + 12 * DAY : undefined, lastWashAt: spec.clean ? now - 2 * DAY : undefined },
    controls: { walletFrozen: false, payoutHold: false, cashToDriver: false, maxDebt: R(3_000_000), instantPayout: spec.pro === "pro", incentiveEligible: true },
    declaredTrips: [],
    online: verified && r.chance(0.6),
    lastLoc: undefined,
    referralCode: `DR${String(200000 + i * 41)}`,
    notes: [],
    createdAt: person.createdAt,
    base: verified ? { trips: r.int(5, 120), rating: Math.round((3.8 + r.next() * 1.2) * 10) / 10, onTime: r.int(78, 99) / 100 } : undefined,
  };
  void home;
  s.drivers.push(d);
  return d;
}

export { rng };
