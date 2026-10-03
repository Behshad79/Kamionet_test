"use client";

import { Printer, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button, Skeleton } from "@/components/ui";
import { person } from "@/lib/engine/core";
import { CARGO, degrees, fa, jDateTime, tempRange, weightLabel } from "@/lib/format";
import { useQueryParam } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { excursions, readings, stats, telemetryOf } from "@/lib/telemetry";
import { VEHICLES } from "@/lib/vehicles";

/** Cold-chain certificate (printable → "save as PDF"). Readings are the simulated sensor feed, labelled as such. */
export default function Page() {
  const s = useStore();
  const t = useQueryParam("t");
  const id = useQueryParam("id");
  if (!s.ready || t === undefined || id === undefined) return <div className="p-8"><Skeleton className="h-96" /></div>;
  const o = s.orders.find((x) => (t ? x.consignee.token === t : x.id === id));
  if (!o || !o.loadedAt || o.tempMin === undefined || o.tempMax === undefined) return <div className="p-10 text-center font-bold">گواهی برای این سفارش موجود نیست (سفر هنوز آغاز نشده یا بار بدون کنترل دماست).</div>;
  const tel = telemetryOf(o);
  const rs = readings(tel, o.deliveredAt ?? Date.now());
  const ex = excursions(rs);
  const st = stats(rs);
  const d = s.drivers.find((x) => x.personId === o.driverId);
  const W = 640, H = 200, P = { l: 36, r: 10, t: 12, b: 22 };
  const cs = rs.map((r) => r.c);
  const lo = Math.min(o.tempMin, ...cs) - 1.5, hi = Math.max(o.tempMax, ...cs) + 1.5;
  const t0 = tel.startedAt!, t1 = o.deliveredAt ?? rs[rs.length - 1]?.at ?? t0 + 1;
  const x = (v: number) => P.l + ((v - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (c: number) => P.t + (1 - (c - lo) / (hi - lo)) * (H - P.t - P.b);
  const clean = ex.length === 0;
  const no = `CC-${o.id.toUpperCase()}`;
  return (
    <main className="mx-auto max-w-3xl space-y-5 bg-white p-6 sm:p-10">
      <div className="no-print flex justify-end"><Button onClick={() => window.print()}><Printer className="size-4" aria-hidden />چاپ / ذخیره PDF</Button></div>
      <header className="flex items-center justify-between border-b-2 border-ink pb-4"><Logo /><div className="text-end"><div className="text-xl font-black">گواهی زنجیره‌ی سرد</div><div dir="ltr" className="text-sm text-ink-3">{no}</div></div></header>
      <div className={`flex items-center gap-3 rounded-ui p-4 ${clean ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}><ShieldCheck className="size-8" aria-hidden /><div><div className="font-black">{clean ? "دمای بار در تمام مسیر در بازه‌ی مجاز بود" : `${fa(ex.length)} انحراف دمایی ثبت شد`}</div><div className="text-sm">بازه‌ی مجاز: {tempRange(o.tempMin, o.tempMax)}</div></div></div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {[["مسیر", `${o.origin.city} ← ${o.dest.city}`], ["نوع بار", CARGO[o.cargo].label], ["وزن", weightLabel(o.weightKg)], ["خودرو", VEHICLES[o.vehicleKind].label], ["راننده", person(s, o.driverId)?.name ?? "—"], ["پلاک", d?.vehicle.plate ? `${d.vehicle.plate.two} ${d.vehicle.plate.letter} ${d.vehicle.plate.three} ایران ${d.vehicle.plate.prov}` : "—"], ["شروع حمل", jDateTime(t0)], ["تحویل", o.deliveredAt ? jDateTime(o.deliveredAt) : "در حال حمل"], ["کمترین / بیشترین دما", st ? `${degrees(st.min)} / ${degrees(st.max)}` : "—"], ["میانگین", st ? degrees(Math.round(st.avg * 10) / 10) : "—"]].map(([k, v]) => <div key={k}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{v}</dd></div>)}
      </dl>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-ui border border-line" role="img" aria-label="نمودار دمای مسیر">
        <rect x={P.l} y={y(o.tempMax)} width={W - P.l - P.r} height={y(o.tempMin) - y(o.tempMax)} fill="#E8F6FC" />
        <polyline fill="none" stroke="#146EB4" strokeWidth="2" points={rs.map((r) => `${x(r.at)},${y(r.c)}`).join(" ")} />
        {rs.filter((r) => r.out).map((r) => <circle key={r.at} cx={x(r.at)} cy={y(r.c)} r="3.5" fill="#B91C1C" />)}
        {[o.tempMin, o.tempMax].map((v) => <text key={v} x="4" y={y(v) + 4} fontSize="11" fill="#5B6472">{degrees(v)}</text>)}
      </svg>
      {ex.length > 0 && <div><h2 className="mb-2 font-extrabold">انحراف‌های ثبت‌شده</h2><table className="w-full text-sm"><thead><tr className="text-start text-ink-3"><th className="p-2 text-start">از</th><th className="p-2 text-start">تا</th><th className="p-2 text-start">اوج</th></tr></thead><tbody>{ex.map((e) => <tr key={e.from} className="border-t border-line"><td className="p-2">{jDateTime(e.from)}</td><td className="p-2">{jDateTime(e.to)}</td><td className="p-2 font-bold">{degrees(e.peak)}</td></tr>)}</tbody></table></div>}
      <footer className="space-y-2 border-t border-line pt-4 text-xs leading-6 text-ink-3"><p>داده‌ی دما در این نسخه‌ی نمایشی شبیه‌سازی شده است؛ در نسخه‌ی عملیاتی از حسگر یخچال خودرو می‌آید.</p><p>صادرکننده: کامیونت · {jDateTime(Date.now())}</p></footer>
    </main>
  );
}
