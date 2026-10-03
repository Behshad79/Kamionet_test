"use client";

import { BadgeCheck, Check, Circle, Heart, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RulesStatus } from "@/components/rules";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Field, Input, Progress, Select, Tabs, Toggle } from "@/components/ui";
import { RatingPill } from "@/components/molecules";
import { person } from "@/lib/engine/core";
import { driverStats, shipperStats } from "@/lib/engine/stats";
import { fa, jShort, hhmm, tempRange } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";

type Tab = "profile" | "recurring" | "favorites" | "rules";
const CHECK: [keyof NonNullable<ReturnType<typeof usePortal>["shipper"]>["completeness"], string][] = [["name", "نام و نام خانوادگی"], ["company", "اطلاعات شرکت"], ["verify", "تأیید کسب‌وکار"], ["address", "نشانی انبار"], ["logo", "لوگو"]];

export default function Page() {
  const { s, me, shipper } = usePortal("shipper");
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(shipper?.displayName ?? "");
  const [co, setCo] = useState(shipper?.company?.name ?? "");
  const [code, setCode] = useState(shipper?.company?.economicCode ?? "");
  if (!me || !shipper) return null;
  const st = shipperStats(s, me.id);
  const done = Object.values(shipper.completeness).filter(Boolean).length;
  const mut = (fn: (sh: NonNullable<typeof shipper>) => void) => act((x) => { const sh = x.shippers.find((p) => p.personId === me.id); if (sh) fn(sh); });
  const templates = s.templates.filter((t) => t.shipperId === me.id);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">پروفایل</h1>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "profile", label: "پروفایل و تنظیمات" }, { id: "recurring", label: "تکرارشونده", count: templates.length }, { id: "favorites", label: "راننده‌های محبوب", count: shipper.favorites.length }, { id: "rules", label: "قوانین" }]} />

      {tab === "profile" && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <Card className="space-y-4 p-5">
              <h2 className="font-extrabold">پروفایل عمومی</h2>
              <p className="text-sm leading-7 text-ink-3">رانندگان پیش از انتخاب بار، نام نمایشی، تأیید کسب‌وکار و امتیاز شما را می‌بینند؛ نشانی و تلفن تا پرداخت بیعانه پنهان می‌ماند.</p>
              <Field label="نام نمایشی">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
              <Field label="نام شرکت (اختیاری)">{(id) => <Input id={id} value={co} onChange={(e) => setCo(e.target.value)} />}</Field>
              <Field label="کد اقتصادی (اختیاری)">{(id) => <Input id={id} dir="ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />}</Field>
              <Button onClick={() => { mut((sh) => { sh.displayName = name.trim() || sh.displayName; sh.company = co.trim() ? { ...sh.company, name: co.trim(), economicCode: code.trim() || undefined } : undefined; sh.completeness.name = name.trim().length > 2; sh.completeness.company = !!co.trim(); }); toast("پروفایل ذخیره شد."); }}>ذخیره</Button>
            </Card>
            <Card className="space-y-4 p-5">
              <h2 className="font-extrabold">تنظیمات</h2>
              <div className="flex items-center justify-between gap-3"><div><div className="font-bold">پرداخت خودکار بیعانه</div><div className="text-xs text-ink-3">پیش‌فرض برای سفارش‌های جدید</div></div><Toggle checked={shipper.prefs.autoPayDeposit} onChange={(v) => mut((sh) => { sh.prefs.autoPayDeposit = v; })} label="پرداخت خودکار بیعانه" /></div>
              <Field label="مقصد پیش‌فرض بازپرداخت">{(id) => <Select id={id} value={shipper.prefs.refundTo} onChange={(e) => mut((sh) => { sh.prefs.refundTo = e.target.value as "wallet" | "card"; })}><option value="wallet">کیف پول (فوری)</option><option value="card">کارت بانکی (تا ۳ روز کاری)</option></Select>}</Field>
              {([["orders", "اعلان وضعیت سفارش"], ["payments", "اعلان پرداخت"], ["marketing", "پیشنهادها و تخفیف‌ها"]] as const).map(([k, l]) => (
                <div key={k} className="flex items-center justify-between gap-3"><span className="font-medium">{l}</span><Toggle checked={!!shipper.prefs.notify[k]} onChange={(v) => mut((sh) => { sh.prefs.notify[k] = v; })} label={l} /></div>
              ))}
            </Card>
          </div>
          <div className="space-y-5">
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between"><h2 className="font-extrabold">تکمیل پروفایل</h2><span className="text-sm text-ink-3">{fa(done)} از ۵</span></div>
              <Progress value={(done / 5) * 100} />
              <ul className="space-y-1">{CHECK.map(([k, l]) => (
                <li key={k} className="flex min-h-11 items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2">{shipper.completeness[k] ? <Check className="size-4 text-ok" aria-hidden /> : <Circle className="size-4 text-ink-4" aria-hidden />}{l}</span>
                  {!shipper.completeness[k] && (k === "verify" || k === "address" || k === "logo") && <button className="h-11 text-sm font-bold text-accent-600" onClick={() => { mut((sh) => { sh.completeness[k] = true; if (k === "verify") sh.businessVerified = true; }); toast(`${l} ثبت شد (نمونه).`, "info"); }}>ثبت</button>}</li>
              ))}</ul>
            </Card>
            <Card className="space-y-3 p-5">
              <h2 className="font-extrabold">نمای رانندگان از شما</h2>
              <div className="flex items-center gap-2 font-black">{shipper.displayName}{shipper.businessVerified && <Badge tone="ok"><BadgeCheck className="size-3.5" aria-hidden />کسب‌وکار تأییدشده</Badge>}</div>
              <RatingPill r={{ avg: st.rating, count: st.ratingCount }} />
              <dl className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">محموله</dt><dd className="font-black">{fa(st.shipments)}</dd></div><div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">بارگیری به‌موقع</dt><dd className="font-black">{fa(Math.round(st.onTimeLoading * 100))}٪</dd></div></dl>
            </Card>
            <Card className="space-y-2 p-5"><h2 className="font-extrabold">دعوت دوستان</h2><p className="text-sm leading-7 text-ink-3">کد شما: <b dir="ltr" className="tabular">{shipper.referralCode}</b></p></Card>
          </div>
        </div>
      )}

      {tab === "recurring" && (templates.length === 0 ? <EmptyState icon={<Play className="size-8" />} title="سفارش تکرارشونده ندارید" body="هنگام ثبت سفارش، گزینه‌ی «تکرار روزانه / هفتگی» را انتخاب کنید." action={<Link href="/app/new/" className="font-bold text-accent-600">ثبت سفارش</Link>} /> : (
        <div className="grid gap-3 md:grid-cols-2">{templates.map((t) => (
          <Card key={t.id} className="space-y-2 p-4"><div className="flex items-center justify-between"><span className="font-black">{t.draft.origin.city} ← {t.draft.dest.city}</span><Badge tone={t.active ? "ok" : "neutral"}>{t.active ? "فعال" : "متوقف"}</Badge></div>
            <div className="text-sm text-ink-3">{t.cadence === "daily" ? "روزانه" : "هفتگی"} · اجرای بعدی {jShort(t.nextRunAt)}، {hhmm(t.nextRunAt)} · {t.draft.tempMin !== undefined && t.draft.tempMax !== undefined ? tempRange(t.draft.tempMin, t.draft.tempMax) : "غیریخچالی"}</div>
            <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => act((x) => { const tp = x.templates.find((q) => q.id === t.id); if (tp) tp.active = !tp.active; })}>{t.active ? <><Pause className="size-4" aria-hidden />توقف</> : <><Play className="size-4" aria-hidden />ادامه</>}</Button><Button size="sm" variant="danger" onClick={() => act((x) => { x.templates = x.templates.filter((q) => q.id !== t.id); })}><Trash2 className="size-4" aria-hidden />حذف</Button></div></Card>
        ))}</div>
      ))}

      {tab === "favorites" && (shipper.favorites.length === 0 ? <EmptyState icon={<Heart className="size-8" />} title="هنوز راننده‌ی محبوبی ندارید" body="در صفحه‌ی سفارش، راننده‌هایی را که دوست داشتید با قلب نشان کنید." /> : (
        <div className="grid gap-3 md:grid-cols-2">{shipper.favorites.map((id) => { const p = person(s, id); const ds = driverStats(s, id); return <Card key={id} className="flex items-center justify-between gap-3 p-4"><div><div className="font-black">{p?.name}</div><RatingPill r={{ avg: ds.rating, count: ds.ratingCount }} /></div><Link href="/app/new/" className="inline-flex h-11 items-center font-bold text-accent-600">سفارش جدید</Link></Card>; })}</div>
      ))}

      {tab === "rules" && <RulesStatus personId={me.id} audience="shipper" />}
    </div>
  );
}
