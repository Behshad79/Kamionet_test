import { cityPlace, roadKm } from "./geo";
import { SEED_RATES } from "./pricing";
import type { CargoType, Config, DriverProfile, Order, PayMethod, Rating, State, User, VehicleType } from "./types";

const H = 3_600_000;
const D = 24 * H;

export const DEFAULT_CONFIG: Config = {
  insuranceMode: "optional",
  insuranceRate: 0.003,
  cancelFeePct: 0.1,
  lockSeconds: 150,
  commission: 0.2,
};

export const ADMIN_PHONE = "09120000000";

const users: User[] = [
  { id: "u-shipper1", phone: "09121112233", name: "شرکت لبنیات سحر", createdAt: 0 },
  { id: "u-shipper2", phone: "09122223344", name: "فروشگاه زنجیره‌ای افق‌کوروش", createdAt: 0 },
  { id: "u-shipper3", phone: "09123334455", name: "داروپخش البرز", createdAt: 0 },
  { id: "u-driver1", phone: "09351112233", name: "محمدرضا کریمی", createdAt: 0 },
  { id: "u-driver2", phone: "09352223344", name: "حسین رحیمی", createdAt: 0 },
  { id: "u-driver3", phone: "09353334455", name: "علی‌اکبر موسوی", createdAt: 0 },
  { id: "u-driver4", phone: "09354445566", name: "مجتبی نظری", createdAt: 0 },
];

const CAP: Record<VehicleType, number> = { pickup: 1500, khavar: 4500, truck10: 10_000, trailer: 24_000 };
const veh = (type: VehicleType, minTemp: number, plate: string, brand: string) => ({
  type,
  plate,
  minTemp,
  capacityKg: CAP[type],
  fridgeBrand: brand,
  lastServiceAt: Date.now() - 60 * D,
});

const drivers = (now: number): DriverProfile[] => [
  {
    userId: "u-driver1",
    kyc: "verified",
    vehicle: veh("truck10", -22, "۱۲ ب ۳۴۵ ایران ۶۸", "Thermo King T-600"),
    docs: { insurance: { expiresAt: now + 200 * D }, inspection: { expiresAt: now + 120 * D } },
  },
  {
    userId: "u-driver2",
    kyc: "verified",
    vehicle: veh("khavar", 0, "۴۵ ج ۷۸۹ ایران ۱۱", "Carrier Xarios"),
    docs: { insurance: { expiresAt: now + 20 * D }, inspection: { expiresAt: now + 300 * D } },
  },
  {
    userId: "u-driver3",
    kyc: "pending",
    submittedAt: now - 5 * H,
    vehicle: veh("truck10", -18, "۷۷ د ۱۲۳ ایران ۲۲", "Hwasung HRU-300"),
    docs: { insurance: { expiresAt: now + 90 * D }, inspection: { expiresAt: now + 45 * D } },
  },
  {
    userId: "u-driver4",
    kyc: "pending",
    submittedAt: now - 26 * H,
    vehicle: veh("pickup", 2, "۳۳ ه ۴۵۶ ایران ۴۴", "Mini Cooler MC-1"),
    docs: { insurance: { expiresAt: now + 10 * D }, inspection: { expiresAt: now + 150 * D } },
  },
];

type Seed = {
  shipper: string; from: string; to: string; cargo: CargoType; temp: [number, number]; vehicle: VehicleType;
  kg: number; pallets?: number; value: number; price: number; hoursAhead: number; window: number; deadlineH: number;
  pay: PayMethod; addrA: string; addrB: string;
};

const mk = (i: number, now: number, s: Seed): Order => {
  const pickupAt = now + s.hoursAhead * H;
  const origin = cityPlace(s.from, s.addrA);
  const dest = cityPlace(s.to, s.addrB);
  const insured = i % 2 === 0;
  return {
    id: `o-seed-${i}`,
    groupId: `g-seed-${i}`,
    groupIndex: 1,
    groupSize: 1,
    shipperId: s.shipper,
    status: "OPEN",
    origin,
    dest,
    pickupAt,
    pickupTo: pickupAt + s.window * H,
    deliverBy: pickupAt + s.deadlineH * H,
    cargo: s.cargo,
    tempMin: s.temp[0],
    tempMax: s.temp[1],
    vehicleType: s.vehicle,
    weightKg: s.kg,
    pallets: s.pallets,
    declaredValue: s.value,
    price: s.price,
    payment: { method: s.pay, depositPct: s.pay === "deposit" ? 30 : undefined },
    insurance: insured,
    insuranceFee: insured ? Math.round((s.value * 0.003) / 1000) * 1000 : 0,
    distanceKm: roadKm(origin, dest),
    createdAt: now - i * 17 * 60_000,
    media: [],
  };
};

export function buildSeed(): State {
  const now = Date.now();
  const seeds: Seed[] = [
    { shipper: "u-shipper1", from: "تهران", to: "اصفهان", cargo: "dairy", temp: [0, 4], vehicle: "truck10", kg: 8000, pallets: 16, value: 640_000_000, price: 17_500_000, hoursAhead: 6, window: 2, deadlineH: 14, pay: "deposit", addrA: "شهرک صنعتی شمس‌آباد، خیابان ۱۲", addrB: "میدان جهاد، انبار مرکزی" },
    { shipper: "u-shipper2", from: "تهران", to: "مشهد", cargo: "icecream", temp: [-25, -18], vehicle: "truck10", kg: 9000, pallets: 18, value: 1_200_000_000, price: 41_000_000, hoursAhead: 20, window: 3, deadlineH: 30, pay: "prepaid", addrA: "جاده مخصوص کرج، کیلومتر ۸", addrB: "بلوار وکیل‌آباد، بین ۱۰ و ۱۲" },
    { shipper: "u-shipper3", from: "کرج", to: "قم", cargo: "pharma", temp: [2, 8], vehicle: "pickup", kg: 400, pallets: 2, value: 5_000_000_000, price: 5_200_000, hoursAhead: 4, window: 1, deadlineH: 5, pay: "prepaid", addrA: "مهرشهر، بلوار ارم", addrB: "شهرک صنعتی شکوهیه" },
    { shipper: "u-shipper1", from: "شیراز", to: "یزد", cargo: "meat", temp: [-2, 2], vehicle: "khavar", kg: 3500, pallets: 8, value: 420_000_000, price: 13_800_000, hoursAhead: 30, window: 2, deadlineH: 12, pay: "cod", addrA: "شهرک صنعتی بزرگ شیراز", addrB: "میدان آزادی، کشتارگاه" },
    { shipper: "u-shipper2", from: "تبریز", to: "ارومیه", cargo: "dairy", temp: [1, 5], vehicle: "khavar", kg: 3000, pallets: 6, value: 210_000_000, price: 6_400_000, hoursAhead: 12, window: 2, deadlineH: 8, pay: "deposit", addrA: "جاده آذرشهر، شهرک صنعتی", addrB: "بازار میوه و تره‌بار" },
    { shipper: "u-shipper3", from: "رشت", to: "ساری", cargo: "pharma", temp: [2, 8], vehicle: "pickup", kg: 600, pallets: 3, value: 3_200_000_000, price: 6_900_000, hoursAhead: 9, window: 2, deadlineH: 9, pay: "prepaid", addrA: "منطقه صنعتی رشت", addrB: "خیابان طالقانی، داروخانه مرکزی" },
    { shipper: "u-shipper1", from: "اهواز", to: "شیراز", cargo: "icecream", temp: [-25, -18], vehicle: "truck10", kg: 7500, pallets: 15, value: 900_000_000, price: 22_000_000, hoursAhead: 40, window: 3, deadlineH: 26, pay: "deposit", addrA: "شهرک صنعتی اهواز", addrB: "بلوار امیرکبیر" },
    { shipper: "u-shipper2", from: "مشهد", to: "گرگان", cargo: "meat", temp: [-25, -18], vehicle: "trailer", kg: 18_000, pallets: 33, value: 2_400_000_000, price: 39_000_000, hoursAhead: 26, window: 4, deadlineH: 24, pay: "prepaid", addrA: "سه‌راه ملک‌آباد", addrB: "میدان بار گرگان" },
    { shipper: "u-shipper3", from: "یزد", to: "کرمان", cargo: "other", temp: [8, 15], vehicle: "khavar", kg: 4000, pallets: 10, value: 180_000_000, price: 9_800_000, hoursAhead: 15, window: 3, deadlineH: 12, pay: "cod", addrA: "شهرک صنعتی یزد", addrB: "میدان میوه و تره‌بار" },
    { shipper: "u-shipper1", from: "اصفهان", to: "کرمانشاه", cargo: "dairy", temp: [0, 4], vehicle: "truck10", kg: 9500, pallets: 20, value: 720_000_000, price: 24_000_000, hoursAhead: 34, window: 2, deadlineH: 16, pay: "deposit", addrA: "شهرک صنعتی محمودآباد", addrB: "میدان بار، انبار ۴" },
  ];
  const orders = seeds.map((s, i) => mk(i + 1, now, s));

  // A finished trip so reports & history aren't empty.
  orders.push({
    ...mk(90, now, { shipper: "u-shipper1", from: "تهران", to: "قم", cargo: "dairy", temp: [0, 4], vehicle: "truck10", kg: 6000, pallets: 12, value: 380_000_000, price: 4_200_000, hoursAhead: -30, window: 2, deadlineH: 5, pay: "prepaid", addrA: "جاده ساوه", addrB: "میدان شهدا" }),
    id: "o-seed-done",
    status: "DELIVERED",
    driverId: "u-driver1",
    assignedAt: now - 3 * D,
    startedAt: now - 3 * D + H,
    deliveredAt: now - 3 * D + 4 * H,
    waybillNo: "KM-۱۴۰۴۰۰۱",
    createdAt: now - 4 * D,
  });

  // Prior trip ratings so shipper reputation is visible from day one.
  const ratings: Rating[] = [];
  const spread: Record<string, number[]> = { "u-shipper1": [5, 5, 4, 5, 5, 4, 5, 5], "u-shipper2": [4, 5, 4, 4, 5, 3], "u-shipper3": [5, 5, 5, 4, 5, 5, 5, 5, 4, 5] };
  for (const [shipper, stars] of Object.entries(spread))
    stars.forEach((n, i) => ratings.push({ orderId: `seed-r-${shipper}-${i}`, from: `u-driver${(i % 4) + 1}`, to: shipper, stars: n, comment: "", at: now - (i + 5) * D }));

  return {
    ready: true,
    users,
    drivers: drivers(now),
    orders,
    templates: [],
    ratings,
    notifications: [],
    tickets: [
      {
        id: "t-seed",
        userId: "u-shipper2",
        subject: "تأخیر در تخصیص راننده",
        status: "open",
        messages: [{ from: "user", text: "سفارش تبریز–تهران هنوز راننده ندارد. امکان بررسی هست؟", at: now - 2 * H }],
      },
    ],
    rates: SEED_RATES,
    config: DEFAULT_CONFIG,
    session: { userId: null, role: "shipper", admin: false },
  };
}

export const EMPTY_STATE: State = {
  ready: false,
  users: [],
  drivers: [],
  orders: [],
  templates: [],
  ratings: [],
  notifications: [],
  tickets: [],
  rates: [],
  config: DEFAULT_CONFIG,
  session: { userId: null, role: "shipper", admin: false },
};
