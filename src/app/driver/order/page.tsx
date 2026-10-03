"use client";

import { AlertTriangle, Info, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapView } from "@/components/MapView";
import { ProBadge } from "@/components/brand";
import { CargoLabel, Countdown, RatingPill, RouteLine, TempChip } from "@/components/molecules";
import { CleanBadge, OdorChip } from "@/components/order/parts";
import { toast } from "@/components/Toaster";
import { Button, ButtonLink, Card, EmptyState, Field, Input, Sheet, Skeleton } from "@/components/ui";
import { isLive } from "@/components/driver/Stages";
import { acceptDirect, claimOrder, confirmAssign, declineDirect, releaseLock } from "@/lib/engine/orders";
import { claimBlock, eligibility } from "@/lib/engine/drivers";
import { commissionRate, driverNetFor } from "@/lib/engine/pay";
import { fa, hhmm, jShort, PAY_TERMS, toman, weightLabel } from "@/lib/format";
import { useNow, usePortal, useQueryId } from "@/lib/hooks";
import { isPublic, viewOrder } from "@/lib/mask";
import { act } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";

export default function Page() {
  const id = useQueryId();
  const router = useRouter();
  const { s, me, driver, ready, stage } = usePortal("driver");
  const now = useNow(500);
  const [decline, setDecline] = useState(false);
  const [reason, setReason] = useState("مسیر یا زمان مناسب نیست");
  const o = s.orders.find((x) => x.id === id);
  if (id === undefined || !ready) return <Skeleton className="h-64" />;
  if (!o || !me) return <EmptyState icon={<AlertTriangle className="size-8" />} title="بار پیدا نشد" action={<Link href="/driver/" className="font-bold text-accent-600">بازگشت به بارها</Link>} />;
  if (o.driverId === me.id && !["LOCKED", "AWAITING_DEPOSIT", "DIRECT_REQUESTED"].includes(o.status)) { router.replace(`/driver/trip/?id=${o.id}`); return null; }
  const v = viewOrder(o, s, me.id);
  if (!isPublic(v)) return <EmptyState icon={<Lock className="size-8" />} title="این بار دیگر در دسترس نیست" body="بار به راننده‌ی دیگری اختصاص یافته است." action={<Link href="/driver/" className="font-bold text-accent-600">بازگشت به بارها</Link>} />;
  const net = driverNetFor(s, o);
  const live = isLive(stage);
  const e: { ok: boolean; why: string } = driver && live ? { why: "", ...eligibility(s, driver, o) } : { ok: false, why: "" };
  const block = claimBlock(s, driver);
  const mineLocked = o.status === "LOCKED" && o.lockedBy === me.id;
  const direct = o.status === "DIRECT_REQUESTED" && o.directDriverId === me.id;
  const waitingDeposit = o.status === "AWAITING_DEPOSIT" && o.driverId === me.id;
  const canClaim = ["OPEN", "PRO_POOL"].includes(o.status) && e.ok && live && !block;
  const run = (fn: () => { ok: boolean; error?: string }, okMsg: string) => { const r = fn(); if (!r.ok) toast(r.error ?? "انجام نشد", "err"); else toast(okMsg); return r; };

  return (
    <div className="space-y-4 pb-28">
      <Link href="/driver/" className="inline-flex h-11 items-center text-sm font-medium text-accent-600">بازگشت به بارها</Link>
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-black">{v.originCity} ← {v.destCity}</h1>{v.serviceClass === "PRO" && <ProBadge />}</div>

      {mineLocked && o.lockedUntil && <Card className="space-y-3 border-2 border-brand-500 p-4"><h2 className="font-extrabold">بار برای شما رزرو شد</h2><Countdown until={o.lockedUntil} total={150} /><p className="text-sm text-ink-3">برای نهایی‌کردن، تأیید کنید؛ در غیر این صورت بار دوباره آزاد می‌شود.</p></Card>}
      {direct && v.directExpiresAt && <Card className="space-y-3 border-2 border-brand-500 p-4"><h2 className="font-extrabold">درخواست مستقیم صاحب بار</h2><Countdown until={v.directExpiresAt} total={600} /></Card>}
      {waitingDeposit && <Card className="space-y-3 border-2 border-brand-500 p-4"><h2 className="font-extrabold">منتظر پرداخت بیعانه‌ی صاحب بار هستیم</h2>{o.depositDueAt && <Countdown until={o.depositDueAt} total={600} />}<p className="text-sm leading-7 text-ink-3">به‌محض پرداخت، آدرس دقیق، پین نقشه و شماره‌ی تماس را همین‌جا نشان می‌دهیم و اعلان می‌گیرید. تا آن زمان این بار برای شما رزرو است و برای جلوگیری از تداخل نمی‌توانید بار دیگری بردارید. اگر بیعانه پرداخت نشود، رزرو آزاد می‌شود و هیچ جریمه‌ای ندارید.</p></Card>}

      <Card className="space-y-3 p-4">
        <RouteLine from={v.originCity} to={v.destCity} sub={["محدوده‌ی تقریبی؛ آدرس دقیق پس از پرداخت بیعانه", "محدوده‌ی تقریبی؛ آدرس دقیق پس از پرداخت بیعانه"]} />
        <div className="h-44 overflow-hidden rounded-ui"><MapView className="size-full" markers={[{ id: "o", lat: v.originArea.lat, lng: v.originArea.lng, kind: "origin" }, { id: "d", lat: v.destArea.lat, lng: v.destArea.lng, kind: "dest" }]} circles={[{ id: "ca", lat: v.originArea.lat, lng: v.originArea.lng, radius: v.originArea.radius, tone: "accent" }, { id: "cb", lat: v.destArea.lat, lng: v.destArea.lng, radius: v.destArea.radius }]} fitKey={o.id} /></div>
        <div className="flex flex-wrap gap-2">{v.tempMin !== undefined && v.tempMax !== undefined ? <TempChip min={v.tempMin} max={v.tempMax} /> : <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold">بدون کنترل دما</span>}<OdorChip odor={v.odor} sensitive={v.odorSensitive} />{v.cleanOnly && <CleanBadge />}</div>
        <dl className="grid grid-cols-2 gap-3 text-sm">{[["بار", <CargoLabel key="c" type={v.cargo} />], ["وزن", weightLabel(v.weightKg)], ["خودرو", VEHICLES[v.vehicleKind].short], ["مسافت", `${fa(v.distanceKm)} کیلومتر`], ["بارگیری", `${jShort(v.pickupAt)}، ${hhmm(v.pickupAt)} تا ${hhmm(v.pickupTo)}`], ["مهلت تحویل", `${jShort(v.deliverBy)}، ${hhmm(v.deliverBy)}`], ["شرایط پرداخت", PAY_TERMS[v.terms]], ["بیمه", v.insured ? "دارد" : "ندارد"]].map(([k, val]) => <div key={String(k)}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{val}</dd></div>)}</dl>
        <Link href={`/driver/shipper/?id=${v.shipper.id}`} className="flex min-h-12 items-center justify-between rounded-ui bg-surface-2 p-3 text-sm"><span className="font-bold">{v.shipper.name}</span><RatingPill r={v.shipper.rating} /></Link>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="font-extrabold">درآمد شما</h2>
        <dl className="space-y-1.5 text-sm"><div className="flex justify-between"><dt className="text-ink-3">کرایه</dt><dd className="font-bold tabular">{toman(o.freight)}</dd></div><div className="flex justify-between"><dt className="text-ink-3">کارمزد کامیونت ({fa(Math.round(commissionRate(s, o) * 100))}٪)</dt><dd className="font-bold tabular text-danger">−{toman(net.commission)}</dd></div>{net.tips > 0 && <div className="flex justify-between"><dt className="text-ink-3">انعام</dt><dd className="font-bold tabular text-ok">+{toman(net.tips)}</dd></div>}<div className="flex justify-between border-t border-line pt-2 text-lg font-black"><dt>درآمد خالص</dt><dd className="tabular text-ok">{toman(net.net)}</dd></div></dl>
        {o.terms === "CASH_BALANCE_TO_DRIVER" && o.cashAgreed > 0 && <p className="flex gap-2 rounded-ui bg-accent-50 p-3 text-sm leading-7 text-accent-700"><Info className="mt-1 size-4 shrink-0" aria-hidden />{toman(o.cashAgreed)} از کرایه را هنگام تحویل نقد از گیرنده می‌گیرید و باید مبلغ را در اپ تأیید کنید.</p>}
      </Card>

      {!e.ok && live && !direct && <p role="alert" className="rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn">{e.why}</p>}
      {block && <p role="alert" className="rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn">{block}</p>}

      <div className="pb-safe glass fixed inset-x-0 bottom-[86px] z-20 border-t border-white/60 p-3">
        <div className="mx-auto max-w-2xl space-y-2">
          {!live && ["OPEN", "PRO_POOL"].includes(o.status) && <><ButtonLink href="/driver/kyc/" size="lg" block className="h-14">{stage === "in_review" ? "مدارک در حال بررسی است" : "احراز هویت را کامل کنید تا بار را بگیرید"}</ButtonLink><p className="text-center text-xs text-ink-3">پس از تأیید مدارک می‌توانید بار انتخاب کنید؛ تا آن زمان بارها را ببینید.</p></>}
          {canClaim && <><Button block size="lg" className="h-14" onClick={() => run(() => act((st) => claimOrder(st, me.id, o.id)), "بار برای شما رزرو شد.")}>انتخاب این بار · {toman(net.net)}</Button><p className="text-center text-xs text-ink-3">با انتخاب این بار، بلافاصله برای شما رزرو می‌شود.</p></>}
          {mineLocked && <div className="grid grid-cols-[1fr_2fr] gap-2"><Button variant="secondary" size="lg" onClick={() => run(() => act((st) => releaseLock(st, me.id, o.id)), "رزرو آزاد شد.")}>انصراف</Button><Button size="lg" onClick={() => { const r = run(() => act((st) => confirmAssign(st, me.id, o.id)), "تأیید شد؛ منتظر بیعانه‌ی صاحب بار."); if (r.ok) router.replace("/driver/"); }}>تأیید نهایی</Button></div>}
          {direct && <div className="grid grid-cols-[1fr_2fr] gap-2"><Button variant="secondary" size="lg" onClick={() => setDecline(true)}>رد درخواست</Button><Button size="lg" onClick={() => run(() => act((st) => acceptDirect(st, me.id, o.id)), "درخواست پذیرفته شد.")}>پذیرش</Button></div>}
        </div>
      </div>
      <Sheet open={decline} onClose={() => setDecline(false)} title="رد درخواست مستقیم" footer={<Button block variant="danger" onClick={() => { const r = run(() => act((st) => declineDirect(st, me.id, o.id, reason)), "درخواست رد شد."); if (r.ok) router.replace("/driver/"); }}>تأیید رد</Button>}><Field label="دلیل">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field></Sheet>
    </div>
  );
}
