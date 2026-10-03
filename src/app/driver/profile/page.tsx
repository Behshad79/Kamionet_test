"use client";

import { CalendarClock, Check, CircleAlert, Crown, Sparkles } from "lucide-react";
import { useState } from "react";
import { TruckIllustration } from "@/components/graphics/TruckIllustration";
import { PlateView } from "@/components/graphics/PlateInput";
import { ProBadge } from "@/components/brand";
import { FileDrop, RatingPill } from "@/components/molecules";
import { CleanBadge } from "@/components/order/parts";
import { JalaliDatePicker } from "@/components/pickers";
import { RulesStatus } from "@/components/rules";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, Progress, Tabs } from "@/components/ui";
import { cv } from "@/lib/config";
import { docExpiry, STAGE_LABEL } from "@/lib/engine/drivers";
import { proAccept, proCriteria, submitWash } from "@/lib/engine/admin";
import { driverStats } from "@/lib/engine/stats";
import { fa, jShort } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { VEHICLES, ODOR_LABEL } from "@/lib/vehicles";
import { act } from "@/lib/store";

type Tab = "me" | "docs" | "clean" | "pro" | "rules";
const CRIT: Record<string, string> = { punctuality: "وقت‌شناسی", cleanliness: "نظافت و بو", coldchain: "رعایت زنجیره‌ی سرد", behavior: "رفتار", communication: "ارتباط" };

export default function Page() {
  const { s, me, driver, stage } = usePortal("driver");
  const [tab, setTab] = useState<Tab>("me");
  const [before, setBefore] = useState<string>();
  const [after, setAfter] = useState<string>();
  const [exp, setExp] = useState<{ key: "insurance" | "inspection"; at: number } | null>(null);
  if (!me || !driver) return null;
  const st = driverStats(s, me.id);
  const t = Date.now();
  const ex = docExpiry(driver, t);
  const clean = !!driver.clean.badgeUntil && driver.clean.badgeUntil > t;
  const crit = proCriteria(s, driver, { trips: st.trips, rating: st.rating, onTime: st.onTime });
  const washes = s.washes.filter((w) => w.driverId === me.id);
  const pending = washes.some((w) => w.status === "PENDING");
  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-black">{me.name}</h1><div className="mt-1 flex flex-wrap items-center gap-2"><Badge tone={stage === "suspended" ? "danger" : stage === "verified" || stage === "pro" ? "ok" : "warn"}>{STAGE_LABEL[stage!]}</Badge>{driver.pro.status === "pro" && <ProBadge />}{clean && <CleanBadge />}</div></div><RatingPill r={{ avg: st.rating, count: st.ratingCount }} /></div>
        <TruckIllustration kind={driver.vehicle.kind} color={driver.vehicle.color} state="cooling" className="h-20 w-full" label="خودروی شما" />
        {driver.vehicle.plate && <PlateView plate={driver.vehicle.plate} />}
      </Card>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "me", label: "عملکرد" }, { id: "docs", label: "خودرو و مدارک" }, { id: "clean", label: "نظافت" }, { id: "pro", label: "پرو" }, { id: "rules", label: "قوانین" }]} />

      {tab === "me" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center"><Card className="p-3"><div className="text-xs text-ink-3">سفر</div><div className="text-xl font-black">{fa(st.trips)}</div></Card><Card className="p-3"><div className="text-xs text-ink-3">وقت‌شناسی</div><div className="text-xl font-black">{fa(Math.round(st.onTime * 100))}٪</div></Card><Card className="p-3"><div className="text-xs text-ink-3">لغو</div><div className="text-xl font-black">{fa(Math.round(st.cancelRate * 100))}٪</div></Card></div>
          <Card className="space-y-3 p-4"><h2 className="font-extrabold">ریز امتیازها</h2>{Object.entries(st.breakdown).map(([k, v]) => <div key={k} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 text-ink-3">{CRIT[k] ?? k}</span><Progress value={(v / 5) * 100} /><span className="w-8 text-end font-bold tabular">{fa(Math.round(v * 10) / 10)}</span></div>)}</Card>
          {driver.strikes.length > 0 && <Card className="space-y-2 p-4"><h2 className="font-extrabold">امتیاز منفی‌ها</h2>{driver.strikes.map((x) => <div key={x.id} className="flex justify-between text-sm"><span>{x.reason}</span><span className="text-danger">{fa(x.points)}−</span></div>)}</Card>}
          {st.recent.length > 0 && <Card className="space-y-3 p-4"><h2 className="font-extrabold">نظرهای اخیر صاحبان بار</h2>{st.recent.slice(0, 4).map((r) => <div key={r.id} className="border-t border-line pt-3 first:border-0 first:pt-0"><RatingPill r={{ avg: r.overall, count: 0 }} /><p className="mt-1 text-sm text-ink-2">{r.comment || "—"}</p></div>)}</Card>}
        </div>
      )}

      {tab === "docs" && (
        <div className="space-y-4">
          <Card className="space-y-3 p-4"><h2 className="font-extrabold">انقضای مدارک</h2>
            {ex.items.map((i) => <div key={i.key} className="flex items-center justify-between gap-3"><div><div className="font-medium">{i.label}</div><div className="text-xs text-ink-3">{i.expiresAt ? `انقضا ${jShort(i.expiresAt)}` : "ثبت نشده"}</div></div><div className="flex items-center gap-2">{i.days !== undefined && <Badge tone={i.days < 0 ? "danger" : i.days <= 30 ? "warn" : "ok"}>{i.days < 0 ? "منقضی" : `${fa(i.days)} روز`}</Badge>}<Button size="sm" variant="secondary" onClick={() => setExp({ key: i.key, at: i.expiresAt ?? t + 180 * 86_400_000 })}>تمدید</Button></div></div>)}
            {ex.soon.length > 0 && <p className="flex items-center gap-2 rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn"><CircleAlert className="size-4" aria-hidden />کمتر از ۳۰ روز تا انقضای مدرک مانده؛ پس از انقضا حساب موقتاً معلق می‌شود.</p>}</Card>
          <Card className="space-y-2 p-4"><h2 className="font-extrabold">مشخصات خودرو</h2><dl className="grid grid-cols-2 gap-3 text-sm">{[["نوع", VEHICLES[driver.vehicle.kind].label], ["ظرفیت", `${fa(driver.vehicle.capacityKg)} کیلوگرم`], ["یخچال", driver.vehicle.fridgeBrand || "—"], ["کمترین دما", driver.vehicle.minTemp === null ? "بدون یخچال" : `${driver.vehicle.minTemp}°`], ["بار غیریخچالی", driver.vehicle.canRunAmbient ? "می‌توانم" : "خیر"], ["آخرین بار", ODOR_LABEL[driver.vehicle.lastCargoOdor]]].map(([k, v]) => <div key={k}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{v}</dd></div>)}</dl></Card>
        </div>
      )}

      {tab === "clean" && (
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><Sparkles className="size-5" aria-hidden />برنامه‌ی نظافت (اختیاری)</h2>
          <p className="text-sm leading-7 text-ink-3">با شست‌وشوی باکس و ثبت عکس قبل و بعد، نشان «تمیز تأییدشده» می‌گیرید و بارهای حساس به بو و صاحبان بار سخت‌گیر شما را ترجیح می‌دهند. اجباری نیست.</p>
          <div className="flex items-center justify-between rounded-ui bg-surface-2 p-3 text-sm"><span>امتیاز نظافت</span><b>{fa(driver.clean.score)} از ۱۰۰</b></div>
          {clean ? <p className="flex items-center gap-2 text-sm font-bold text-ok"><Check className="size-4" aria-hidden />نشان فعال تا {jShort(driver.clean.badgeUntil!)}</p> : <p className="text-sm text-ink-3">نشان فعالی ندارید{driver.vehicle.lastCargoOdor !== "NONE" ? ` · آخرین بار: ${ODOR_LABEL[driver.vehicle.lastCargoOdor]}؛ شست‌وشو توصیه می‌شود.` : "."}</p>}
          {pending ? <p className="rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn">درخواست شست‌وشوی شما در حال بررسی است.</p> : (
            <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><FileDrop label="قبل از شست‌وشو" capture stamp value={before} onChange={(c) => setBefore(c.dataUrl)} /><FileDrop label="بعد از شست‌وشو" capture stamp value={after} onChange={(c) => setAfter(c.dataUrl)} /></div>
              <Button block disabled={!before || !after} onClick={() => { const r = act((x) => submitWash(x, me.id, before!, after!, s.washPartners[0]?.id)); toast(r.ok ? "درخواست برای بررسی ارسال شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) { setBefore(undefined); setAfter(undefined); } }}>ارسال برای دریافت نشان</Button></div>
          )}
          <div className="space-y-1 text-xs text-ink-3"><div className="font-bold text-ink-2">مراکز شست‌وشوی همکار ({fa(cv<number>(s, "clean.washCreditPct") * 100)}٪ تخفیف):</div>{s.washPartners.map((p) => <div key={p.id}>{p.name} · {p.city}</div>)}</div>
        </Card>
      )}

      {tab === "pro" && (
        <div className="space-y-4">
          <Card className="pro-card space-y-3 p-5"><div className="flex items-center gap-2"><Crown className="size-6 text-pro-gold" aria-hidden /><h2 className="text-lg font-black">کامیونت پرو</h2></div><p className="text-sm leading-7 text-white/80">استخر اختصاصی بارها، درخواست مستقیم صاحبان بار، کارمزد ترجیحی و برداشت فوری.</p>
            {driver.pro.status === "pro" && <ProBadge label="شما پرو هستید" />}</Card>
          {driver.pro.status === "invited" && <Card className="space-y-3 border-2 border-pro-gold p-4"><h3 className="font-extrabold">شما به برنامه‌ی پرو دعوت شده‌اید</h3><p className="text-sm text-ink-3">برای فعال‌شدن، بازرسی خودرو لازم است. هم‌اکنون می‌توانید زمان بازرسی را رزرو کنید.</p><div className="grid grid-cols-2 gap-2"><Button onClick={() => { const r = act((x) => proAccept(x, me.id, true)); toast(r.ok ? "بازرسی رزرو شد." : r.error, r.ok ? "ok" : "err"); }}>رزرو بازرسی</Button><Button variant="secondary" onClick={() => { const r = act((x) => proAccept(x, me.id, false)); toast(r.ok ? "عضو پرو شدید." : r.error, r.ok ? "ok" : "err"); }}>فعال‌سازی (نمونه)</Button></div></Card>}
          {driver.pro.status === "none" && <Card className="space-y-3 p-4"><h3 className="font-extrabold">شرایط ورود</h3>{crit.rows.map((r) => <div key={r.id} className="space-y-1"><div className="flex items-center justify-between text-sm"><span>{r.label}</span><span className={r.ok ? "font-bold text-ok" : "text-ink-3"}>{r.fmt === "bool" ? (r.ok ? "برقرار" : "ناقص") : r.fmt === "pct" ? `${fa(Math.round(r.value * 100))}٪ از ${fa(Math.round(r.target * 100))}٪` : `${fa(Math.round(r.value * 10) / 10)} از ${fa(r.target)}`}</span></div>{r.fmt !== "bool" && <Progress value={Math.min(100, (r.value / r.target) * 100)} />}</div>)}<p className="text-xs text-ink-3">پس از رسیدن به همه‌ی معیارها، دعوت‌نامه برایتان ارسال می‌شود.</p></Card>}
          {driver.pro.inspection === "scheduled" && driver.pro.inspectionAt && <p className="flex items-center gap-2 rounded-ui bg-accent-50 p-3 text-sm font-medium text-accent-700"><CalendarClock className="size-4" aria-hidden />بازرسی در {jShort(driver.pro.inspectionAt)} انجام می‌شود.</p>}
        </div>
      )}

      {tab === "rules" && <RulesStatus personId={me.id} audience="driver" />}

      {exp && <div className="fixed inset-0 z-[1000] flex items-end bg-ink/40 sm:items-center sm:justify-center" onClick={() => setExp(null)}><div className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 sm:rounded-ui" onClick={(e) => e.stopPropagation()}><h2 className="font-black">تمدید {exp.key === "insurance" ? "بیمه‌ی شخص ثالث" : "معاینه‌ی فنی"}</h2><JalaliDatePicker label="تاریخ انقضای جدید" value={exp.at} onChange={(v) => setExp({ ...exp, at: v })} min={Date.now()} /><Button block onClick={() => { act((x) => { const d = x.drivers.find((q) => q.personId === me.id); if (d) { d.docs[exp.key] = { ...d.docs[exp.key], expiresAt: exp.at }; if (d.suspension?.reason.includes("منقضی")) d.suspension = undefined; } }); toast("مدرک به‌روز شد."); setExp(null); }}>ثبت</Button></div></div>}
    </div>
  );
}
