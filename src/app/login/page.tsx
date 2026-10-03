import { ShieldCheck, Truck, Package } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { Card } from "@/components/ui";

export const metadata = { title: "ورود | کامیونت" };

const PORTALS = [
  { href: "/app/login/", title: "پنل صاحب بار", body: "ثبت سفارش، رهگیری زنده و کنترل دما.", icon: Package, ring: "hover:border-accent-600" },
  { href: "/driver/login/", title: "اپ راننده", body: "انتخاب بار، سفر، درآمد و برداشت.", icon: Truck, ring: "hover:border-brand-500" },
  { href: "/admin/login/", title: "مدیریت", body: "کنسول عملیات و مالی (اعضای تیم).", icon: ShieldCheck, ring: "hover:border-slate-700" },
];

export default function Page() {
  return (
    <main className="min-h-dvh bg-surface-2">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
        <Link href="/" aria-label="صفحه‌ی اصلی"><Logo /></Link>
        <div><h1 className="text-2xl font-black">به کدام بخش وارد می‌شوید؟</h1><p className="mt-1 text-sm text-ink-3">هر بخش ورود و نشست جداگانه دارد.</p></div>
        <div className="grid gap-3">
          {PORTALS.map((p) => (
            <Link key={p.href} href={p.href} className="block">
              <Card className={`flex items-center gap-4 border-2 border-transparent p-5 transition ${p.ring}`}>
                <span className="grid size-12 place-items-center rounded-ui bg-surface-3"><p.icon className="size-6" aria-hidden /></span>
                <span><span className="block font-extrabold">{p.title}</span><span className="block text-sm text-ink-3">{p.body}</span></span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
