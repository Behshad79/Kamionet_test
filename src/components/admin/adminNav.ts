import { Activity, BadgeDollarSign, Banknote, BellRing, BookOpenCheck, Building2, ClipboardList, Coins, CreditCard, FileText, Gauge, Gavel, Headset, History, Landmark, LayoutDashboard, ListChecks, Map, Megaphone, MessageSquareWarning, ReceiptText, RotateCcw, Scale, Settings2, ShieldAlert, ShieldCheck, Sparkles, Star, Truck, UserCheck, Users, UsersRound, Waves, type LucideIcon } from "lucide-react";

export interface AdminMod { slug: string; title: string; group: string; perm: string | string[]; icon: LucideIcon; keywords?: string }

/** Single source for the sidebar, command palette and route table. `perm` as an array means any-of. */
export const ADMIN_MODS: AdminMod[] = [
  { slug: "", title: "داشبورد", group: "عملیات", perm: "dashboard", icon: LayoutDashboard, keywords: "dashboard kpi" },
  { slug: "live", title: "عملیات زنده", group: "عملیات", perm: "liveops", icon: Map, keywords: "نقشه دما live" },
  { slug: "orders", title: "سفارش‌ها", group: "عملیات", perm: "orders.view", icon: ClipboardList },
  { slug: "dispatch", title: "کنسول توزیع بار", group: "عملیات", perm: "dispatch", icon: ListChecks, keywords: "تخصیص دستی" },
  { slug: "disputes", title: "اختلاف‌ها", group: "عملیات", perm: "disputes", icon: Gavel, keywords: "مغایرت" },
  { slug: "drivers", title: "رانندگان", group: "افراد", perm: "drivers.view", icon: Truck },
  { slug: "kyc", title: "احراز هویت و مدارک", group: "افراد", perm: "drivers.kyc", icon: UserCheck, keywords: "kyc" },
  { slug: "shippers", title: "صاحبان بار", group: "افراد", perm: "shippers.view", icon: Building2 },
  { slug: "pro", title: "رانندگان پرو", group: "افراد", perm: "pro", icon: Sparkles, keywords: "بازرسی" },
  { slug: "finance", title: "مرور مالی و دفتر کل", group: "مالی", perm: "finance.view", icon: Landmark, keywords: "تراز ledger" },
  { slug: "payments", title: "پرداخت‌ها و رسیدها", group: "مالی", perm: "finance.view", icon: CreditCard, keywords: "کارت به کارت receipts" },
  { slug: "payouts", title: "برداشت‌ها", group: "مالی", perm: "finance.view", icon: Banknote, keywords: "payout batch" },
  { slug: "refunds", title: "بازپرداخت‌ها", group: "مالی", perm: "finance.view", icon: RotateCcw },
  { slug: "debts", title: "بدهی رانندگان", group: "مالی", perm: "finance.view", icon: Scale },
  { slug: "invoices", title: "فاکتورها و مطالبات", group: "مالی", perm: "finance.view", icon: ReceiptText, keywords: "aging" },
  { slug: "recon", title: "مغایرت‌گیری و بستن روز", group: "مالی", perm: "finance.view", icon: BookOpenCheck, keywords: "reconciliation suspense" },
  { slug: "promo", title: "کد تخفیف و مشوق", group: "مالی", perm: "finance.view", icon: Coins, keywords: "coupon" },
  { slug: "claims", title: "بیمه و خسارت", group: "مالی", perm: ["insurance", "finance.view"], icon: ShieldCheck },
  { slug: "support", title: "مرکز پشتیبانی", group: "پشتیبانی و کیفیت", perm: ["support.trip", "support.account", "support.finance"], icon: Headset, keywords: "تیکت" },
  { slug: "reviews", title: "نظرات", group: "پشتیبانی و کیفیت", perm: "reviews", icon: Star },
  { slug: "washes", title: "برنامه‌ی نظافت", group: "پشتیبانی و کیفیت", perm: "cleanliness", icon: Waves },
  { slug: "risk", title: "تقلب و ریسک", group: "پشتیبانی و کیفیت", perm: "risk", icon: ShieldAlert },
  { slug: "broadcasts", title: "اعلان‌ها و پیامک", group: "پشتیبانی و کیفیت", perm: ["broadcasts", "finance.view"], icon: Megaphone, keywords: "sms push" },
  { slug: "config", title: "قیمت‌گذاری و تنظیمات", group: "سیستم", perm: ["pricing", "finance.config"], icon: Settings2, keywords: "کارمزد config" },
  { slug: "rules", title: "قوانین و سیاست‌ها", group: "سیستم", perm: "rules", icon: FileText },
  { slug: "master", title: "داده‌های پایه", group: "سیستم", perm: "master", icon: BadgeDollarSign, keywords: "نرخ مسیر" },
  { slug: "approvals", title: "تأییدهای دو نفره", group: "سیستم", perm: ["team", "finance.refunds", "finance.payouts", "finance.view"], icon: UsersRound },
  { slug: "team", title: "تیم و دسترسی‌ها", group: "سیستم", perm: "team", icon: Users, keywords: "rbac" },
  { slug: "audit", title: "گزارش ممیزی", group: "سیستم", perm: ["team", "finance.view"], icon: History },
  { slug: "system", title: "سلامت و یکپارچه‌سازی", group: "سیستم", perm: ["system", "integrations", "team"], icon: Activity },
];

export const modHref = (slug: string) => (slug ? `/admin/${slug}/` : "/admin/");
export const GROUPS = ["عملیات", "افراد", "مالی", "پشتیبانی و کیفیت", "سیستم"];
export const modAllowed = (m: AdminMod, can: (p: string) => boolean) => (Array.isArray(m.perm) ? m.perm.some(can) : can(m.perm));
export { Gauge, BellRing, MessageSquareWarning };
