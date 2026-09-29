"use client";

import { AlertTriangle, Ban, LifeBuoy, PackageX, Radar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BackLink, RouteLine, StatusBadge, TempChip, CargoLabel } from "@/components/molecules";
import { TempPanel } from "@/components/TempPanel";
import { MediaGallery, MismatchButton, OrderTimeline, PartyCard, RatingBox, TrackingMap, WaybillLink } from "@/components/order";
import { toast } from "@/components/Toaster";
import { Button, Card, EmptyState, Modal, Skeleton, Textarea, ButtonLink } from "@/components/ui";
import { fa, jDateTime, payLabel, toman, tomanWords, VEHICLES, weightLabel, windowLabel } from "@/lib/format";
import { useApp, useQueryId } from "@/lib/hooks";
import { fullView } from "@/lib/mask";
import { cancelOrder } from "@/lib/store";
import { cancelFeeFor } from "@/lib/pricing";

export default function ShipperOrder() {
  const id = useQueryId();
  const { s, me, ready } = useApp();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  const o = s.orders.find((x) => x.id === id && x.shipperId === me?.id);
  if (!ready || id === null) return <AppShell area="shipper"><Skeleton className="h-96" /></AppShell>;
  if (!o) return <AppShell area="shipper"><EmptyState icon={<PackageX className="size-7" />} title="سفارش پیدا نشد" body="این سفارش وجود ندارد یا متعلق به حساب شما نیست." action={<ButtonLink href="/shipper/">بازگشت به سفارش‌ها</ButtonLink>} /></AppShell>;

  const v = fullView(o, s);
  const showMap = ["ASSIGNED", "IN_TRANSIT", "DELIVERED"].includes(v.status);
  const canCancel = ["OPEN", "LOCKED", "ASSIGNED"].includes(v.status);
  const fee = cancelFeeFor(v.price, s.config);

  return (
    <AppShell area="shipper">
      <div className="mb-4 flex items-center justify-between"><BackLink href="/shipper/">سفارش‌ها</BackLink><StatusBadge status={v.status} /></div>

      <div className="space-y-4">
        <Card className="p-5"><OrderTimeline status={v.status} /></Card>

        {v.status === "OPEN" && (
          <Card className="flex animate-rise items-center gap-3 bg-brand-50 p-4 shadow-none">
            <Radar className="size-6 shrink-0 text-brand-700" />
            <p className="text-sm leading-7">سفارش شما هم‌اکنون روی نقشه‌ی رانندگان مناسب دمای بار نمایش داده می‌شود. به محض انتخاب، همین‌جا خبر می‌دهیم.</p>
          </Card>
        )}
        {v.status === "LOCKED" && <Card className="animate-rise bg-accent-50 p-4 text-sm leading-7 shadow-none">یک راننده در حال تأیید نهایی این سفارش است. اگر تا چند دقیقه‌ی دیگر تأیید نکند، سفارش دوباره برای بقیه باز می‌شود.</Card>}
        {v.status === "CANCELLED" && v.cancelFee ? <Card className="bg-warn-bg p-4 text-sm leading-7 text-warn shadow-none"><b>جریمه‌ی لغو:</b> {toman(v.cancelFee)} به دلیل لغو پس از تعیین راننده ثبت شد.</Card> : null}
        {v.flag && <Card className="bg-warn-bg p-4 text-sm leading-7 text-warn shadow-none"><b>مغایرت فاکتور:</b> {v.flag.note} — {v.flag.status === "open" ? "در دست بررسی پشتیبانی" : "بررسی و بسته شد"}</Card>}

        {showMap && <TrackingMap v={v} className="h-72 shadow-soft sm:h-96" />}
        {(v.status === "IN_TRANSIT" || v.status === "DELIVERED") && <TempPanel o={v} contact={v.driver} />}

        <Card className="space-y-4 p-5">
          <RouteLine from={v.origin.city} to={v.dest.city} sub={[v.origin.address, v.dest.address]} />
          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><dt className="text-ink-3">نوع بار</dt><dd className="font-bold"><CargoLabel type={v.cargo} /></dd></div>
            <div><dt className="text-ink-3">وزن</dt><dd className="font-bold">{weightLabel(v.weightKg)}{v.pallets ? ` · ${fa(v.pallets)} پالت` : ""}{v.volumeM3 ? ` · ${fa(v.volumeM3)} م³` : ""}</dd></div>
            <div className="col-span-2"><dt className="text-ink-3">دمای مجاز در تمام مسیر</dt><dd className="mt-0.5"><TempChip min={v.tempMin} max={v.tempMax} /></dd></div>
            <div><dt className="text-ink-3">خودرو</dt><dd className="font-bold">{VEHICLES[v.vehicleType]}</dd></div>
            <div><dt className="text-ink-3">مسافت</dt><dd className="font-bold">{fa(v.distanceKm)} کیلومتر</dd></div>
            <div><dt className="text-ink-3">بازه‌ی بارگیری</dt><dd className="font-bold">{windowLabel(v.pickupAt, v.pickupTo)}</dd></div>
            <div><dt className="text-ink-3">مهلت تحویل</dt><dd className="font-bold">{jDateTime(v.deliverBy)}</dd></div>
            <div><dt className="text-ink-3">کرایه{v.groupSize > 1 ? " (این خودرو)" : ""}</dt><dd className="font-black">{toman(v.price)}</dd></div>
            <div><dt className="text-ink-3">پرداخت</dt><dd className="font-bold">{payLabel(v.payment)}</dd></div>
            <div><dt className="text-ink-3">ارزش اعلامی بار</dt><dd className="font-bold">{tomanWords(v.declaredValue)}</dd></div>
            <div><dt className="text-ink-3">بیمه</dt><dd className="font-bold">{v.insurance ? "دارد" : "ندارد"}</dd></div>
            {v.note && <div className="col-span-2"><dt className="text-ink-3">توضیحات</dt><dd>{v.note}</dd></div>}
          </dl>
        </Card>

        {v.driver && <PartyCard title="راننده" name={v.driver.name} phone={v.driver.phone} extra={v.driver.plate} />}
        {v.waybillNo && <WaybillLink id={v.id} no={v.waybillNo} />}
        <MediaGallery v={v} />

        {v.status === "DELIVERED" && (
          <>
            <RatingBox v={v} meId={me!.id} ratings={s.ratings} toName={v.driver?.name ?? "راننده"} />
            <MismatchButton id={v.id} flagged={!!v.flag} />
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/support/?order=${v.id}`} variant="secondary"><LifeBuoy className="size-4" />پشتیبانی این سفارش</ButtonLink>
          {canCancel && <Button variant="danger" onClick={() => { setAck(false); setCancel(true); }}><Ban className="size-4" />لغو سفارش</Button>}
        </div>
      </div>

      <Modal open={cancel} onClose={() => setCancel(false)} title="لغو سفارش">
        {v.status === "ASSIGNED" ? (
          <div role="alert" className="mb-4 space-y-2 rounded-ui bg-warn-bg p-4 text-sm leading-7 text-warn">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4 shrink-0" aria-hidden />راننده‌ی این سفارش تعیین شده است</p>
            <p>طبق سیاست لغو، با لغو در این مرحله <b>{fa(Math.round(s.config.cancelFeePct * 100))}٪ کرایه، یعنی {toman(fee)}</b>، به‌عنوان جریمه‌ی لغو از شما دریافت می‌شود و به‌عنوان جبران وقت به راننده تعلق می‌گیرد. {v.driver ? `${v.driver.name} از لغو مطلع می‌شود.` : ""}</p>
          </div>
        ) : (
          <p className="mb-4 rounded-ui bg-ok-bg p-3 text-sm leading-7 text-ok">تا قبل از تعیین راننده، لغو سفارش <b>رایگان</b> است. پس از تعیین راننده جریمه‌ی {fa(Math.round(s.config.cancelFeePct * 100))}٪ کرایه اعمال می‌شود و پس از شروع سفر لغو ممکن نیست.</p>
        )}
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل لغو…" aria-label="دلیل لغو" />
        {v.status === "ASSIGNED" && (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm leading-6">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent-600)]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            جریمه‌ی لغو را می‌پذیرم
          </label>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setCancel(false)} className="flex-1">انصراف</Button>
          <Button variant="danger" className="flex-1" disabled={reason.trim().length < 3 || (v.status === "ASSIGNED" && !ack)} onClick={() => { const r = cancelOrder(v.id, reason.trim()); setCancel(false); toast(r.ok ? (v.status === "ASSIGNED" ? `سفارش لغو شد؛ جریمه‌ی لغو ${toman(fee)}` : "سفارش لغو شد") : r.error, r.ok ? "info" : "err"); }}>{v.status === "ASSIGNED" ? `لغو با جریمه‌ی ${toman(fee)}` : "تأیید لغو"}</Button>
        </div>
      </Modal>
    </AppShell>
  );
}
