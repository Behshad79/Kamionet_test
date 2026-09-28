"use client";

import { Ban, LifeBuoy, PackageX, Radar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BackLink, RouteLine, StatusBadge, TempChip, CargoLabel } from "@/components/molecules";
import { MediaGallery, MismatchButton, OrderTimeline, PartyCard, RatingBox, TrackingMap, WaybillLink } from "@/components/order";
import { toast } from "@/components/Toaster";
import { Button, Card, EmptyState, Modal, Skeleton, Textarea } from "@/components/ui";
import { CARGO, fa, jDateTime, toman } from "@/lib/format";
import { useApp, useQueryId } from "@/lib/hooks";
import { fullView } from "@/lib/mask";
import { cancelOrder } from "@/lib/store";

export default function ShipperOrder() {
  const id = useQueryId();
  const { s, me, ready } = useApp();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");

  const o = s.orders.find((x) => x.id === id && x.shipperId === me?.id);
  if (!ready || id === null) return <AppShell area="shipper"><Skeleton className="h-96" /></AppShell>;
  if (!o) return <AppShell area="shipper"><EmptyState icon={<PackageX className="size-7" />} title="سفارش پیدا نشد" body="این سفارش وجود ندارد یا متعلق به حساب شما نیست." action={<Link href="/shipper/"><Button>بازگشت به سفارش‌ها</Button></Link>} /></AppShell>;

  const v = fullView(o, s);
  const showMap = ["ASSIGNED", "IN_TRANSIT", "DELIVERED"].includes(v.status);
  const canCancel = ["OPEN", "LOCKED", "ASSIGNED"].includes(v.status);

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
        {v.flag && <Card className="bg-warn-bg p-4 text-sm leading-7 text-warn shadow-none"><b>مغایرت فاکتور:</b> {v.flag.note} — {v.flag.status === "open" ? "در دست بررسی پشتیبانی" : "بررسی و بسته شد"}</Card>}

        {showMap && <TrackingMap v={v} className="h-72 shadow-soft sm:h-96" />}

        <Card className="space-y-4 p-5">
          <RouteLine from={v.origin.city} to={v.dest.city} sub={[v.origin.address, v.dest.address]} />
          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><dt className="text-ink-3">نوع بار</dt><dd className="font-bold"><CargoLabel type={v.cargo} /></dd></div>
            <div><dt className="text-ink-3">دما</dt><dd className="mt-0.5"><TempChip tempMax={v.tempMax} /></dd></div>
            <div><dt className="text-ink-3">زمان بارگیری</dt><dd className="font-bold">{jDateTime(v.pickupAt)}</dd></div>
            <div><dt className="text-ink-3">مسافت</dt><dd className="font-bold">{fa(v.distanceKm)} کیلومتر</dd></div>
            <div><dt className="text-ink-3">کرایه</dt><dd className="font-black">{toman(v.price)}</dd></div>
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
          <Link href={`/support/?order=${v.id}`}><Button variant="secondary"><LifeBuoy className="size-4" />پشتیبانی این سفارش</Button></Link>
          {canCancel && <Button variant="danger" onClick={() => setCancel(true)}><Ban className="size-4" />لغو سفارش</Button>}
        </div>
      </div>

      <Modal open={cancel} onClose={() => setCancel(false)} title="لغو سفارش">
        <p className="mb-3 text-sm leading-7 text-ink-3">{v.status === "ASSIGNED" ? "راننده تعیین شده و از لغو مطلع می‌شود. " : ""}دلیل لغو را بنویسید.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل لغو…" />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setCancel(false)} className="flex-1">انصراف</Button>
          <Button variant="danger" className="flex-1" disabled={reason.trim().length < 3} onClick={() => { const r = cancelOrder(v.id, reason.trim()); setCancel(false); toast(r.ok ? "سفارش لغو شد" : r.error, r.ok ? "info" : "err"); }}>تأیید لغو</Button>
        </div>
      </Modal>
    </AppShell>
  );
}
