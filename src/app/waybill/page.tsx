"use client";

import { Printer, ShieldCheck } from "lucide-react";
import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { Logo } from "@/components/brand";
import { PlateView } from "@/components/graphics/PlateInput";
import { Button, Skeleton } from "@/components/ui";
import { person } from "@/lib/engine/core";
import { CARGO, fa, jDateTime, PAY_TERMS, tempRange, toman, weightLabel } from "@/lib/format";
import { useQueryParam } from "@/lib/hooks";
import { faRaw } from "@/lib/money";
import { useStore } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";
import type { Order, State } from "@/lib/types";

/**
 * Printable waybill (بارنامه). Prototype document: the national electronic waybill integration is a stub, see DECISIONS.md.
 * Carries a Kamionet electronic seal, QR to the public tracking page, parties, cargo, insurance, money and version history.
 */
export default function Page() {
  const s = useStore();
  const id = useQueryParam("id");
  const v = useQueryParam("v");
  const o = s.orders.find((x) => x.id === id);
  if (!s.ready || id === undefined) return <div className="p-8"><Skeleton className="h-96" /></div>;
  const w = o?.waybills.find((x) => x.v === Number(v)) ?? o?.waybills[o.waybills.length - 1];
  if (!o || !w) return <div className="p-10 text-center font-bold">بارنامه پیدا نشد.</div>;
  return <Doc o={o} w={w} s={s} />;
}

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }, [text]);
  return <div className="size-24 shrink-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="کد QR رهگیری" />;
}

/** Round electronic seal. Text on a circle + monogram + document code, drawn as SVG so it prints crisply. */
function Seal({ code, at, className }: { code: string; at: number; className?: string }) {
  const d = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="مُهر الکترونیکی کامیونت" style={{ mixBlendMode: "multiply", transform: "rotate(-11deg)" }}>
      <defs><path id="sealTop" d="M30 100a70 70 0 0 1 140 0" /><path id="sealBot" d="M24 100a76 76 0 0 0 152 0" /></defs>
      <g fill="none" stroke="#1a56a6" strokeOpacity=".85">
        <circle cx="100" cy="100" r="94" strokeWidth="4" /><circle cx="100" cy="100" r="86" strokeWidth="1.2" /><circle cx="100" cy="100" r="58" strokeWidth="1.6" /><circle cx="100" cy="100" r="54" strokeWidth=".8" strokeDasharray="2 3" />
      </g>
      <g fill="#1a56a6" fillOpacity=".9" fontFamily="Vazirmatn, sans-serif" fontWeight="800">
        <text fontSize="15" letterSpacing="1"><textPath href="#sealTop" startOffset="50%" textAnchor="middle">کامیونت · سامانه‌ی حمل بار یخچالی</textPath></text>
        <text fontSize="12" letterSpacing="1.2"><textPath href="#sealBot" startOffset="50%" textAnchor="middle">مُهر الکترونیکی · معتبر بدون امضای دستی</textPath></text>
        <g transform="translate(100 78)" fill="none" stroke="#1a56a6" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round"><path d="M-22 14V-8h24v22M2 -2h12l9 9v7H2" /><circle cx="-12" cy="16" r="4.6" fill="#fff" /><circle cx="12" cy="16" r="4.6" fill="#fff" /></g>
        <text x="100" y="116" fontSize="13" textAnchor="middle">{d}</text>
        <text x="100" y="134" fontSize="10.5" textAnchor="middle" direction="ltr" fontFamily="monospace" fontWeight="700">{code}</text>
      </g>
      <g fill="#c4161c" fillOpacity=".75"><text x="100" y="51" fontSize="9" textAnchor="middle" fontFamily="Vazirmatn, sans-serif" fontWeight="800">ثبت‌شده</text></g>
    </svg>
  );
}

function Box({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`break-inside-avoid rounded-xl border border-ink/25 ${className}`}><h2 className="rounded-t-xl border-b border-ink/25 bg-ink/[0.04] px-3 py-1.5 text-[13px] font-black">{title}</h2><div className="p-3">{children}</div></section>;
}
const F = ({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) => <div className={wide ? "col-span-2" : ""}><dt className="text-[11px] text-ink-3">{k}</dt><dd className="text-[13px] font-bold leading-6">{v || "—"}</dd></div>;

function Doc({ o, w, s }: { o: Order; w: Order["waybills"][number]; s: State }) {
  const shipper = person(s, o.shipperId);
  const sh = s.shippers.find((x) => x.personId === o.shipperId);
  const driver = person(s, o.driverId);
  const d = s.drivers.find((x) => x.personId === o.driverId);
  const prod = s.products.find((p) => p.id === o.insurance.productId);
  const ins = s.insurers.find((i) => i.id === prod?.insurerId);
  const code = `KM-${o.id.toUpperCase()}-V${w.v}`;
  const serial = faRaw(String(100000 + (o.createdAt % 899999)));
  const total = w.freight + w.insurancePremium + o.tipPre + o.vat - o.discount;
  const current = !w.supersededAt;
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/track/?t=${o.consignee.token}`;
  const prev = o.waybills.find((x) => x.v === w.v - 1);
  return (
    <main className="mx-auto max-w-[820px] bg-white p-4 sm:p-8 print:p-0">
      <div className="no-print mb-4 flex items-center justify-between gap-3"><p className="text-xs text-ink-3">نمونه‌ی نمایشی؛ بارنامه‌ی رسمی الکترونیکی ملی در این نسخه متصل نیست.</p><Button onClick={() => window.print()}><Printer className="size-4" aria-hidden />چاپ / ذخیره PDF</Button></div>

      <article className="relative space-y-3 rounded-2xl border-[3px] border-double border-ink p-5 print:rounded-none print:border-[3px]">
        <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden text-[110px] font-black text-ink/[0.035] [transform:rotate(-24deg)]">کامیونت</span>

        <header className="relative flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-3">
          <div className="space-y-2"><Logo /><div className="text-[11px] text-ink-3">پلتفرم حمل بار یخچالی · مستقیم، شفاف، بیمه‌شده</div></div>
          <div className="text-center"><div className="text-3xl font-black tracking-tight">بارنامه‌ی حمل کالا</div><div className="mt-1 inline-flex items-center gap-2 rounded-full border border-ink px-3 py-0.5 text-xs font-black">{current ? "نسخه‌ی جاری" : "نسخه‌ی باطل‌شده (جایگزین شد)"} · نسخه {fa(w.v)} از {fa(o.waybills.length)}</div></div>
          <div className="flex items-center gap-3"><div className="space-y-1 text-end text-[12px]"><div className="text-ink-3">شماره‌ی بارنامه</div><div dir="ltr" className="font-mono text-sm font-black">{code}</div><div className="text-ink-3">سری</div><div className="font-black tabular">{serial}</div></div><Qr text={link} /></div>
        </header>

        <div className="relative grid gap-3 sm:grid-cols-2">
          <Box title="فرستنده (صاحب بار)"><dl className="grid grid-cols-2 gap-2"><F k="نام" v={sh?.displayName ?? shipper?.name} /><F k="شرکت" v={sh?.company?.name} /><F k="کد اقتصادی" v={sh?.company?.economicCode} /><F k="تلفن" v={<span dir="ltr">{shipper?.phone}</span>} /></dl></Box>
          <Box title="گیرنده"><dl className="grid grid-cols-2 gap-2"><F k="نام" v={o.consignee.name} /><F k="تلفن" v={<span dir="ltr">{o.consignee.phone}</span>} /><F wide k="روش تحویل" v="تحویل با کد یک‌بارمصرف گیرنده" /></dl></Box>
          <Box title="حمل‌کننده (راننده و خودرو)"><dl className="grid grid-cols-2 gap-2"><F k="راننده" v={driver?.name} /><F k="تلفن" v={driver ? <span dir="ltr">{driver.phone}</span> : undefined} /><F k="نوع خودرو" v={VEHICLES[o.vehicleKind].label} /><F k="ظرفیت" v={d ? `${fa(d.vehicle.capacityKg)} کیلوگرم` : undefined} /><F wide k="پلاک" v={d?.vehicle.plate ? <PlateView plate={d.vehicle.plate} className="h-9! scale-90 origin-right" /> : "—"} /></dl></Box>
          <Box title="مسیر و زمان‌بندی"><dl className="grid grid-cols-2 gap-2"><F k="مبدأ" v={`${o.origin.city} · ${o.origin.address || "—"}`} /><F k="مقصد" v={`${o.dest.city} · ${o.dest.address || "—"}`} /><F k="مسافت" v={`${fa(o.distanceKm)} کیلومتر`} /><F k="شروع بارگیری" v={jDateTime(o.pickupAt)} /><F k="مهلت تحویل" v={jDateTime(o.deliverBy)} /><F k="تاریخ صدور" v={jDateTime(w.at)} /></dl></Box>
        </div>

        <Box title="مشخصات محموله" className="relative">
          <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead className="text-ink-3"><tr>{["نوع بار", "وزن", "پالت", "حجم", "بسته‌بندی", "دمای مجاز", "ارزش اعلامی"].map((h) => <th key={h} scope="col" className="p-1.5 text-start text-[11px] font-medium">{h}</th>)}</tr></thead>
            <tbody><tr className="border-t border-ink/20 font-bold"><td className="p-1.5">{CARGO[w.cargo].label}</td><td className="p-1.5 tabular">{weightLabel(w.weightKg)}</td><td className="p-1.5 tabular">{w.pallets ? fa(w.pallets) : "—"}</td><td className="p-1.5 tabular">{w.volumeM3 ? `${fa(w.volumeM3)} م‌م` : "—"}</td><td className="p-1.5">{o.packaging}</td><td className="p-1.5">{o.tempMin !== undefined && o.tempMax !== undefined ? tempRange(o.tempMin, o.tempMax) : "بدون کنترل دما"}</td><td className="p-1.5 tabular">{toman(w.declaredValue)}</td></tr></tbody></table></div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full border border-ink/30 px-2 py-0.5">{o.cargoMode === "AMBIENT" ? "غیریخچالی" : "یخچالی"}</span>{o.odor !== "NONE" && <span className="rounded-full border border-ink/30 px-2 py-0.5">بوی {o.odor === "STRONG" ? "شدید" : "کم"}</span>}{o.itemizedInvoice && <span className="rounded-full border border-ink/30 px-2 py-0.5">فاکتور ریزمتن‌دار</span>}{o.serviceClass === "PRO" && <span className="rounded-full border border-ink/30 px-2 py-0.5">سرویس پرو</span>}</div>
        </Box>

        <div className="relative grid gap-3 sm:grid-cols-2">
          <Box title="بیمه‌ی محموله">{prod ? <dl className="grid grid-cols-2 gap-2"><F k="بیمه‌گر" v={ins?.name} /><F k="طرح" v={prod.name} /><F k="سقف پوشش" v={toman(o.insurance.coverage)} /><F k="فرانشیز" v={toman(o.insurance.deductible)} /><F wide k="حق بیمه" v={toman(w.insurancePremium)} /></dl> : <p className="text-[13px] font-bold">بدون بیمه؛ خسارت احتمالی بر عهده‌ی صاحب بار است.</p>}</Box>
          <Box title="خلاصه‌ی مالی (صاحب بار)"><dl className="grid grid-cols-2 gap-2"><F k="کرایه" v={toman(w.freight)} /><F k="حق بیمه" v={toman(w.insurancePremium)} />{o.tipPre > 0 && <F k="انعام" v={toman(o.tipPre)} />}{o.discount > 0 && <F k="تخفیف" v={`−${toman(o.discount)}`} />}<F k="جمع کل" v={<span className="text-base font-black">{toman(total)}</span>} /><F k="شرایط پرداخت" v={PAY_TERMS[o.terms]} /></dl></Box>
        </div>

        {o.waybills.length > 1 && (
          <Box title="تاریخچه‌ی نسخه‌ها" className="relative">
            <table className="w-full text-[12px]"><thead className="text-ink-3"><tr>{["نسخه", "تاریخ", "دلیل", "وزن", "کرایه"].map((h) => <th key={h} scope="col" className="p-1 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>{o.waybills.map((x) => <tr key={x.v} className={`border-t border-ink/20 ${x.v === w.v ? "font-black" : "text-ink-3"}`}><td className="p-1">{fa(x.v)}{x.supersededAt ? " (باطل)" : " (جاری)"}</td><td className="p-1">{jDateTime(x.at)}</td><td className="p-1">{x.reason}</td><td className="p-1 tabular">{weightLabel(x.weightKg)}</td><td className="p-1 tabular">{toman(x.freight)}</td></tr>)}</tbody></table>
            {prev && <p className="mt-2 text-[12px] font-bold text-warn">تغییر نسبت به نسخه‌ی {fa(prev.v)}: {prev.weightKg !== w.weightKg ? `وزن ${weightLabel(prev.weightKg)} ← ${weightLabel(w.weightKg)}؛ ` : ""}{prev.freight !== w.freight ? `کرایه ${toman(prev.freight)} ← ${toman(w.freight)}` : ""}</p>}
          </Box>
        )}

        <Box title="شرایط و تعهدات" className="relative">
          <ol className="list-decimal space-y-1 ps-5 text-[12px] leading-6 text-ink-2">
            <li>راننده متعهد است بار را در بازه‌ی دمایی بالا نگه دارد و خروج از بازه ثبت و گزارش می‌شود.</li>
            <li>تحویل فقط با کد یک‌بارمصرف گیرنده معتبر است؛ کد را به غیر از گیرنده ندهید.</li>
            <li>هرگونه مغایرت در بارگیری با مدرک عکس‌دار ثبت و موجب صدور نسخه‌ی جدید بارنامه می‌شود؛ نسخه‌های قبلی باطل است.</li>
            <li>پرداخت‌ها نزد کامیونت امانت می‌ماند و پس از تحویل و پنجره‌ی اعتراض آزاد می‌شود.</li>
            <li>مسئولیت خسارت مطابق قوانین و مقررات کامیونت و شرایط بیمه‌نامه‌ی انتخابی است.</li>
          </ol>
        </Box>

        <div className="relative grid grid-cols-3 gap-3">
          {[["امضای فرستنده", "ثبت‌شده با ورود OTP", o.createdAt], ["امضای راننده", d ? "تأیید در اپ راننده" : "—", o.assignedAt], ["امضای گیرنده", o.deliveredAt ? "تحویل با کد یک‌بارمصرف" : "در انتظار تحویل", o.deliveredAt]].map(([t, sub, at]) => (
            <div key={String(t)} className="flex h-24 flex-col justify-between rounded-xl border border-dashed border-ink/40 p-2.5"><div className="text-[12px] font-black">{t}</div><div className="text-[11px] text-ink-3">{sub}{at ? ` · ${jDateTime(at as number)}` : ""}</div></div>
          ))}
        </div>

        <footer className="relative flex items-end justify-between gap-4 border-t-2 border-ink pt-3">
          <div className="space-y-1 text-[11px] leading-6 text-ink-3"><div className="flex items-center gap-1.5 font-bold text-ink"><ShieldCheck className="size-4 text-ok" aria-hidden />اصالت‌سنجی از طریق QR یا شناسه‌ی {code}</div><div>صادرشده توسط کامیونت · {jDateTime(w.at)}</div><div>این سند دارای مُهر الکترونیکی است و نیازی به مهر یا امضای دستی ندارد.</div></div>
          <Seal code={code} at={w.at} className="size-36 shrink-0" />
        </footer>
      </article>
    </main>
  );
}
