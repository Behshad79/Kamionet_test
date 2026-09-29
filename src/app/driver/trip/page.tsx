"use client";

import { AlertTriangle, ClipboardCheck, Navigation, PackageX, Play, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BackLink, FileDrop, RouteLine, StatusBadge, TempChip, type Captured, CargoLabel } from "@/components/molecules";
import { TempPanel } from "@/components/TempPanel";
import { MediaGallery, MismatchButton, OrderTimeline, PartyCard, RatingBox, TrackingMap, WaybillLink } from "@/components/order";
import { toast } from "@/components/Toaster";
import { Button, Card, EmptyState, Field, Input, Skeleton, cx, ButtonLink } from "@/components/ui";
import { CARGO, fa, jDateTime, toman } from "@/lib/format";
import { useApp, useQueryId } from "@/lib/hooks";
import { fullView } from "@/lib/mask";
import { driverNet } from "@/lib/pricing";
import { deliver, driverDrop, startTrip } from "@/lib/store";
import type { FullView, Media } from "@/lib/types";

const CHECK = [
  "فاکتور شامل فهرست اقلام (نوع و تعداد) است",
  "تمام اقلام خوانا و کامل در قاب عکس هستند",
  "مهر یا امضای گیرنده روی فاکتور دیده می‌شود",
];

const toMedia = (c: Captured, kind: Media["kind"], items?: number): Media => ({ kind, dataUrl: c.dataUrl, takenAt: c.takenAt, lat: c.lat, lng: c.lng, items });
const num = (s: string) => (s === "" ? undefined : +s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, ""));

function StartForm({ v }: { v: FullView }) {
  const [cargo, setCargo] = useState<Captured>();
  const [inv, setInv] = useState<Captured>();
  const [items, setItems] = useState("");
  const ok = cargo && inv && num(items) !== undefined;
  return (
    <Card className="animate-rise space-y-4 p-5">
      <h2 className="text-lg font-black">شروع سفر · مدارک بارگیری</h2>
      <p className="text-sm leading-7 text-ink-3">پیش از حرکت، وضعیت واقعی بار و فاکتور فرستنده را ثبت کنید. زمان و موقعیت روی عکس‌ها مهر می‌شود.</p>
      <div className="grid grid-cols-2 gap-3">
        <FileDrop label="عکس بار" hint="نوع و حجم واقعی بار" capture stamp value={cargo?.dataUrl} fallback={v.origin} onChange={setCargo} />
        <FileDrop label="فاکتور فرستنده" hint="فهرست اقلام بار" capture stamp value={inv?.dataUrl} fallback={v.origin} onChange={setInv} />
      </div>
      <Field label="تعداد اقلام طبق فاکتور مبدأ">{(id) => <Input id={id} inputMode="numeric" placeholder="مثلاً ۴۰" value={items} onChange={(e) => setItems(e.target.value)} />}</Field>
      <Button block size="lg" disabled={!ok} onClick={() => {
        const r = startTrip(v.id, toMedia(cargo!, "cargo"), toMedia(inv!, "invoice_pickup", num(items)));
        toast(r.ok ? "سفر شروع شد؛ موقعیت شما برای صاحب بار زنده است" : r.error, r.ok ? "ok" : "err");
      }}><Play className="size-5" />شروع سفر و اشتراک موقعیت</Button>
    </Card>
  );
}

function DeliverForm({ v }: { v: FullView }) {
  const [inv, setInv] = useState<Captured>();
  const [items, setItems] = useState("");
  const [checks, setChecks] = useState<boolean[]>(CHECK.map(() => false));
  const pickup = v.media.find((m) => m.kind === "invoice_pickup")?.items;
  const n = num(items);
  const mismatch = pickup !== undefined && n !== undefined && pickup !== n;
  const ok = inv && n !== undefined && checks.every(Boolean);
  return (
    <Card className="animate-rise space-y-4 p-5">
      <h2 className="text-lg font-black">تحویل بار</h2>
      <div className="rounded-ui bg-brand-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-700"><ClipboardCheck className="size-4" />پیش از ثبت، این موارد را بررسی کنید</div>
        <ul className="space-y-2">
          {CHECK.map((c, i) => (
            <li key={c}><label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent-600)]" checked={checks[i]} onChange={() => setChecks((a) => a.map((x, j) => (j === i ? !x : x)))} />{c}
            </label></li>
          ))}
        </ul>
      </div>
      <FileDrop label="عکس فاکتور تحویل" hint="فاکتور باید فهرست اقلام داشته باشد" capture stamp value={inv?.dataUrl} fallback={v.dest} onChange={setInv} />
      <Field label="تعداد اقلام طبق فاکتور تحویل">{(id) => <Input id={id} inputMode="numeric" placeholder="مثلاً ۴۰" value={items} onChange={(e) => setItems(e.target.value)} />}</Field>
      {mismatch && (
        <p role="alert" className="flex animate-rise gap-2 rounded-ui bg-warn-bg p-3 text-sm leading-6 text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          تعداد اقلام با فاکتور مبدأ ({fa(pickup!)} قلم) نمی‌خواند. تحویل ثبت می‌شود ولی برای بررسی به پشتیبانی ارجاع می‌شود.
        </p>
      )}
      <Button block size="lg" disabled={!ok} onClick={() => {
        const r = deliver(v.id, toMedia(inv!, "invoice_delivery", n));
        toast(r.ok ? "تحویل بار ثبت شد. خسته نباشید" : r.error, r.ok ? "ok" : "err");
      }}>تحویل شد</Button>
    </Card>
  );
}

export default function Trip() {
  const id = useQueryId();
  const { s, me, ready } = useApp();
  const o = s.orders.find((x) => x.id === id && x.driverId === me?.id);
  if (!ready || id === null) return <AppShell area="driver"><Skeleton className="h-96" /></AppShell>;
  if (!o) return <AppShell area="driver"><EmptyState icon={<PackageX className="size-7" />} title="سفر پیدا نشد" body="این سفر به حساب شما تعلق ندارد یا لغو شده است." action={<ButtonLink href="/driver/trips/">سفرهای من</ButtonLink>} /></AppShell>;
  const v = fullView(o, s);
  const net = driverNet(v.price, s.config);

  return (
    <AppShell area="driver">
      <div className="mb-4 flex items-center justify-between"><BackLink href="/driver/trips/">سفرهای من</BackLink><StatusBadge status={v.status} /></div>
      <div className="space-y-4">
        <Card className="p-5"><OrderTimeline status={v.status} /></Card>
        {v.status === "IN_TRANSIT" && (
          <div className="flex items-center gap-2 rounded-ui bg-ok-bg px-4 py-3 text-sm font-bold text-ok"><Navigation className="size-4" />اشتراک موقعیت زنده فعال است</div>
        )}
        {(v.status === "IN_TRANSIT" || v.status === "DELIVERED") && <TrackingMap v={v} className="h-60 shadow-soft" />}
        {(v.status === "IN_TRANSIT" || v.status === "DELIVERED") && <TempPanel o={v} contact={v.shipper} />}

        <Card className="space-y-4 p-5">
          <RouteLine from={v.origin.city} to={v.dest.city} sub={[v.origin.address, v.dest.address]} />
          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><dt className="text-ink-3">نوع بار</dt><dd className="font-bold"><CargoLabel type={v.cargo} /></dd></div>
            <div><dt className="text-ink-3">دما</dt><dd className="mt-0.5"><TempChip min={v.tempMin} max={v.tempMax} /></dd></div>
            <div><dt className="text-ink-3">بارگیری</dt><dd className="font-bold">{jDateTime(v.pickupAt)}</dd></div>
            <div><dt className="text-ink-3">سهم شما</dt><dd className="font-black">{toman(net)}</dd></div>
            {v.note && <div className="col-span-2"><dt className="text-ink-3">توضیحات</dt><dd>{v.note}</dd></div>}
          </dl>
        </Card>

        <PartyCard title="صاحب بار" name={v.shipper.name} phone={v.shipper.phone} />
        {v.waybillNo && <WaybillLink id={v.id} no={v.waybillNo} />}
        {v.flag && <Card className="bg-warn-bg p-4 text-sm leading-7 text-warn shadow-none"><b>مغایرت فاکتور:</b> {v.flag.note}</Card>}

        {v.status === "ASSIGNED" && (
          <>
            <StartForm v={v} />
            <Button variant="ghost" className={cx("w-full text-danger")} onClick={() => { if (confirm("از این سفارش انصراف می‌دهید؟ سفارش دوباره برای دیگران باز می‌شود.")) { driverDrop(v.id); toast("از سفارش انصراف دادید", "info"); } }}><Undo2 className="size-4" />انصراف از سفارش</Button>
          </>
        )}
        {v.status === "IN_TRANSIT" && <DeliverForm v={v} />}
        <MediaGallery v={v} />
        {v.status === "DELIVERED" && (
          <>
            <Card className="bg-ok-bg p-4 text-center shadow-none"><div className="text-sm text-ok">این سفر با موفقیت تکمیل شد</div><div className="mt-1 text-2xl font-black text-ok">{toman(net)}</div></Card>
            <RatingBox v={v} meId={me!.id} ratings={s.ratings} toName={v.shipper.name} />
            <MismatchButton id={v.id} flagged={!!v.flag} />
          </>
        )}
        <Link href={`/support/?order=${v.id}`} className="block text-center text-sm font-bold text-accent-600">مشکلی پیش آمده؟ پشتیبانی</Link>
      </div>
    </AppShell>
  );
}
