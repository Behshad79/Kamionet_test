"use client";

import { AdminShell } from "@/components/AdminShell";
import { Card, Stat } from "@/components/ui";
import { fa, jShort, toman } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { platformFee } from "@/lib/pricing";

const DAY = 86_400_000;

export default function AdminHome() {
  const { s } = useApp();
  const o = s.orders;
  const delivered = o.filter((x) => x.status === "DELIVERED");
  const matched = o.filter((x) => ["ASSIGNED", "IN_TRANSIT", "DELIVERED"].includes(x.status));
  const conv = o.length ? Math.round((matched.length / o.length) * 100) : 0;
  const revenue = delivered.reduce((n, x) => n + platformFee(x.price, s.config), 0);
  const pipeline = o.filter((x) => ["ASSIGNED", "IN_TRANSIT"].includes(x.status)).reduce((n, x) => n + platformFee(x.price, s.config), 0);
  const gmv = delivered.reduce((n, x) => n + x.price, 0);

  const start = new Date().setHours(0, 0, 0, 0) - 6 * DAY;
  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = start + i * DAY;
    return { d, n: o.filter((x) => x.createdAt >= d && x.createdAt < d + DAY).length };
  });
  const max = Math.max(1, ...bars.map((b) => b.n));
  const drivers = s.drivers.filter((d) => d.kyc === "verified").length;

  return (
    <AdminShell title="گزارش‌ها">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="کل سفارش‌ها" value={fa(o.length)} sub={`${fa(o.filter((x) => x.status === "OPEN").length)} سفارش باز`} />
        <Stat label="نرخ تخصیص" value={`${fa(conv)}٪`} sub={`${fa(matched.length)} از ${fa(o.length)} سفارش`} tone="accent" />
        <Stat label="درآمد کارمزد (تحویل‌شده)" value={<span className="text-xl">{toman(revenue)}</span>} sub={`در جریان: ${toman(pipeline)}`} />
        <Stat label="رانندگان تأییدشده" value={fa(drivers)} sub={`گردش مالی: ${toman(gmv)}`} />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-bold">حجم سفارش‌های ۷ روز اخیر</h2>
        <div className="flex h-44 items-end gap-3" role="img" aria-label="نمودار حجم سفارش">
          {bars.map((b) => (
            <div key={b.d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-bold tabular">{fa(b.n)}</span>
              <div className="w-full rounded-t-lg bg-brand-500 transition-all" style={{ height: `${Math.max(3, (b.n / max) * 78)}%` }} />
              <span className="text-[11px] text-ink-3">{jShort(b.d)}</span>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
