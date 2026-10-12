import type { Item } from "@/lib/inventory";
import type { Order, OrderStatus, State } from "@/lib/types";
import { demoSignIn } from "@/lib/store";

/**
 * Resolves an inventory item (page / view / sheet / step…) to a concrete place inside the running prototype:
 * which demo persona to sign in as and which URL to open. Order-bound states pick a seeded order that is
 * really in that status, so the designer sees the true screen, not a mock.
 */
export type Portal = "shipper" | "driver" | "admin";
export interface Target { ok: true; portal?: Portal; phone?: string; href: string; as?: string; reach?: string }
export interface Miss { ok: false; why: string }
export type Resolved = Target | Miss;

const ST: Record<string, OrderStatus[]> = {
  open: ["OPEN", "PRO_POOL"], direct: ["DIRECT_REQUESTED"], locked: ["LOCKED"], deposit: ["AWAITING_DEPOSIT"], assigned: ["ASSIGNED"],
  toPickup: ["EN_ROUTE_TO_PICKUP"], atPickup: ["AT_PICKUP"], transit: ["IN_TRANSIT", "AT_DELIVERY"], mismatch: ["MISMATCH_REVIEW"],
  delivered: ["DELIVERED"], completed: ["COMPLETED"], cancelled: ["CANCELLED_BY_SHIPPER", "CANCELLED_BY_DRIVER", "CANCELLED_BY_SYSTEM", "EXPIRED"],
};

const phoneOf = (s: State, id?: string) => s.persons.find((p) => p.id === id)?.phone;
const firstOrder = (s: State, st: OrderStatus[], pred: (o: Order) => boolean = () => true) => {
  for (const x of st) { const o = s.orders.find((o) => o.status === x && pred(o)); if (o) return o; }
  return undefined;
};
const miss = (what: string): Miss => ({ ok: false, why: `در داده‌ی دمو الان سفارشی در وضعیت «${what}» نیست؛ از «کارگردان دمو» (مدیریت) یا «بازنشانی دمو» استفاده کنید.` });
const ANY_ORDERS = [...ST.transit, ...ST.toPickup, ...ST.atPickup, ...ST.assigned, ...ST.delivered, ...ST.completed, ...ST.open];

const shipperOrder = (s: State, key: string, label: string): Resolved => {
  const o = firstOrder(s, ST[key], (x) => !!phoneOf(s, x.shipperId));
  return o ? { ok: true, portal: "shipper", phone: phoneOf(s, o.shipperId), href: `/app/order/?id=${o.id}` } : miss(label);
};
/** The driver tied to an order in any pre-trip state: assigned, holding the lock, or the one a direct request targets. */
const driverIdOf = (o: Order) => o.driverId ?? o.lockedBy ?? o.directDriverId;
const driverOrder = (s: State, key: string, label: string, page: "order" | "trip"): Resolved => {
  const o = firstOrder(s, ST[key], (x) => !!phoneOf(s, driverIdOf(x)));
  return o ? { ok: true, portal: "driver", phone: phoneOf(s, driverIdOf(o)), href: `/driver/${page}/?id=${o.id}` } : miss(label);
};
const verifiedDriver = (s: State) => s.drivers.find((d) => d.kyc.status === "verified" && !d.suspension);
const adminPhone = (s: State, role = "super") => s.admins.find((a) => a.role === role && a.active)?.phone ?? s.admins[0]?.phone;

/** Order-view keyword → status key. First hit wins. */
const VIEW_KEYS: [RegExp, string, string][] = [
  [/درخواست مستقیم/, "direct", "درخواست مستقیم"], [/LOCKED|در حال تأیید/, "locked", "در حال تأیید راننده"], [/بیعانه/, "deposit", "در انتظار بیعانه"],
  [/مغایرت/, "mismatch", "مغایرت بار"], [/تحویل‌شده/, "delivered", "تحویل‌شده"], [/تکمیل‌شده/, "completed", "تکمیل‌شده"], [/لغو|منقضی/, "cancelled", "لغو/منقضی"],
  [/تخصیص‌یافته|در مسیر|نقشه/, "transit", "در مسیر"], [/در انتظار راننده|OPEN/, "open", "باز"],
];
const TRIP_KEYS: [RegExp, string, string][] = [
  [/به‌سوی مبدأ/, "toPickup", "به‌سوی مبدأ"], [/رسیدن و انتظار|بارگیری/, "atPickup", "در مبدأ"], [/تحویل‌شده/, "delivered", "تحویل‌شده"], [/در مسیر|رسیدن به مقصد|تحویل با کد/, "transit", "در مسیر"],
];
const hit = (keys: [RegExp, string, string][], name: string) => keys.find(([r]) => r.test(name));

export function resolve(it: Item, s: State): Resolved {
  const n = it.name, r = it.route ?? "";
  if (!s.ready) return { ok: false, why: "داده‌ی دمو هنوز بارگذاری نشده است." };

  /* public & doc pages */
  if (it.sec === "P") {
    if (r === "همه‌ی پنل‌ها") {
      if (/تماس/.test(n)) { const o = firstOrder(s, ST.transit); return o ? { ok: true, portal: "shipper", phone: phoneOf(s, o.shipperId), href: `/app/order/?id=${o.id}`, reach: "دکمه‌ی «تماس درون‌برنامه‌ای» در کارت گفتگو؛ طرف مقابل را در تب دیگر با شخصیت راننده باز کنید." } : miss("در مسیر"); }
      const sh = s.shippers[0];
      return { ok: true, portal: "shipper", phone: phoneOf(s, sh?.personId), href: "/app/", reach: /پذیرش قوانین|حساب‌های دمو/.test(n) ? "قوانین هنگام اولین عمل مهم نمایش داده می‌شود؛ حساب‌های دمو از منوی «دمو» پایین صفحه." : "دکمه‌ی شناور «پشتیبانی» پایین صفحه." };
    }
    if (r === "/blog/[slug]") return { ok: true, href: "/blog/refrigerated-freight-cost-iran/" };
    if (r === "/track" || r === "/track/demo") {
      const o = firstOrder(s, ST.transit) ?? firstOrder(s, ST.delivered) ?? firstOrder(s, ANY_ORDERS);
      if (/نامعتبر/.test(n)) return { ok: true, href: "/track/?t=invalid" };
      if (/در انتظار بارگیری/.test(n)) { const a = firstOrder(s, [...ST.assigned, ...ST.toPickup]); return a ? { ok: true, href: `/track/?t=${a.consignee.token}` } : miss("تخصیص‌یافته"); }
      if (/تحویل‌شده/.test(n)) { const a = firstOrder(s, ST.completed) ?? firstOrder(s, ST.delivered); return a ? { ok: true, href: `/track/?t=${a.consignee.token}` } : miss("تحویل‌شده"); }
      if (r === "/track/demo") return { ok: true, href: "/track/demo/" };
      return o ? { ok: true, href: `/track/?t=${o.consignee.token}` } : miss("در مسیر");
    }
    if (r === "/waybill" || r === "/certificate") {
      const o = firstOrder(s, ANY_ORDERS, (x) => (r === "/waybill" ? x.waybills.length > 0 : x.tempMin !== undefined));
      return o ? { ok: true, portal: "shipper", phone: phoneOf(s, o.shipperId), href: `${r}/?id=${o.id}` } : miss("دارای بارنامه/گواهی");
    }
    if (/^\/(app|driver|admin)\/login|\/\*\/login/.test(r)) return { ok: true, href: r.startsWith("/*") ? "/app/login/" : `${r}/`, reach: "اگر وارد شده‌اید، ابتدا از پروفایل خارج شوید." };
    if (r === "/" || r === "/login" || r === "/blog") return { ok: true, href: r === "/" ? "/" : `${r}/` };
    return { ok: false, why: "این بخش در همه‌ی پنل‌ها شناور است؛ از مسیر توضیح‌داده‌شده باز می‌شود (دکمه‌ی صفحه‌ی میزبان)." };
  }

  /* admin */
  if (it.sec === "A") {
    const href = r.startsWith("/admin") ? `${r.replace(/\/$/, "")}/` : "/admin/";
    const role = /مالی|پرداخت|برداشت|بازپرداخت|بدهی|فاکتور|مغایرت‌گیری|دفتر/.test(`${it.parent ?? ""}${n}`) ? "finance_mgr" : "super";
    return { ok: true, portal: "admin", phone: adminPhone(s, role), href, as: role };
  }

  /* shipper panel */
  if (it.sec === "S") {
    const sh = s.shippers.find((x) => !x.controls.blocked && s.orders.some((o) => o.shipperId === x.personId)) ?? s.shippers[0];
    const phone = phoneOf(s, sh?.personId);
    if (/بدون سفارش/.test(n)) { const e = s.shippers.find((x) => !s.orders.some((o) => o.shipperId === x.personId)); return e ? { ok: true, portal: "shipper", phone: phoneOf(s, e.personId), href: "/app/" } : { ok: true, href: "/app/login/", reach: "با یک شماره‌ی تازه، کد ۱۲۳۴۵ و نام وارد شوید؛ داشبورد خالی همان‌جا دیده می‌شود." }; }
    if (/گروه چندخودرویی/.test(n)) { const o = s.orders.find((x) => x.groupSize > 1); return { ok: true, portal: "shipper", phone: phoneOf(s, o?.shipperId ?? s.shippers[0]?.personId), href: o ? "/app/" : "/app/new/", reach: o ? undefined : "در مرحله‌ی «بار» تعداد خودرو را ۲ یا بیشتر بگذارید و ثبت کنید؛ گروه در داشبورد دیده می‌شود." }; }
    return { ok: true, portal: "shipper", phone, href: r === "/app" ? "/app/" : `${r}/` };
  }

  /* shipper order management */
  if (it.sec === "O") {
    if (r === "/app/new") return { ok: true, portal: "shipper", phone: phoneOf(s, s.shippers[0]?.personId), href: "/app/new/" };
    if (r === "/app/driver") { const d = verifiedDriver(s); return d ? { ok: true, portal: "shipper", phone: phoneOf(s, s.shippers[0]?.personId), href: `/app/driver/?id=${d.personId}` } : miss("راننده‌ی تأییدشده"); }
    if (r === "/app/order") {
      const k = hit(VIEW_KEYS, n);
      if (it.kind === "view" && k) return shipperOrder(s, k[1], k[2]);
      const o = firstOrder(s, [...ST.transit, ...ST.delivered, ...ST.deposit, ...ST.open]);
      return o ? { ok: true, portal: "shipper", phone: phoneOf(s, o.shipperId), href: `/app/order/?id=${o.id}`, reach: it.kind === "sheet" ? "کارت/دکمه‌ی مربوط را در همین صفحه بزنید." : undefined } : miss("فعال");
    }
    return { ok: true, portal: "shipper", phone: phoneOf(s, s.shippers[0]?.personId), href: "/app/" };
  }

  /* driver app */
  const dv = verifiedDriver(s);
  const dphone = phoneOf(s, dv?.personId);
  if (r === "/driver/order" && it.kind === "page") { const o = firstOrder(s, ST.open); return o ? { ok: true, portal: "driver", phone: dphone, href: `/driver/order/?id=${o.id}` } : miss("باز"); }
  if (r === "/driver/order") { const k = hit(VIEW_KEYS, n); const key = /قابل رزرو|ناسازگار/.test(n) ? "open" : /رزرو/.test(n) ? "locked" : /در دسترس نیست/.test(n) ? "completed" : k?.[1]; if (/قابل رزرو|ناسازگار/.test(n)) { const o = firstOrder(s, ST.open); return o ? { ok: true, portal: "driver", phone: dphone, href: `/driver/order/?id=${o.id}` } : miss("باز"); } if (key === "completed") { const o = firstOrder(s, ST.completed); return o ? { ok: true, portal: "driver", phone: dphone, href: `/driver/order/?id=${o.id}` } : miss("تکمیل‌شده"); } return key ? driverOrder(s, key, k?.[2] ?? key, "order") : driverOrder(s, "locked", "در حال تأیید", "order"); }
  if (r === "/driver/trip") { const k = hit(TRIP_KEYS, n); return driverOrder(s, k?.[1] ?? "transit", k?.[2] ?? "در مسیر", "trip"); }
  if (r === "/driver/shipper") { const sh = s.shippers[0]; return { ok: true, portal: "driver", phone: dphone, href: `/driver/shipper/?id=${sh?.personId}` }; }
  if (r === "/driver/kyc") {
    const want = /در بررسی/.test(n) ? "pending" : /رد/.test(n) ? "rejected" : /معلق/.test(n) ? "suspended" : "draft";
    const d = want === "suspended" ? s.drivers.find((x) => x.suspension) : s.drivers.find((x) => x.kyc.status === want);
    if (d) return { ok: true, portal: "driver", phone: phoneOf(s, d.personId), href: "/driver/kyc/" };
    return { ok: true, portal: "driver", phone: undefined, href: "/driver/login/", reach: "برای مراحل ۱ تا ۷ با یک شماره‌ی تازه (کد ۱۲۳۴۵) وارد شوید؛ اپ مستقیم به احراز هویت می‌رود." };
  }
  if (/مهمان/.test(n)) return { ok: true, href: "/driver/", reach: "در پنجره‌ی ناشناس (بدون ورود) باز کنید." };
  if (/تأییدنشده/.test(n)) { const d = s.drivers.find((x) => x.kyc.status !== "verified" && x.kyc.status !== "none"); return d ? { ok: true, portal: "driver", phone: phoneOf(s, d.personId), href: "/driver/" } : miss("راننده‌ی تأییدنشده"); }
  if (/تور اولیه/.test(n)) return { ok: true, portal: "driver", phone: phoneOf(s, dv?.personId), href: "/driver/", reach: "تور فقط یک‌بار برای هر شماره نمایش داده می‌شود؛ با شماره‌ی تازه وارد شوید یا «بازنشانی دمو» بزنید." };
  if (/رادار/.test(n) && /غیرفعال/.test(n)) { const o = firstOrder(s, [...ST.transit, ...ST.toPickup], (x) => !!x.driverId); return o ? { ok: true, portal: "driver", phone: phoneOf(s, o.driverId), href: "/driver/radar/" } : miss("در سفر"); }
  const href = r === "/driver" ? "/driver/" : `${r}/`;
  const reach = it.kind === "sheet" || it.kind === "tab" ? "تب/دکمه‌ی توضیح‌داده‌شده را در همین صفحه بزنید." : undefined;
  return { ok: true, portal: "driver", phone: dphone, href, reach };
}

/** Sign in as the persona (shares storage with the new tab) and open the real screen. Returns an error text or null. */
export function openLive(t: Target): string | null {
  if (t.portal && t.phone) { const r = demoSignIn(t.portal, t.phone); if (!r.ok) return r.error ?? "ورود دمو ناموفق بود."; }
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  window.open(`${base}${t.href}`, "_blank");
  return null;
}
