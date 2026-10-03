"use client";

import { BadgeCheck, Check, Crown, Eye, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PlateView } from "../../graphics/PlateInput";
import { ProBadge } from "../../brand";
import { Avatar } from "../../profile";
import { StatusBadge } from "../../molecules";
import { Badge, Button, Card, Field, Input, Sheet, Tabs, Textarea, Toggle } from "../../ui";
import { toast } from "../../Toaster";
import { DataTable, type Col } from "../DataTable";
import { Denied, KV, PageHead, Panel, Pill, useAdmin } from "../kit";
import { addNote, adjustWallet, banDriver, decideAppeal, guard, KYC_REASONS, proCriteria, proInvite, reinstateDriver, reviewDriverDoc, reviewKyc, reviewShipperDoc, setDriverControls, setShipperControls, suspendDriver, ROLE_LABELS } from "@/lib/engine/admin";
import { docExpiry, driverStage, STAGE_LABEL, openDebt } from "@/lib/engine/drivers";
import { grantProManually, INSPECT_CHECKS, PASS_SCORE, proAutoScan, recordInspection } from "@/lib/engine/pro";
import { driverStats, shipperStats } from "@/lib/engine/stats";
import { person } from "@/lib/engine/core";
import { fa, jDateTime, jShort, toman } from "@/lib/format";
import { driverWallet, shipperWallet } from "@/lib/ledger";
import { R } from "@/lib/money";
import { act, startViewAs, useStore } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";
import type { DriverProfile, ShipperProfile, State } from "@/lib/types";

const pn = (s: State, id: string) => person(s, id)?.name ?? "—";

/* ───────────────────────── Driver 360 ───────────────────────── */

export function Driver360({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useStore();
  const { admin, has, run } = useAdmin();
  const [tab, setTab] = useState<"ov" | "docs" | "trips" | "fin" | "act">("ov");
  const [reason, setReason] = useState("");
  const [adj, setAdj] = useState<number | undefined>();
  const [note, setNote] = useState("");
  const d = id ? s.drivers.find((x) => x.personId === id) : undefined;
  if (!d) return null;
  const p = person(s, d.personId)!;
  const st = driverStats(s, d.personId);
  const stage = driverStage(s, d);
  const w = driverWallet(s, d.personId);
  const trips = s.orders.filter((o) => o.driverId === d.personId).slice(0, 25);
  const ex = docExpiry(d, Date.now());
  const pro = d.pro.status === "pro";
  const crit = proCriteria(s, d, { trips: st.trips, rating: st.rating, onTime: st.onTime });
  return (
    <Sheet open onClose={onClose} title="پرونده‌ی ۳۶۰ درجه‌ی راننده" wide>
      <div className="space-y-4">
        <div className="flex items-center gap-4"><Avatar name={p.name} pro={pro} size={64} hue={(d.personId.length * 61) % 360} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-lg font-black">{p.name}{pro && <ProBadge />}</div><div className="text-sm text-ink-3" dir="ltr">{p.phone}</div><div className="mt-1 flex flex-wrap gap-1.5"><Pill tone={stage === "suspended" ? "danger" : stage === "verified" || stage === "pro" ? "ok" : "warn"}>{STAGE_LABEL[stage]}</Pill>{d.controls.walletFrozen && <Pill tone="danger">کیف پول مسدود</Pill>}{d.controls.payoutHold && <Pill tone="warn">برداشت متوقف</Pill>}</div></div></div>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "ov", label: "نمای کلی" }, { id: "docs", label: "مدارک" }, { id: "trips", label: "سفرها", count: trips.length }, { id: "fin", label: "مالی" }, { id: "act", label: "اقدام" }]} />
        {tab === "ov" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Card className="p-3 text-center"><div className="text-xs text-ink-3">سفر</div><div className="text-xl font-black">{fa(st.trips)}</div></Card><Card className="p-3 text-center"><div className="text-xs text-ink-3">امتیاز</div><div className="text-xl font-black">{fa(Math.round(st.rating * 10) / 10)}</div></Card><Card className="p-3 text-center"><div className="text-xs text-ink-3">وقت‌شناسی</div><div className="text-xl font-black">{fa(Math.round(st.onTime * 100))}٪</div></Card><Card className="p-3 text-center"><div className="text-xs text-ink-3">لغو</div><div className="text-xl font-black">{fa(Math.round(st.cancelRate * 100))}٪</div></Card></div>
            <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="خودرو" v={`${VEHICLES[d.vehicle.kind].label} · ${fa(d.vehicle.capacityKg)} کیلوگرم`} /><KV k="پلاک" v={d.vehicle.plate ? <PlateView plate={d.vehicle.plate} className="h-8!" /> : "—"} /><KV k="یخچال" v={`${d.vehicle.fridgeBrand} · تا ${d.vehicle.minTemp ?? "—"}°`} /><KV k="امتیاز نظافت" v={fa(d.clean.score)} /><KV k="امتیاز منفی" v={fa(d.strikes.reduce((n, x) => n + x.points, 0))} /><KV k="عضویت" v={jShort(d.createdAt)} /><KV k="کد ملی" v={p.nationalId} /></dl>
            {d.suspension && <div className="rounded-2xl bg-danger-bg p-4 text-sm text-danger"><b>تعلیق:</b> {d.suspension.reason} · {jShort(d.suspension.since)}{d.suspension.appeal === "open" && <div className="mt-2">درخواست تجدیدنظر: «{d.suspension.appealText}»<div className="mt-2 flex gap-2"><Button size="sm" onClick={() => run((x, a) => decideAppeal(x, a, d.personId, true, "پذیرفته شد"), "درخواست پذیرفته شد.")}>پذیرش و رفع تعلیق</Button><Button size="sm" variant="secondary" onClick={() => run((x, a) => decideAppeal(x, a, d.personId, false, "رد شد"), "درخواست رد شد.")}>رد</Button></div></div>}</div>}
            {d.notes.length > 0 && <Panel title="یادداشت‌ها"><ul className="space-y-2 text-sm">{d.notes.map((n) => <li key={n.id} className="rounded-xl bg-surface-2 p-3">{n.text}<div className="mt-1 text-xs text-ink-3">{n.by} · {jDateTime(n.at)}</div></li>)}</ul></Panel>}
          </div>
        )}
        {tab === "docs" && (
          <div className="grid gap-3 sm:grid-cols-2">{(["selfie", "license", "regFront", "insurance", "inspection"] as const).map((k) => { const f = d.docs[k]; const label = { selfie: "عکس چهره", license: "گواهینامه", regFront: "کارت خودرو", insurance: "بیمه‌نامه", inspection: "معاینه‌ی فنی" }[k]; const e = ex.items.find((i) => i.key === k); return (
            <Card key={k} className="space-y-2 p-3"><div className="flex items-center justify-between text-sm font-bold">{label}{f ? <Pill tone={f.reviewed ? "ok" : "warn"}>{f.reviewed ? "بازبینی‌شده" : "در انتظار"}</Pill> : <Pill>ندارد</Pill>}</div>{f?.dataUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.dataUrl} alt={label} className="h-32 w-full rounded-xl bg-surface-2 object-contain" /> : <div className="grid h-32 place-items-center rounded-xl bg-surface-2 text-xs text-ink-3">بدون تصویر</div>}{e?.expiresAt && <div className="text-xs text-ink-3">انقضا: {jShort(e.expiresAt)}{e.days !== undefined && e.days < 30 ? ` (${e.days < 0 ? "منقضی" : fa(e.days) + " روز"})` : ""}</div>}{f && !f.reviewed && <div className="flex gap-2"><Button size="sm" onClick={() => run((x, a) => reviewDriverDoc(x, a, d.personId, k, true), "تأیید شد.")}>تأیید</Button><Button size="sm" variant="danger" onClick={() => run((x, a) => reviewDriverDoc(x, a, d.personId, k, false), "رد شد.")}>رد</Button></div>}</Card>); })}</div>
        )}
        {tab === "trips" && <ul className="space-y-1.5">{trips.map((o) => <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2.5 text-sm"><span className="font-bold">{o.origin.city} ← {o.dest.city}</span><span className="flex items-center gap-2 text-ink-3">{jShort(o.pickupAt)}<StatusBadge status={o.status} /></span></li>)}</ul>}
        {tab === "fin" && (
          <div className="space-y-4">
            <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="قابل برداشت" v={toman(w.available)} /><KV k="در انتظار آزادسازی" v={toman(w.pending)} /><KV k="در جریان برداشت" v={toman(w.held)} /><KV k="بدهی کارمزد" v={toman(openDebt(s, d.personId))} /><KV k="شبا" v={d.iban ? `${d.iban.sheba} · ${d.iban.holderMatches ? "نام مطابق" : "نام نامطابق"}` : "ثبت نشده"} /></dl>
            <Panel title="تعدیل دستی کیف پول (نیازمند دلیل؛ بالاتر از سقف نقش ← تأیید دو نفره)"><div className="flex flex-wrap gap-2"><Input aria-label="مبلغ تعدیل (تومان، منفی برای کسر)" className="w-44" dir="ltr" inputMode="numeric" value={adj ?? ""} onChange={(e) => setAdj(Number(e.target.value.replace(/[^\d-]/g, "")) || undefined)} placeholder="مبلغ تومان (±)" /><Input aria-label="دلیل" className="min-w-48 flex-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل" /><Button disabled={!adj || !reason.trim()} onClick={() => { const r = run((x, a) => adjustWallet(x, a, d.personId, "driver", R(adj!), reason), undefined); if (r.ok) toast(r.pending ? "برای تأیید دو نفره ارسال شد." : "تعدیل انجام شد."); }}>اعمال</Button></div></Panel>
          </div>
        )}
        {tab === "act" && (
          <div className="space-y-4">
            <Panel title="تعلیق / مسدودی">
              <div className="space-y-2"><Textarea aria-label="دلیل" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل (الزامی؛ برای راننده نمایش داده می‌شود)" />
                <div className="flex flex-wrap gap-2"><Button variant="danger" size="sm" disabled={reason.trim().length < 4} onClick={() => run((x, a) => suspendDriver(x, a, d.personId, reason), "تعلیق شد.")}>تعلیق</Button><Button variant="secondary" size="sm" onClick={() => run((x, a) => reinstateDriver(x, a, d.personId, reason), "رفع تعلیق شد.")}>رفع تعلیق</Button><Button variant="danger" size="sm" disabled={reason.trim().length < 4} onClick={() => { const r = run((x, a) => banDriver(x, a, d.personId, reason)); if (r.ok) toast("مسدودی دائمی نیازمند تأیید دو نفره است و ارسال شد."); }}>مسدودی دائمی (دو نفره)</Button></div></div>
            </Panel>
            <Panel title="کنترل‌های مالی">
              {([["walletFrozen", "مسدودی کیف پول"], ["payoutHold", "توقف برداشت"], ["cashToDriver", "مجاز به دریافت نقدی"], ["instantPayout", "برداشت فوری"]] as const).map(([k, l]) => <div key={k} className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm font-medium">{l}</span><Toggle checked={!!d.controls[k]} onChange={(v) => run((x, a) => setDriverControls(x, a, d.personId, { [k]: v }), "ذخیره شد.")} label={l} /></div>)}
            </Panel>
            <Panel title="کامیونت پرو">
              <div className="space-y-2 text-sm"><div>وضعیت: <b>{{ none: "عادی", invited: "دعوت‌شده", pro: "پرو", revoked: "لغوشده" }[d.pro.status]}</b>{d.pro.grantedBy && ` · پرو دستی توسط ${d.pro.grantedBy}`}</div><div className="text-ink-3">معیارها: {crit.rows.filter((r) => r.ok).length} از {crit.rows.length}</div>
                <div className="flex flex-wrap gap-2">{d.pro.status === "none" && <Button size="sm" variant="secondary" onClick={() => run((x, a) => proInvite(x, a, d.personId), "دعوت‌نامه ارسال شد.")}>ارسال دعوت‌نامه</Button>}{d.pro.status !== "pro" && <Button size="sm" onClick={() => { if (reason.trim().length < 5) return toast("برای پرو دستی، دلیل را در کادر بالا بنویسید.", "err"); run((x, a) => { const g = guard(x, a, "pro"); return g.ok ? grantProManually(x, g.admin.name, d.personId, reason) : g; }, "راننده پرو شد."); }}><Crown className="size-4" aria-hidden />پرو دستی (بدون انتظار)</Button>}</div></div>
            </Panel>
            <Panel title="یادداشت داخلی"><div className="flex gap-2"><Input aria-label="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} /><Button disabled={!note.trim()} onClick={() => { run((x, a) => addNote(x, a, "driver", d.personId, note), "ثبت شد."); setNote(""); }}>ثبت</Button></div></Panel>
            <Panel title="مشاهده به‌جای راننده (فقط‌خواندنی، ثبت در ممیزی)"><Button variant="secondary" size="sm" onClick={() => { const r = startViewAs(admin.id, "driver", d.personId); if (!r.ok) toast(r.error, "err"); }}><Eye className="size-4" aria-hidden />باز کردن اپ راننده</Button></Panel>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function DriversModule() {
  const s = useStore();
  const { has } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const rows = useMemo(() => s.drivers.map((d) => ({ d, st: driverStats(s, d.personId), stage: driverStage(s, d) })), [s]);
  if (!has("drivers.view")) return <Denied perm="drivers.view" />;
  type R_ = (typeof rows)[number];
  const cols: Col<R_>[] = [
    { id: "name", label: "راننده", cell: ({ d }) => <span className="flex items-center gap-2"><Avatar name={pn(s, d.personId)} pro={d.pro.status === "pro"} size={30} hue={(d.personId.length * 61) % 360} /><b>{pn(s, d.personId)}</b></span>, value: ({ d }) => pn(s, d.personId) },
    { id: "phone", label: "موبایل", cell: ({ d }) => <span dir="ltr" className="tabular">{person(s, d.personId)?.phone}</span>, value: ({ d }) => person(s, d.personId)?.phone },
    { id: "stage", label: "وضعیت", cell: ({ stage }) => <Pill tone={stage === "suspended" ? "danger" : stage === "verified" || stage === "pro" ? "ok" : "warn"}>{STAGE_LABEL[stage]}</Pill>, value: ({ stage }) => STAGE_LABEL[stage] },
    { id: "veh", label: "خودرو", cell: ({ d }) => VEHICLES[d.vehicle.kind].short, value: ({ d }) => VEHICLES[d.vehicle.kind].short },
    { id: "trips", label: "سفر", cell: ({ st }) => fa(st.trips), value: ({ st }) => st.trips, num: true },
    { id: "rating", label: "امتیاز", cell: ({ st }) => fa(Math.round(st.rating * 10) / 10), value: ({ st }) => st.rating, num: true },
    { id: "ontime", label: "وقت‌شناسی", cell: ({ st }) => `${fa(Math.round(st.onTime * 100))}٪`, value: ({ st }) => st.onTime, num: true, hidden: true },
    { id: "debt", label: "بدهی", cell: ({ d }) => (openDebt(s, d.personId) ? toman(openDebt(s, d.personId)) : "—"), value: ({ d }) => openDebt(s, d.personId) / 10, num: true },
    { id: "wallet", label: "موجودی", cell: ({ d }) => toman(driverWallet(s, d.personId).available), value: ({ d }) => driverWallet(s, d.personId).available / 10, num: true, hidden: true },
  ];
  return (
    <div>
      <PageHead title="رانندگان" sub={`${fa(rows.length)} راننده · ${fa(rows.filter((r) => r.stage === "pro").length)} پرو`} />
      <DataTable id="drivers" rows={rows} cols={cols} rowKey={({ d }) => d.personId} onRow={({ d }) => setSel(d.personId)} search={({ d }) => `${pn(s, d.personId)} ${person(s, d.personId)?.phone}`}
        filters={[{ id: "stage", label: "وضعیت", options: Object.entries(STAGE_LABEL).map(([id, label]) => ({ id, label })), test: ({ stage }, v) => stage === v }, { id: "veh", label: "خودرو", options: Object.values(VEHICLES).map((v) => ({ id: v.kind, label: v.short })), test: ({ d }, v) => d.vehicle.kind === v }, { id: "debt", label: "بدهی", options: [{ id: "y", label: "دارای بدهی" }], test: ({ d }) => openDebt(s, d.personId) > 0 }]} />
      <Driver360 id={sel} onClose={() => setSel(null)} />
    </div>
  );
}

/* ───────────────────────── KYC / document queues ───────────────────────── */

export function KycModule() {
  const s = useStore();
  const { has, run } = useAdmin();
  const [tab, setTab] = useState<"drivers" | "docs" | "shippers">("drivers");
  const [sel, setSel] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  if (!has("drivers.kyc") && !has("drivers.view")) return <Denied perm="drivers.kyc" />;
  const pending = s.drivers.filter((d) => d.kyc.status === "pending").sort((a, b) => (a.kyc.submittedAt ?? 0) - (b.kyc.submittedAt ?? 0));
  const docs = s.drivers.filter((d) => d.kyc.status === "verified" && Object.values(d.docs).some((f) => f && f.reviewed === false));
  const shippers = s.shippers.filter((x) => x.verifyDoc?.status === "pending");
  const d = sel ? s.drivers.find((x) => x.personId === sel) : undefined;
  const p = d && person(s, d.personId);
  return (
    <div>
      <PageHead title="احراز هویت و بازبینی مدارک" sub="صف‌ها از قدیمی‌ترین مرتب شده‌اند" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "drivers", label: "احراز رانندگان", count: pending.length }, { id: "docs", label: "مدارک تمدیدی", count: docs.length }, { id: "shippers", label: "تأیید کسب‌وکار", count: shippers.length }]} className="mb-4" />
      {tab === "drivers" && (pending.length === 0 ? <Card className="p-8 text-center text-sm text-ink-3">صف احراز خالی است.</Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{pending.map((x) => <button key={x.personId} onClick={() => { setSel(x.personId); setReasons([]); }} className="rounded-2xl bg-white p-4 text-start shadow-soft transition hover:shadow-lift"><div className="flex items-center gap-3"><Avatar name={pn(s, x.personId)} size={44} hue={(x.personId.length * 61) % 360} /><div><div className="font-black">{pn(s, x.personId)}</div><div className="text-xs text-ink-3">{VEHICLES[x.vehicle.kind].short} · ارسال {x.kyc.submittedAt ? jShort(x.kyc.submittedAt) : "—"}</div></div></div><div className="mt-3 flex gap-1.5">{Object.values(x.docs).slice(0, 5).map((f, i) => f?.dataUrl /* eslint-disable-next-line @next/next/no-img-element */ ? <img key={i} src={f.dataUrl} alt="" className="size-10 rounded-lg bg-surface-2 object-cover" /> : null)}</div></button>)}</div>
      ))}
      {tab === "docs" && (docs.length === 0 ? <Card className="p-8 text-center text-sm text-ink-3">مدرک تمدیدی در انتظار نیست.</Card> : <div className="space-y-2">{docs.map((x) => <button key={x.personId} onClick={() => setSel(x.personId)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-start shadow-soft"><b>{pn(s, x.personId)}</b><Pill tone="warn">{Object.values(x.docs).filter((f) => f && f.reviewed === false).length} مدرک جدید</Pill></button>)}</div>)}
      {tab === "shippers" && (shippers.length === 0 ? <Card className="p-8 text-center text-sm text-ink-3">مدرک کسب‌وکاری در انتظار نیست.</Card> : <div className="grid gap-3 md:grid-cols-2">{shippers.map((x) => <ShipperDoc key={x.personId} sh={x} onDecide={(ok, note) => run((st, a) => reviewShipperDoc(st, a, x.personId, ok, note), ok ? "تأیید شد." : "رد شد.")} />)}</div>)}
      {d && p && tab !== "shippers" && (
        <Sheet open onClose={() => setSel(null)} title={`بررسی مدارک ${p.name}`} wide footer={d.kyc.status === "pending" ? <div className="space-y-3"><div className="flex flex-wrap gap-1.5">{KYC_REASONS.map((r) => <button key={r} onClick={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} aria-pressed={reasons.includes(r)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${reasons.includes(r) ? "bg-danger text-white" : "bg-surface-3"}`}>{r}</button>)}</div><div className="grid grid-cols-2 gap-2"><Button variant="danger" disabled={reasons.length === 0} onClick={() => { const r = run((x, a) => reviewKyc(x, a, d.personId, false, reasons), "رد شد و به راننده اعلام شد."); if (r.ok) setSel(null); }}><X className="size-4" aria-hidden />رد با دلیل‌های انتخابی</Button><Button onClick={() => { const r = run((x, a) => reviewKyc(x, a, d.personId, true), "تأیید شد."); if (r.ok) setSel(null); }}><Check className="size-4" aria-hidden />تأیید و فعال‌سازی</Button></div></div> : undefined}>
          <div className="space-y-4">
            <dl className="grid divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0"><div className="divide-y divide-line/70"><KV k="نام" v={p.name} /><KV k="کد ملی" v={p.nationalId} /><KV k="تولد" v={p.birthDate} /><KV k="تطبیق شاهکار" v={d.kyc.idMatch.status === "ok" ? "تأیید" : d.kyc.idMatch.status} /></div><div className="divide-y divide-line/70"><KV k="خودرو" v={VEHICLES[d.vehicle.kind].label} /><KV k="پلاک" v={d.vehicle.plate ? <PlateView plate={d.vehicle.plate} className="h-8!" /> : "—"} /><KV k="یخچال" v={`${d.vehicle.fridgeBrand} · ${d.vehicle.minTemp ?? "—"}°`} /><KV k="موبایل" v={<span dir="ltr">{p.phone}</span>} /></div></dl>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{(["selfie", "license", "regFront", "insurance", "inspection"] as const).map((k) => { const f = d.docs[k]; const label = { selfie: "عکس چهره", license: "گواهینامه", regFront: "کارت خودرو", insurance: "بیمه‌نامه", inspection: "معاینه‌ی فنی" }[k]; return <Card key={k} className="space-y-2 p-2.5"><div className="flex items-center justify-between text-xs font-bold">{label}{f && f.reviewed === false && d.kyc.status === "verified" && <span className="flex gap-1"><button aria-label="تأیید" onClick={() => run((x, a) => reviewDriverDoc(x, a, d.personId, k, true), "تأیید شد.")} className="grid size-7 place-items-center rounded-full bg-ok-bg text-ok"><Check className="size-3.5" /></button><button aria-label="رد" onClick={() => run((x, a) => reviewDriverDoc(x, a, d.personId, k, false), "رد شد.")} className="grid size-7 place-items-center rounded-full bg-danger-bg text-danger"><X className="size-3.5" /></button></span>}</div>{f?.dataUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.dataUrl} alt={label} className="h-28 w-full rounded-xl bg-surface-2 object-contain" /> : <div className="grid h-28 place-items-center rounded-xl bg-surface-2 text-xs text-ink-3">ندارد</div>}{f?.expiresAt && <div className="text-[11px] text-ink-3">انقضا {jShort(f.expiresAt)}</div>}</Card>; })}</div>
          </div>
        </Sheet>
      )}
      <span className="sr-only"><BadgeCheck /><ShieldAlert /></span>
    </div>
  );
}

function ShipperDoc({ sh, onDecide }: { sh: ShipperProfile; onDecide: (ok: boolean, note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Card className="space-y-3 p-4"><div className="font-black">{sh.displayName}</div><div className="text-xs text-ink-3">{sh.company?.name} · کد اقتصادی {sh.company?.economicCode ?? "—"}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {sh.verifyDoc && <img src={sh.verifyDoc.dataUrl} alt="مدرک کسب‌وکار" className="h-36 w-full rounded-xl bg-surface-2 object-contain" />}
      <Input aria-label="توضیح (برای رد)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح (برای رد الزامی)" />
      <div className="grid grid-cols-2 gap-2"><Button variant="danger" size="sm" disabled={note.trim().length < 4} onClick={() => onDecide(false, note)}>رد</Button><Button size="sm" onClick={() => onDecide(true, "")}>تأیید کسب‌وکار</Button></div></Card>
  );
}

/* ───────────────────────── Shippers ───────────────────────── */

export function ShippersModule() {
  const s = useStore();
  const { admin, has, run } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const [limit, setLimit] = useState<number | undefined>();
  if (!has("shippers.view")) return <Denied perm="shippers.view" />;
  const rows = s.shippers.map((sh) => ({ sh, st: shipperStats(s, sh.personId), w: shipperWallet(s, sh.personId) }));
  type R_ = (typeof rows)[number];
  const cols: Col<R_>[] = [
    { id: "name", label: "صاحب بار", cell: ({ sh }) => <span className="flex items-center gap-2"><Avatar name={sh.displayName} size={30} hue={sh.hue} src={sh.logo} /><b>{sh.displayName}</b>{sh.businessVerified && <BadgeCheck className="size-4 text-accent-600" aria-label="تأییدشده" />}</span>, value: ({ sh }) => sh.displayName },
    { id: "phone", label: "موبایل", cell: ({ sh }) => <span dir="ltr" className="tabular">{person(s, sh.personId)?.phone}</span>, value: ({ sh }) => person(s, sh.personId)?.phone },
    { id: "orders", label: "سفارش", cell: ({ sh }) => fa(s.orders.filter((o) => o.shipperId === sh.personId).length), value: ({ sh }) => s.orders.filter((o) => o.shipperId === sh.personId).length, num: true },
    { id: "rating", label: "امتیاز", cell: ({ st }) => fa(Math.round(st.rating * 10) / 10), value: ({ st }) => st.rating, num: true },
    { id: "wallet", label: "کیف پول", cell: ({ w }) => toman(w.available), value: ({ w }) => w.available / 10, num: true },
    { id: "debt", label: "بدهی", cell: ({ w }) => (w.debt ? toman(w.debt) : "—"), value: ({ w }) => w.debt / 10, num: true },
    { id: "credit", label: "اعتبار", cell: ({ sh }) => (sh.controls.creditTermsDays ? `${fa(sh.controls.creditTermsDays)} روزه` : "—"), value: ({ sh }) => sh.controls.creditTermsDays, hidden: true },
    { id: "state", label: "وضعیت", cell: ({ sh }) => (sh.controls.blocked ? <Pill tone="danger">مسدود</Pill> : sh.controls.walletFrozen ? <Pill tone="warn">کیف پول مسدود</Pill> : <Pill tone="ok">فعال</Pill>) },
  ];
  const sh = sel ? s.shippers.find((x) => x.personId === sel) : undefined;
  return (
    <div>
      <PageHead title="صاحبان بار" sub={`${fa(rows.length)} حساب`} />
      <DataTable id="shippers" rows={rows} cols={cols} rowKey={({ sh }) => sh.personId} onRow={({ sh }) => setSel(sh.personId)} search={({ sh }) => `${sh.displayName} ${person(s, sh.personId)?.phone} ${sh.company?.name ?? ""}`}
        filters={[{ id: "v", label: "تأیید", options: [{ id: "y", label: "کسب‌وکار تأییدشده" }, { id: "n", label: "تأییدنشده" }], test: ({ sh }, v) => (v === "y") === sh.businessVerified }, { id: "c", label: "اعتبار", options: [{ id: "y", label: "اعتبار سازمانی" }], test: ({ sh }) => sh.controls.creditTermsDays > 0 }]} />
      {sh && (
        <Sheet open onClose={() => setSel(null)} title="پرونده‌ی ۳۶۰ درجه‌ی صاحب بار" wide>
          <div className="space-y-4">
            <div className="flex items-center gap-4"><Avatar name={sh.displayName} size={64} hue={sh.hue} src={sh.logo} /><div><div className="text-lg font-black">{sh.displayName}</div><div className="text-sm text-ink-3" dir="ltr">{person(s, sh.personId)?.phone}</div></div></div>
            <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="شرکت" v={sh.company?.name} /><KV k="کد اقتصادی" v={sh.company?.economicCode} /><KV k="نشانی" v={sh.address?.text} /><KV k="کیف پول" v={toman(shipperWallet(s, sh.personId).available)} /><KV k="بدهی" v={toman(shipperWallet(s, sh.personId).debt)} /><KV k="اعتبار سازمانی" v={sh.controls.creditTermsDays ? `${fa(sh.controls.creditTermsDays)} روزه · سقف ${toman(sh.controls.creditLimit)}` : "ندارد"} /><KV k="اعتبار حساب (صداقت)" v={fa(sh.honesty)} /></dl>
            <Panel title="کنترل‌ها">
              {([["blocked", "مسدودی حساب"], ["walletFrozen", "مسدودی کیف پول"], ["blockCardToCard", "غیرفعال‌سازی کارت‌به‌کارت"], ["cashToDriver", "مجاز به پرداخت نقدی به راننده"], ["couponEligible", "مجاز به استفاده از کد تخفیف"]] as const).map(([k, l]) => <div key={k} className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm font-medium">{l}</span><Toggle checked={!!sh.controls[k]} onChange={(v) => run((x, a) => setShipperControls(x, a, sh.personId, { [k]: v }), "ذخیره شد.")} label={l} /></div>)}
              <div className="mt-3 flex gap-2"><Input aria-label="سقف اعتبار (تومان)" dir="ltr" inputMode="numeric" className="w-48" placeholder="سقف اعتبار (تومان)" value={limit ?? ""} onChange={(e) => setLimit(Number(e.target.value.replace(/\D/g, "")) || undefined)} /><Button size="sm" variant="secondary" disabled={!limit} onClick={() => run((x, a) => setShipperControls(x, a, sh.personId, { creditLimit: R(limit!), creditTermsDays: sh.controls.creditTermsDays || 30 }), "اعتبار تنظیم شد.")}>تنظیم اعتبار ۳۰ روزه</Button></div>
            </Panel>
            <Panel title="مشاهده به‌جای صاحب بار (فقط‌خواندنی)"><Button variant="secondary" size="sm" onClick={() => { const r = startViewAs(admin.id, "shipper", sh.personId); if (!r.ok) toast(r.error, "err"); }}><Eye className="size-4" aria-hidden />باز کردن پنل صاحب بار</Button></Panel>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ───────────────────────── Pro program ───────────────────────── */

export function ProModule() {
  const s = useStore();
  const { has, run } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  if (!has("pro")) return <Denied perm="pro" />;
  const pros = s.drivers.filter((d) => d.pro.status === "pro");
  const invited = s.drivers.filter((d) => d.pro.status === "invited");
  const sched = invited.filter((d) => d.pro.inspection === "scheduled").sort((a, b) => (a.pro.inspectionAt ?? 0) - (b.pro.inspectionAt ?? 0));
  const d = sel ? s.drivers.find((x) => x.personId === sel) : undefined;
  const total = Math.round(INSPECT_CHECKS.reduce((n, c) => n + c.weight * ((scores[c.id] ?? 0) / 100), 0));
  return (
    <div>
      <PageHead title="برنامه‌ی کامیونت پرو" sub="دعوت خودکار، زمان‌بندی بازرسی و ثبت نتیجه" actions={<Button variant="secondary" onClick={() => { const n = act((x) => proAutoScan(x)); toast(`${fa(n)} راننده‌ی واجد شرایط دعوت شد.`); }}>اجرای اسکن دعوت خودکار</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Card className="p-4"><div className="text-xs text-ink-3">رانندگان پرو</div><div className="text-2xl font-black">{fa(pros.length)}</div></Card><Card className="p-4"><div className="text-xs text-ink-3">دعوت‌شده</div><div className="text-2xl font-black">{fa(invited.length)}</div></Card><Card className="p-4"><div className="text-xs text-ink-3">بازرسی رزروشده</div><div className="text-2xl font-black">{fa(sched.length)}</div></Card><Card className="p-4"><div className="text-xs text-ink-3">معیار ورود</div><div className="text-sm font-bold">{fa(s.config.values["pro.minTrips"] as number ?? 100)} سفر · {fa(s.config.values["pro.minRating"] as number ?? 4.6)}★</div></Card></div>
      <Panel title="برنامه‌ی بازرسی (نزدیک‌ترین بالا)" className="mb-5">{sched.length === 0 ? <p className="text-sm text-ink-3">بازرسی رزروشده‌ای نیست.</p> : <ul className="divide-y divide-line/70">{sched.map((x) => <li key={x.personId} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-bold">{pn(s, x.personId)}</div><div className="text-xs text-ink-3">{jDateTime(x.pro.inspectionAt!)} · {x.pro.inspectionCenter}</div></div><Button size="sm" onClick={() => { setSel(x.personId); setScores({}); setNote(""); }}>ثبت نتیجه‌ی بازرسی</Button></li>)}</ul>}</Panel>
      <Panel title="دعوت‌شده‌ها و بازرسی‌ناشده"><ul className="divide-y divide-line/70">{invited.filter((x) => x.pro.inspection !== "scheduled").map((x) => <li key={x.personId} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="font-bold">{pn(s, x.personId)}</span><Pill tone={x.pro.inspection === "failed" ? "danger" : "neutral"}>{x.pro.inspection === "failed" ? "بازرسی ناموفق" : "منتظر رزرو"}</Pill></li>)}{invited.filter((x) => x.pro.inspection !== "scheduled").length === 0 && <li className="py-3 text-sm text-ink-3">—</li>}</ul></Panel>
      {d && (
        <Sheet open onClose={() => setSel(null)} title={`بازرسی ${pn(s, d.personId)}`} wide footer={<div className="space-y-2"><div className="flex items-center justify-between text-sm font-bold"><span>نمره‌ی کل</span><span className={total >= PASS_SCORE ? "text-ok" : "text-danger"}>{fa(total)} از ۱۰۰ (حد نصاب {fa(PASS_SCORE)})</span></div><Button block onClick={() => { const r = run((x, a) => { const g = guard(x, a, "pro"); return g.ok ? recordInspection(x, g.admin.name, d.personId, scores, note) : g; }); if (r.ok) { toast(r.passed ? "قبول؛ راننده پرو شد." : "رد؛ به راننده اعلام شد.", r.passed ? "ok" : "info"); setSel(null); } }}>ثبت نتیجه</Button></div>}>
          <div className="space-y-4">{INSPECT_CHECKS.map((c) => <div key={c.id} className="space-y-1"><div className="flex items-center justify-between text-sm"><span className="font-bold">{c.label}{c.critical && <span className="ms-1.5 rounded-full bg-danger-bg px-2 py-0.5 text-[10px] text-danger">ضروری</span>}</span><span className="tabular">{fa(scores[c.id] ?? 0)}٪ · وزن {fa(c.weight)}</span></div><input type="range" aria-label={c.label} min={0} max={100} step={5} value={scores[c.id] ?? 0} onChange={(e) => setScores({ ...scores, [c.id]: +e.target.value })} className="w-full" /><div className="text-xs text-ink-3">{c.how}</div></div>)}<Field label="توضیح بازرس">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field></div>
        </Sheet>
      )}
      <span className="sr-only">{ROLE_LABELS.super}</span>
    </div>
  );
}
