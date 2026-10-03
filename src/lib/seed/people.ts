import { rng, type Rng } from "../rng";
import { R } from "../money";
import { VEHICLES } from "../vehicles";
import type { CargoKind, DriverProfile, Person, ShipperProfile, State, VehicleKind } from "../types";

const DAY = 86_400_000;

const FIRST = ["محمد", "علی", "حسین", "رضا", "مهدی", "امیر", "حسن", "ابراهیم", "مجتبی", "سعید", "کامران", "بهرام", "جواد", "یوسف", "اصغر", "قاسم", "مسعود", "وحید", "فرهاد", "ناصر", "حمید", "پیمان", "هادی", "داریوش"];
const LAST = ["کریمی", "رحیمی", "موسوی", "نظری", "احمدی", "حسینی", "جعفری", "صادقی", "قاسمی", "رضایی", "محمدی", "کاظمی", "عباسی", "باقری", "نوری", "طاهری", "فرهادی", "یزدانی", "شریفی", "اکبری", "سلیمانی", "مرادی"];
const BRANDS = ["Thermo King", "Carrier", "Hwasung", "Zanotti", "Mini Cooler"];
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

export function makeShipper(s: State, r: Rng, i: number, now: number, o: Partial<ShipperProfile> & { name?: string; phone?: string; company?: boolean } = {}): ShipperProfile {
  const pid = `p-s${i}`;
  const company = o.company ?? r.chance(0.7);
  const name = o.name ?? `${r.pick(FIRST)} ${r.pick(LAST)}`;
  s.persons.push({ id: pid, phone: o.phone ?? `0912${String(1000000 + i * 7).slice(-7)}`, name, nationalId: faNational(r), createdAt: now - r.int(30, 360) * DAY });
  const cname = `${r.pick(COMPANY_A)} ${r.pick(COMPANY_B)}`;
  const sh: ShipperProfile = {
    personId: pid,
    displayName: company ? cname : name,
    company: company ? { name: cname, economicCode: String(r.int(100000000000, 999999999999)), sector: r.pick(["لبنیات", "پروتئین", "دارو", "غذایی", "میوه و سبزی"]) } : undefined,
    businessVerified: company && r.chance(0.6),
    completeness: { name: true, company: company, verify: company && r.chance(0.6), address: r.chance(0.7), logo: r.chance(0.3) },
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
    ...o,
  };
  delete (sh as Partial<{ company2: unknown }>).company2;
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
  const verified = kyc === "verified";
  const minTemp = spec.minTemp !== undefined ? spec.minTemp : meta.fridge ? r.pick([-25, -22, -18, 0, 2]) : null;
  const home = r.pick(HOME);
  const d: DriverProfile = {
    personId: pid,
    kyc: { status: kyc, step: verified ? 7 : kyc === "none" ? 0 : kyc === "draft" ? 3 : 7, submittedAt: verified || kyc === "pending" || kyc === "rejected" ? now - r.int(1, 200) * DAY : undefined, idMatch: { status: verified ? "ok" : "idle", attempts: verified ? 1 : 0 }, rejectReasons: kyc === "rejected" ? ["تصویر کارت خودرو ناخوانا است", "گواهینامه منقضی شده است"] : undefined },
    vehicle: {
      kind: spec.kind, capacityKg: Math.round(meta.capacityKg * r.pick([0.9, 1, 1.05])), color: r.pick(COLORS), plate: plate(r), minTemp,
      canRunAmbient: spec.canRunAmbient ?? (!meta.fridge || r.chance(0.5)), fridgeBrand: meta.fridge ? r.pick(BRANDS) : "—", lastCargoOdor: "NONE", year: r.int(1390, 1403),
    },
    docs: verified ? { insurance: { expiresAt: now + r.int(25, 300) * DAY }, inspection: { expiresAt: now + r.int(25, 300) * DAY } } : {},
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
    base: verified ? { trips: r.int(5, 120), rating: Math.round((3.8 + r.next() * 1.2) * 10) / 10, onTime: r.int(78, 99) } : undefined,
  };
  void home;
  s.drivers.push(d);
  return d;
}

export { rng };
