"use client";

import { CalendarCheck, CalendarClock, Camera, Check, ChevronLeft, CircleAlert, Crown, FileCheck2, Flame, Gift, Lock, MapPin, ShieldCheck, Sparkles, Star, Trophy, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { PlateView } from "@/components/graphics/PlateInput";
import { TruckIllustration } from "@/components/graphics/TruckIllustration";
import { ProBadge } from "@/components/brand";
import { FileDrop, RatingPill } from "@/components/molecules";
import { CleanBadge } from "@/components/order/parts";
import { JalaliDatePicker } from "@/components/pickers";
import { ProfileHero, ReviewItem } from "@/components/profile";
import { RulesStatus } from "@/components/rules";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, Progress, Sheet, Tabs, cx } from "@/components/ui";
import { cv } from "@/lib/config";
import { docExpiry, STAGE_LABEL } from "@/lib/engine/drivers";
import { proCriteria, submitWash } from "@/lib/engine/admin";
import { renewDoc } from "@/lib/engine/kyc";
import { bookInspection, cancelInspection, INSPECT_CENTERS, INSPECT_CHECKS, inspectionSlots, LEVELS, PASS_SCORE, proJourney, SLOT_CAPACITY } from "@/lib/engine/pro";
import { driverStats } from "@/lib/engine/stats";
import { fail, ok, person } from "@/lib/engine/core";
import { DocMessages } from "@/components/driver/DocMessages";
import { SensorCard, VehicleInfoFields, VehicleSpecs, type VehicleInfo } from "@/components/driver/vehicleUi";
import { fa, jDateTime, jShort } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";
import { ODOR_LABEL, VEHICLES } from "@/lib/vehicles";

type Tab = "me" | "docs" | "clean" | "pro" | "rules";
const CRIT: Record<string, string> = { punctuality: "وقت‌شناسی", cleanliness: "نظافت و بو", coldchain: "رعایت زنجیره‌ی سرد", behavior: "رفتار", communication: "ارتباط" };
const DOCS = { insurance: "بیمه‌ی شخص ثالث", inspection: "معاینه‌ی فنی" } as const;
const DAY = 86_400_000;

export default function Page() {
  const { s, me, driver, stage } = usePortal("driver");
  const [tab, setTab] = useState<Tab>("me");
  if (!me || !driver) return null;
  const st = driverStats(s, me.id);
  const t = Date.now();
  const clean = !!driver.clean.badgeUntil && driver.clean.badgeUntil > t;
  const pro = driver.pro.status === "pro";
  const hue = (me.id.split("").reduce((n, c) => n + c.charCodeAt(0), 0) * 37) % 360;
  return (
    <div className="space-y-5">
      <ProfileHero name={me.name} hue={hue} pro={pro} verified={stage !== "not_started" && stage !== "in_review" && stage !== "rejected"} rating={st.rating} ratingCount={st.ratingCount}
        headline={`${VEHICLES[driver.vehicle.kind].label} · ${driver.vehicle.plate ? "" : "پلاک ثبت نشده"}`.replace(/ · $/, "")}
        badges={<><Badge tone={stage === "suspended" ? "danger" : stage === "verified" || pro ? "ok" : "warn"}>{STAGE_LABEL[stage!]}</Badge>{pro && <ProBadge />}{clean && <CleanBadge />}</>}
        stats={[{ label: "سفر", value: fa(st.trips) }, { label: "وقت‌شناسی", value: `${fa(Math.round(st.onTime * 100))}٪` }, { label: "نظافت", value: fa(driver.clean.score) }]} />
      <Card className="flex items-center gap-4 p-4"><TruckIllustration kind={driver.vehicle.kind} color={driver.vehicle.color} state="cooling" className="h-20 w-32 shrink-0" label="خودروی شما" />{driver.vehicle.plate && <PlateView plate={driver.vehicle.plate} />}</Card>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "me", label: "عملکرد" }, { id: "docs", label: "مدارک و خودرو" }, { id: "clean", label: "نظافت" }, ...(cv<boolean>(s, "feature.pro") ? [{ id: "pro" as const, label: "مسیر پرو" }] : []), { id: "rules", label: "قوانین" }]} />

      {tab === "me" && (
        <div className="space-y-4">
          <Card className="space-y-3 p-5"><h2 className="font-extrabold">ریز امتیازها</h2>{Object.entries(st.breakdown).map(([k, v]) => <div key={k} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 text-ink-3">{CRIT[k] ?? k}</span><Progress value={(v / 5) * 100} /><span className="w-8 text-end font-bold tabular">{fa(Math.round(v * 10) / 10)}</span></div>)}</Card>
          {driver.strikes.length > 0 && <Card className="space-y-2 p-5"><h2 className="font-extrabold">امتیاز منفی‌ها</h2>{driver.strikes.map((x) => <div key={x.id} className="flex justify-between text-sm"><span>{x.reason}</span><span className="text-danger">{fa(x.points)}−</span></div>)}</Card>}
          <Card className="space-y-4 p-5"><h2 className="font-extrabold">نظر صاحبان بار</h2>{st.recent.length === 0 ? <p className="text-sm text-ink-3">هنوز نظری ثبت نشده است.</p> : st.recent.slice(0, 5).map((r) => <ReviewItem key={r.id} name={person(s, r.fromId)?.name ?? "صاحب بار"} rating={r.overall} text={r.comment} at={jShort(r.at)} hue={(r.fromId.length * 53) % 360} />)}</Card>
        </div>
      )}

      {tab === "docs" && <Docs />}

      {tab === "clean" && <Clean clean={clean} />}

      {tab === "pro" && <ProJourney />}

      {tab === "rules" && <RulesStatus personId={me.id} audience="driver" />}
      <span className="sr-only"><MapPin /><Camera /><Gift /><Star /><Lock /><Wrench /><FileCheck2 /></span>
    </div>
  );
}

/* ───────────────────────── documents ───────────────────────── */

function Docs() {
  const { s, me, driver } = usePortal("driver");
  const [renew, setRenew] = useState<keyof typeof DOCS | null>(null);
  const [vEdit, setVEdit] = useState(false);
  const [vInfo, setVInfo] = useState<VehicleInfo>({});
  const [img, setImg] = useState<string>();
  const [at, setAt] = useState(Date.now() + 365 * DAY);
  if (!me || !driver) return null;
  const ex = docExpiry(driver, Date.now());
  return (
    <div className="space-y-4">
      <DocMessages d={driver} />
      <Card className="space-y-4 p-5">
        <h2 className="font-extrabold">مدارک و انقضا</h2>
        {ex.items.map((i) => {
          const f = driver.docs[i.key];
          return (
            <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              {f?.dataUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.dataUrl} alt={i.label} className="size-16 shrink-0 rounded-xl object-cover" /> : <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-white text-ink-4"><Camera className="size-6" aria-hidden /></span>}
              <div className="min-w-0 flex-1"><div className="font-bold">{i.label}</div><div className="text-xs text-ink-3">{i.expiresAt ? `انقضا ${jShort(i.expiresAt)}` : "ثبت نشده"}{f && f.reviewed === false ? " · در انتظار بازبینی" : ""}</div></div>
              <div className="flex flex-col items-end gap-1.5">{i.days !== undefined && <Badge tone={i.days < 0 ? "danger" : i.days <= 30 ? "warn" : "ok"}>{i.days < 0 ? "منقضی" : `${fa(i.days)} روز`}</Badge>}<Button size="sm" variant="secondary" onClick={() => { setRenew(i.key); setImg(undefined); setAt(Date.now() + 365 * DAY); }}>تمدید با عکس مدرک</Button></div>
            </div>
          );
        })}
        {ex.soon.length > 0 && <p className="flex items-center gap-2 rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn"><CircleAlert className="size-4" aria-hidden />کمتر از ۳۰ روز تا انقضای مدرک مانده؛ پس از انقضا حساب موقتاً معلق می‌شود.</p>}
      </Card>
      <Card className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-extrabold">مشخصات خودرو</h2><Button size="sm" variant="secondary" onClick={() => { setVInfo({ make: driver.vehicle.make, modelName: driver.vehicle.modelName, year: driver.vehicle.year, bodyLengthM: driver.vehicle.bodyLengthM, fridgeModel: driver.vehicle.fridgeModel, fridgeYear: driver.vehicle.fridgeYear, thermo: driver.vehicle.thermo }); setVEdit(true); }}>ویرایش</Button></div><VehicleSpecs v={driver.vehicle} /><div className="text-sm text-ink-3">آخرین بار: {ODOR_LABEL[driver.vehicle.lastCargoOdor]}</div></Card>
      {driver.vehicle.minTemp !== null && cv<boolean>(s, "feature.sensor") && <SensorCard pid={me.id} thermo={driver.vehicle.thermo} />}
      <Sheet open={vEdit} onClose={() => setVEdit(false)} title="ویرایش مشخصات خودرو" footer={<Button block onClick={() => { const r = act((x) => { const d = x.drivers.find((y) => y.personId === me.id)!; if (!vInfo.modelName?.trim() || !vInfo.year || !vInfo.make?.trim()) return fail("سازنده، مدل و سال ساخت را وارد کنید."); d.vehicle = { ...d.vehicle, ...vInfo, make: vInfo.make?.trim(), thermo: vInfo.thermo ? { ...vInfo.thermo, connected: vInfo.thermo.kind === "none" ? false : d.vehicle.thermo?.connected ?? false } : d.vehicle.thermo }; return ok(); }); toast(r.ok ? "مشخصات ذخیره شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setVEdit(false); }}>ذخیره</Button>}><VehicleInfoFields kind={driver.vehicle.kind} fridge={driver.vehicle.minTemp !== null} value={vInfo} onChange={setVInfo} /></Sheet>
      <Sheet open={!!renew} onClose={() => setRenew(null)} title={renew ? `تمدید ${DOCS[renew]}` : ""} footer={<Button block disabled={!img} onClick={() => { const r = act((x) => renewDoc(x, me.id, renew!, img!, at)); toast(r.ok ? "مدرک ثبت شد و برای بازبینی ارسال شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setRenew(null); }}>{img ? "ثبت مدرک" : "ابتدا عکس مدرک را بگیرید"}</Button>}>
        <div className="space-y-4"><p className="text-sm leading-7 text-ink-3">برای تمدید، علاوه بر تاریخ، باید عکس خوانای مدرک جدید (برگه‌ی بیمه‌نامه یا برگ معاینه) را بارگذاری کنید. تیم احراز هویت آن را بازبینی می‌کند.</p>
          <FileDrop label="عکس مدرک جدید" capture value={img} onChange={(c) => setImg(c.dataUrl)} /><JalaliDatePicker label="تاریخ انقضای مدرک جدید" value={at} onChange={setAt} min={Date.now() + DAY} /></div>
      </Sheet>
    </div>
  );
}

/* ───────────────────────── cleanliness ───────────────────────── */

function Clean({ clean }: { clean: boolean }) {
  const { s, me, driver } = usePortal("driver");
  const [before, setBefore] = useState<string>();
  const [after, setAfter] = useState<string>();
  if (!me || !driver) return null;
  const pending = s.washes.some((w) => w.driverId === me.id && w.status === "PENDING");
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-extrabold"><Sparkles className="size-5" aria-hidden />برنامه‌ی نظافت (اختیاری)</h2>
      <p className="text-sm leading-7 text-ink-3">با شست‌وشوی باکس و ثبت عکس قبل و بعد، نشان «تمیز تأییدشده» می‌گیرید و برای بارهای حساس به بو ترجیح داده می‌شوید. اجباری نیست.</p>
      <div className="flex items-center justify-between rounded-ui bg-surface-2 p-3 text-sm"><span>امتیاز نظافت</span><b>{fa(driver.clean.score)} از ۱۰۰</b></div>
      {clean ? <p className="flex items-center gap-2 text-sm font-bold text-ok"><Check className="size-4" aria-hidden />نشان فعال تا {jShort(driver.clean.badgeUntil!)}</p> : <p className="text-sm text-ink-3">نشان فعالی ندارید{driver.vehicle.lastCargoOdor !== "NONE" ? ` · آخرین بار: ${ODOR_LABEL[driver.vehicle.lastCargoOdor]}؛ شست‌وشو توصیه می‌شود.` : "."}</p>}
      {pending ? <p className="rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn">درخواست شست‌وشوی شما در حال بررسی است.</p> : (
        <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><FileDrop label="قبل از شست‌وشو" capture stamp value={before} onChange={(c) => setBefore(c.dataUrl)} /><FileDrop label="بعد از شست‌وشو" capture stamp value={after} onChange={(c) => setAfter(c.dataUrl)} /></div>
          <Button block disabled={!before || !after} onClick={() => { const r = act((x) => submitWash(x, me.id, before!, after!, s.washPartners[0]?.id)); toast(r.ok ? "درخواست برای بررسی ارسال شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) { setBefore(undefined); setAfter(undefined); } }}>ارسال برای دریافت نشان</Button></div>
      )}
      <div className="space-y-1 text-xs text-ink-3"><div className="font-bold text-ink-2">مراکز شست‌وشوی همکار ({fa(cv<number>(s, "clean.washCreditPct") * 100)}٪ تخفیف):</div>{s.washPartners.map((p) => <div key={p.id}>{p.name} · {p.city}</div>)}</div>
    </Card>
  );
}

/* ───────────────────────── road to Pro ───────────────────────── */

const BENEFITS = [
  { i: Crown, t: "تاج روی پروفایل", d: "پروفایل شما با قاب و تاج طلایی در چشم همه‌ی صاحبان بار متمایز می‌شود." },
  { i: Gift, t: "بارهای ویژه‌ی پرو", d: "بازاری که فقط رانندگان پرو می‌بینند؛ رقابت کمتر و کرایه‌ی بالاتر." },
  { i: Trophy, t: "درخواست مستقیم", d: "صاحبان بار حساس، شما را مستقیم انتخاب می‌کنند." },
  { i: Flame, t: "کارمزد کمتر و برداشت فوری", d: "کارمزد ترجیحی و واریز همان روز." },
];

function ProJourney() {
  const { s, me, driver } = usePortal("driver");
  const [slot, setSlot] = useState<{ at: number; center: string } | null>(null);
  const [center, setCenter] = useState(INSPECT_CENTERS[0]);
  const d = driver!;
  const st = driverStats(s, me!.id);
  const j = useMemo(() => proJourney(s, d), [s, d]);
  const crit = proCriteria(s, d, { trips: st.trips, rating: st.rating, onTime: st.onTime });
  const slots = inspectionSlots(s, Date.now(), me!.id).filter((x) => x.center === center);
  const byDay = useMemo(() => { const m = new Map<number, typeof slots>(); slots.forEach((x) => { const k = new Date(x.at).setHours(0, 0, 0, 0); m.set(k, [...(m.get(k) ?? []), x]); }); return [...m.entries()]; }, [slots]);
  const ok = crit.rows.filter((r) => r.ok).length;

  if (d.pro.status === "pro") return (
    <div className="space-y-4">
      <Card className="pro-card space-y-3 p-6 text-center"><Crown className="mx-auto size-10 text-pro-gold" aria-hidden /><h2 className="text-2xl font-black pro-gold-text">شما راننده‌ی پرو هستید</h2><p className="text-sm leading-7 text-white/80">{d.pro.grantedBy ? `تیم کامیونت شما را مستقیماً پرو کرد (${d.pro.grantedBy}).` : "بازرسی را گذراندید."} برای حفظ جایگاه، امتیاز بالای ۴٫۶ و صفر لغو را نگه دارید.</p></Card>
      <Card className="grid gap-3 p-5 sm:grid-cols-2">{BENEFITS.map((b) => <div key={b.t} className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><b.i className="size-5" aria-hidden /></span><div><div className="font-bold">{b.t}</div><div className="text-xs leading-6 text-ink-3">{b.d}</div></div></div>)}</Card>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card className="pro-card space-y-4 p-6">
        <div className="flex items-center gap-3"><Crown className="size-9 text-pro-gold" aria-hidden /><div><h2 className="text-xl font-black pro-gold-text">راه رسیدن به «کامیونت پرو»</h2><p className="text-sm text-white/75">سه قدم تا تاج طلایی: معیارها، دعوت‌نامه، بازرسی.</p></div></div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {[["۱", "معیارها را کامل کنید", `${fa(ok)} از ${fa(crit.rows.length)} انجام شد`], ["۲", "دعوت‌نامه می‌گیرید", d.pro.status === "invited" ? "دریافت شد" : "خودکار پس از تکمیل معیارها"], ["۳", "بازرسی را بگذرانید", d.pro.inspection === "scheduled" ? "رزرو شد" : "یک زمان انتخاب کنید"]].map(([n, t, sub], i) => (
            <li key={n} className={cx("rounded-2xl p-3 ring-1", (i === 0 && ok === crit.rows.length) || (i === 1 && d.pro.status === "invited") || (i === 2 && d.pro.inspection === "scheduled") ? "bg-white/15 ring-pro-gold/60" : "bg-white/5 ring-white/10")}><div className="text-xs font-black text-pro-gold">{n}</div><div className="font-bold">{t}</div><div className="text-xs text-white/65">{sub}</div></li>
          ))}
        </ol>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">{BENEFITS.map((b) => <div key={b.t} className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><b.i className="size-5" aria-hidden /></span><div><div className="font-extrabold">{b.t}</div><div className="text-sm leading-7 text-ink-3">{b.d}</div></div></div>)}</Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between"><h3 className="font-extrabold">سطح و امتیاز شما</h3><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-black text-brand-700">{fa(j.xp)} امتیاز</span></div>
        <div className="flex items-center gap-3"><span className="grid size-14 place-items-center rounded-2xl bg-ink text-lg font-black text-pro-gold">{fa(j.level.id + 1)}</span><div className="min-w-0 flex-1"><div className="font-black">{j.level.name}</div><div className="text-xs text-ink-3">{j.level.perk}</div><div className="mt-2"><Progress value={j.pct} /></div>{j.next && <div className="mt-1 text-xs text-ink-3">{fa(j.next.xp - j.xp)} امتیاز تا «{j.next.name}»</div>}</div></div>
        <ol className="flex items-center justify-between gap-1 pt-1">{[...LEVELS, { id: 4, name: "پرو", xp: 99999, perk: "" }].map((l) => <li key={l.id} className="flex flex-1 flex-col items-center gap-1 text-center"><span className={cx("grid size-9 place-items-center rounded-full text-xs font-black", l.id <= j.level.id ? "bg-brand-500 text-ink" : l.id === 4 ? "bg-ink text-pro-gold" : "bg-surface-3 text-ink-4")}>{l.id === 4 ? <Crown className="size-4" aria-hidden /> : fa(l.id + 1)}</span><span className="text-[10px] font-bold text-ink-3">{l.name}</span></li>)}</ol>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-extrabold">معیارهای ورود به پرو</h3>
        {crit.rows.map((r) => (
          <div key={r.id} className="space-y-1.5"><div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium">{r.ok ? <Check className="size-4 text-ok" aria-hidden /> : <span className="size-4 rounded-full border-2 border-line" aria-hidden />}{r.label}</span><span className={r.ok ? "font-bold text-ok" : "text-ink-3"}>{r.fmt === "bool" ? (r.ok ? "برقرار" : "ناقص") : r.fmt === "pct" ? `${fa(Math.round(r.value * 100))}٪ از ${fa(Math.round(r.target * 100))}٪` : `${fa(Math.round(r.value * 10) / 10)} از ${fa(r.target)}`}</span></div>{r.fmt !== "bool" && <Progress value={Math.min(100, (r.value / r.target) * 100)} />}</div>
        ))}
        <p className="rounded-ui bg-surface-2 p-3 text-xs leading-6 text-ink-3">به‌محض تکمیل همه‌ی معیارها، دعوت‌نامه برایتان فعال می‌شود. راننده‌های بسیار برجسته را تیم کامیونت می‌تواند مستقیم و بدون انتظار پرو کند.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-extrabold"><Trophy className="size-5 text-brand-700" aria-hidden />ماموریت‌های این ماه</h3>
        {j.missions.map((m) => <div key={m.id} className="space-y-1.5"><div className="flex items-center justify-between gap-2 text-sm"><span className="font-bold">{m.title}</span><span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-black text-brand-700">+{fa(m.xp)}</span></div><Progress value={Math.min(100, (m.value / m.target) * 100)} /><div className="text-xs text-ink-3">{m.hint}</div></div>)}
        <div className="flex items-center gap-2 text-sm"><Flame className="size-4 text-warn" aria-hidden />روزهای فعال در ۳۰ روز اخیر: <b>{fa(j.streakDays)}</b></div>
      </Card>

      <Card className="space-y-3 p-5"><h3 className="font-extrabold">نشان‌ها</h3><ul className="grid grid-cols-4 gap-2">{j.badges.map((b) => <li key={b.id} className={cx("flex flex-col items-center gap-1 rounded-2xl p-2 text-center", b.got ? "bg-brand-50" : "bg-surface-2 opacity-55")} title={b.hint}><span className={cx("grid size-11 place-items-center rounded-full", b.got ? "bg-brand-500 text-ink" : "bg-surface-3 text-ink-4")}>{b.got ? <Star className="size-5 fill-current" aria-hidden /> : <Lock className="size-4" aria-hidden />}</span><span className="text-[11px] font-bold leading-4">{b.title}</span></li>)}</ul></Card>

      {d.pro.status === "invited" ? (
        <Card className="space-y-4 border-2 border-pro-gold p-5">
          <div className="flex items-center gap-2"><CalendarCheck className="size-5 text-brand-700" aria-hidden /><h3 className="font-extrabold">زمان بازرسی خود را انتخاب کنید</h3></div>
          {d.pro.inspection === "scheduled" && d.pro.inspectionAt ? (
            <div className="space-y-3 rounded-2xl bg-ok-bg p-4"><div className="flex items-center gap-2 font-black text-ok"><CalendarClock className="size-5" aria-hidden />بازرسی رزرو شده</div><p className="text-sm font-bold">{jDateTime(d.pro.inspectionAt)}</p><p className="text-sm text-ink-3">{d.pro.inspectionCenter}</p><p className="text-xs leading-6 text-ink-3">اصل کارت خودرو، بیمه‌نامه و معاینه‌ی فنی را همراه بیاورید و یخچال را روشن و پیش‌سرد کنید.</p><Button variant="secondary" size="sm" onClick={() => act((x) => cancelInspection(x, me!.id))}>لغو رزرو</Button></div>
          ) : (
            <>
              {d.pro.inspection === "failed" && <p className="rounded-ui bg-warn-bg p-3 text-sm text-warn">{d.pro.inspectionNote || "بازرسی قبلی به حد نصاب نرسید."} می‌توانید دوباره رزرو کنید.</p>}
              <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="مرکز بازرسی">{INSPECT_CENTERS.map((c) => <button key={c} role="tab" aria-selected={center === c} onClick={() => { setCenter(c); setSlot(null); }} className={cx("h-11 shrink-0 rounded-full px-4 text-sm font-bold", center === c ? "bg-ink text-white" : "bg-white shadow-soft")}>{c.split("·")[0].replace("مرکز بازرسی", "").trim()}</button>)}</div>
              <p className="flex items-center gap-1.5 text-xs text-ink-3"><MapPin className="size-4" aria-hidden />{center}</p>
              <div className="space-y-3">{byDay.map(([day, list]) => <div key={day}><div className="mb-1.5 text-sm font-bold">{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(day)}</div><div className="flex flex-wrap gap-2">{list.map((x) => { const full = x.booked >= SLOT_CAPACITY; const on = slot?.at === x.at; return <button key={x.at} disabled={full} onClick={() => setSlot({ at: x.at, center: x.center })} aria-pressed={on} className={cx("h-11 rounded-xl px-4 text-sm font-bold tabular transition", on ? "bg-brand-500 text-ink shadow-soft" : full ? "bg-surface-3 text-ink-4 line-through" : "bg-white shadow-soft hover:bg-brand-50")}>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(x.at)}{!full && <span className="ms-1 text-[10px] font-medium text-ink-3">({fa(SLOT_CAPACITY - x.booked)} ظرفیت)</span>}</button>; })}</div></div>)}</div>
              <Button block disabled={!slot} onClick={() => { const r = act((x) => bookInspection(x, me!.id, slot!.at, slot!.center)); toast(r.ok ? "بازرسی رزرو شد." : r.error, r.ok ? "ok" : "err"); }}>{slot ? "تأیید زمان بازرسی" : "یک زمان انتخاب کنید"}</Button>
            </>
          )}
          <details className="rounded-2xl bg-surface-2 p-4"><summary className="cursor-pointer font-bold">بازرسی چطور نمره می‌گیرد؟</summary>
            <div className="mt-3 space-y-3"><p className="text-sm leading-7 text-ink-3">بازرس هر بخش را نمره می‌دهد. نمره‌ی کل باید حداقل {fa(PASS_SCORE)} باشد و بخش‌های ضروری (علامت‌دار) نباید مردود شوند. در صورت قبولی، همان لحظه پرو می‌شوید.</p>
              {INSPECT_CHECKS.map((c) => <div key={c.id} className="flex items-start justify-between gap-3 text-sm"><div><div className="font-bold">{c.label}{c.critical && <span className="ms-1.5 rounded-full bg-danger-bg px-2 py-0.5 text-[10px] text-danger">ضروری</span>}</div><div className="text-xs text-ink-3">{c.how}</div></div><span className="shrink-0 font-black text-brand-700">{fa(c.weight)}٪</span></div>)}</div></details>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 p-5"><ShieldCheck className="size-8 text-ink-4" aria-hidden /><p className="text-sm leading-7 text-ink-3">پس از تکمیل معیارها، رزرو بازرسی همین‌جا فعال می‌شود و اعلان می‌گیرید.</p></Card>
      )}
      <span className="sr-only"><ChevronLeft /><RatingPill /></span>
    </div>
  );
}
