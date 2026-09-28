"use client";

import { Printer, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Skeleton } from "@/components/ui";
import { CARGO, degrees, fa, jDate, jDateTime, toman } from "@/lib/format";
import { useApp, useQueryId } from "@/lib/hooks";
import { isFull, viewOrder } from "@/lib/mask";

/** Print-optimised page: "Save as PDF" from the browser print dialog. */
export default function Waybill() {
  const id = useQueryId();
  const { s, ready } = useApp();
  const o = s.orders.find((x) => x.id === id);
  if (!ready || id === null) return <AppShell><Skeleton className="h-96" /></AppShell>;
  const v = o ? viewOrder(o, s) : undefined;
  if (!v || !isFull(v) || !v.waybillNo) return <AppShell><p className="py-20 text-center text-ink-3">بارنامه‌ای برای نمایش وجود ندارد یا دسترسی ندارید.</p></AppShell>;

  const Row = ({ k, val }: { k: string; val: string }) => (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 text-sm"><dt className="text-ink-3">{k}</dt><dd className="font-bold">{val}</dd></div>
  );
  return (
    <AppShell>
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()}><Printer className="size-4" />دانلود PDF / چاپ</Button></div>
      <article className="mx-auto max-w-2xl rounded-ui bg-white p-8 shadow-soft print:shadow-none">
        <header className="flex items-center justify-between border-b-2 border-ink pb-5">
          <div className="flex items-center gap-2 text-xl font-black"><span className="grid size-10 place-items-center rounded-ui bg-brand-500"><Truck className="size-5" /></span>کامیونت</div>
          <div className="text-end"><div className="text-lg font-black">بارنامه‌ی حمل</div><div className="text-sm text-ink-3 tabular">شماره {v.waybillNo}</div></div>
        </header>
        <div className="mt-5 grid gap-x-8 sm:grid-cols-2">
          <dl>
            <h2 className="mb-1 mt-2 font-black">فرستنده (صاحب بار)</h2>
            <Row k="نام" val={v.shipper.name} /><Row k="تلفن" val={v.shipper.phone.replace(/\d/g, (d) => fa(+d))} /><Row k="مبدأ" val={`${v.origin.city}، ${v.origin.address}`} />
          </dl>
          <dl>
            <h2 className="mb-1 mt-2 font-black">راننده</h2>
            <Row k="نام" val={v.driver?.name ?? "—"} /><Row k="تلفن" val={(v.driver?.phone ?? "").replace(/\d/g, (d) => fa(+d))} /><Row k="پلاک" val={v.driver?.plate ?? "—"} />
          </dl>
        </div>
        <dl className="mt-3">
          <h2 className="mb-1 mt-2 font-black">مشخصات محموله و مسیر</h2>
          <Row k="مقصد" val={`${v.dest.city}، ${v.dest.address}`} />
          <Row k="نوع بار" val={CARGO[v.cargo].label} />
          <Row k="حداکثر دمای مجاز" val={degrees(v.tempMax)} />
          <Row k="مسافت" val={`${fa(v.distanceKm)} کیلومتر`} />
          <Row k="زمان بارگیری" val={`${jDate(v.pickupAt)}، ${jDateTime(v.pickupAt).split("،")[1]}`} />
          <Row k="کرایه‌ی توافقی" val={toman(v.price)} />
          <Row k="بیمه‌ی بار" val={v.insurance ? "دارد" : "ندارد"} />
        </dl>
        <footer className="mt-8 grid grid-cols-2 gap-8 text-center text-sm text-ink-3">
          <div className="border-t border-line pt-2">امضای فرستنده</div><div className="border-t border-line pt-2">امضای راننده</div>
        </footer>
        <p className="mt-6 rounded-ui bg-surface-2 p-3 text-xs leading-6 text-ink-3">این سند، بارنامه‌ی پلتفرمی کامیونت و مستند توافق دو طرف است. صدور بارنامه‌ی رسمی در سامانه‌ی ملی حمل‌ونقل بر عهده‌ی راننده و صاحب بار است.</p>
      </article>
    </AppShell>
  );
}
