import { cityPlace } from "./geo";
import { SEED_RATES } from "./pricing";
import type { CargoType, Config, DriverProfile, Order, State, User } from "./types";

const H = 3_600_000;
const D = 24 * H;

export const DEFAULT_CONFIG: Config = {
  insuranceMode: "optional",
  insuranceRate: 0.015,
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

const veh = (type: DriverProfile["vehicle"]["type"], minTemp: number, plate: string, brand: string) => ({
  type,
  plate,
  minTemp,
  fridgeBrand: brand,
  lastServiceAt: Date.now() - 60 * D,
});

const drivers = (now: number): DriverProfile[] => [
  {
    userId: "u-driver1",
    kyc: "verified",
    vehicle: veh("truck", -22, "۱۲ ب ۳۴۵ ایران ۶۸", "Thermo King T-600"),
    docs: { insurance: { expiresAt: now + 200 * D }, inspection: { expiresAt: now + 120 * D } },
  },
  {
    userId: "u-driver2",
    kyc: "verified",
    vehicle: veh("nissan", 0, "۴۵ ج ۷۸۹ ایران ۱۱", "Carrier Xarios"),
    docs: { insurance: { expiresAt: now + 20 * D }, inspection: { expiresAt: now + 300 * D } },
  },
  {
    userId: "u-driver3",
    kyc: "pending",
    submittedAt: now - 5 * H,
    vehicle: veh("truck", -18, "۷۷ د ۱۲۳ ایران ۲۲", "Hwasung HRU-300"),
    docs: { insurance: { expiresAt: now + 90 * D }, inspection: { expiresAt: now + 45 * D } },
  },
  {
    userId: "u-driver4",
    kyc: "pending",
    submittedAt: now - 26 * H,
    vehicle: veh("pride", 2, "۳۳ ه ۴۵۶ ایران ۴۴", "Mini Cooler MC-1"),
    docs: { insurance: { expiresAt: now + 10 * D }, inspection: { expiresAt: now + 150 * D } },
  },
];

type Seed = [string, string, string, CargoType, number, number, number, string, string];

const mk = (i: number, now: number, s: Seed): Order => {
  const [shipper, from, to, cargo, tempMax, price, hoursAhead, addrA, addrB] = s;
  return {
    id: `o-seed-${i}`,
    groupId: `g-seed-${i}`,
    groupIndex: 1,
    groupSize: 1,
    shipperId: shipper,
    status: "OPEN",
    origin: cityPlace(from, addrA),
    dest: cityPlace(to, addrB),
    pickupAt: now + hoursAhead * H,
    cargo,
    tempMax,
    price,
    insurance: i % 2 === 0,
    insuranceFee: i % 2 === 0 ? Math.round(price * 0.015) : 0,
    createdAt: now - i * 17 * 60_000,
    media: [],
  };
};

export function buildSeed(): State {
  const now = Date.now();
  const seeds: Seed[] = [
    ["u-shipper1", "تهران", "اصفهان", "dairy", 4, 17_500_000, 6, "شهرک صنعتی شمس‌آباد، خیابان ۱۲", "میدان جهاد، انبار مرکزی"],
    ["u-shipper2", "تهران", "مشهد", "icecream", -18, 41_000_000, 20, "جاده مخصوص کرج، کیلومتر ۸", "بلوار وکیل‌آباد، بین ۱۰ و ۱۲"],
    ["u-shipper3", "کرج", "قم", "pharma", 4, 5_200_000, 4, "مهرشهر، بلوار ارم", "شهرک صنعتی شکوهیه"],
    ["u-shipper1", "شیراز", "اصفهان", "meat", 0, 14_500_000, 30, "شهرک صنعتی بزرگ شیراز", "سه‌راه سیمین"],
    ["u-shipper2", "تبریز", "تهران", "dairy", 4, 26_500_000, 12, "جاده آذرشهر، شهرک صنعتی", "بزرگراه آزادگان، انبار ۷"],
    ["u-shipper3", "رشت", "تهران", "pharma", 4, 9_400_000, 9, "منطقه صنعتی رشت", "خیابان شریعتی، داروخانه مرکزی"],
    ["u-shipper1", "اهواز", "شیراز", "icecream", -20, 22_000_000, 40, "شهرک صنعتی اهواز", "بلوار امیرکبیر"],
    ["u-shipper2", "مشهد", "تهران", "meat", -18, 39_000_000, 26, "سه‌راه ملک‌آباد", "میدان بار حسن‌آباد"],
    ["u-shipper3", "یزد", "کرمان", "dairy", 4, 13_000_000, 15, "شهرک صنعتی یزد", "میدان آزادی"],
  ];
  const orders = seeds.map((s, i) => mk(i + 1, now, s));

  // A finished trip so reports & history aren't empty.
  orders.push({
    ...mk(90, now, ["u-shipper1", "تهران", "قم", "dairy", 4, 4_200_000, -30, "جاده ساوه", "میدان شهدا"]),
    id: "o-seed-done",
    status: "DELIVERED",
    driverId: "u-driver1",
    assignedAt: now - 3 * D,
    startedAt: now - 3 * D + H,
    deliveredAt: now - 3 * D + 4 * H,
    waybillNo: "KM-۱۴۰۴۰۰۱",
    createdAt: now - 4 * D,
  });

  return {
    ready: true,
    users,
    drivers: drivers(now),
    orders,
    templates: [],
    ratings: [],
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
