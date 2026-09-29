"use client";

import { Check, FileText, Flag, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fa, jDateTime, relative } from "@/lib/format";
import { lerp } from "@/lib/geo";
import { useNow } from "@/lib/hooks";
import { rate, reportMismatch } from "@/lib/store";
import type { FullView, Rating } from "@/lib/types";
import { MapView } from "./MapView";
import { toast } from "./Toaster";
import { Badge, Button, Card, Modal, Stars, Textarea, cx } from "./ui";

import { DEMO_TRIP_MS } from "@/lib/telemetry";

const STEPS = [
  { key: "OPEN", label: "ثبت سفارش" },
  { key: "ASSIGNED", label: "تعیین راننده" },
  { key: "IN_TRANSIT", label: "در مسیر" },
  { key: "DELIVERED", label: "تحویل" },
];
const ORDER_IDX: Record<string, number> = { DRAFT: 0, OPEN: 0, LOCKED: 0, ASSIGNED: 1, IN_TRANSIT: 2, DELIVERED: 3 };

export function OrderTimeline({ status }: { status: string }) {
  const idx = ORDER_IDX[status] ?? 0;
  const dead = status === "CANCELLED" || status === "EXPIRED";
  return (
    <ol className="flex items-start" aria-label="وضعیت سفارش">
      {STEPS.map((s, i) => {
        const done = !dead && i < idx;
        const on = !dead && i === idx;
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span className={cx("h-0.5 flex-1", i === 0 ? "opacity-0" : done || on ? "bg-ok" : "bg-line")} />
              <span className={cx("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                done || (on && status === "DELIVERED") ? "bg-ok text-white" : on ? "bg-brand-500 text-ink ring-4 ring-brand-100" : "bg-surface-3 text-ink-3")}>
                {done || (on && status === "DELIVERED") ? <Check className="size-4" /> : fa(i + 1)}
              </span>
              <span className={cx("h-0.5 flex-1", i === STEPS.length - 1 ? "opacity-0" : done ? "bg-ok" : "bg-line")} />
            </div>
            <span className={cx("text-xs", on ? "font-bold" : "text-ink-3")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Truck position is derived from time since trip start (simulated GPS feed). */
export function tripProgress(startedAt: number | undefined, now: number, status: string) {
  if (status === "DELIVERED") return 1;
  if (!startedAt) return 0;
  return Math.min(0.97, Math.max(0, (now - startedAt) / DEMO_TRIP_MS));
}

export function TrackingMap({ v, className }: { v: FullView; className?: string }) {
  const now = useNow(1000);
  const p = tripProgress(v.startedAt, now, v.status);
  const pos = lerp(v.origin, v.dest, p);
  const live = v.status === "IN_TRANSIT";
  const markers = useMemo(
    () => [
      { id: "o", lat: v.origin.lat, lng: v.origin.lng, kind: "origin" as const },
      { id: "d", lat: v.dest.lat, lng: v.dest.lng, kind: "dest" as const },
      ...(live || v.status === "DELIVERED" ? [{ id: "t", lat: pos.lat, lng: pos.lng, kind: "truck" as const }] : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v.origin, v.dest, live, v.status, Math.round(p * 200)],
  );
  const lines = useMemo(() => [{ id: "r", points: [[v.origin.lat, v.origin.lng], [v.dest.lat, v.dest.lng]] as [number, number][], dashed: true }], [v.origin, v.dest]);
  return (
    <div className={cx("relative overflow-hidden rounded-ui", className)}>
      <MapView markers={markers} lines={lines} fitKey={v.id} className="size-full" />
      {live && (
        <div className="absolute end-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-soft">
          <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-70" /><span className="relative inline-flex size-2.5 rounded-full bg-danger" /></span>
          زنده · {fa(Math.round(p * 100))}٪ مسیر
        </div>
      )}
    </div>
  );
}

export function PartyCard({ title, name, phone, extra }: { title: string; name: string; phone: string; extra?: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-11 place-items-center rounded-full bg-accent-50 font-black text-accent-700">{name.slice(0, 1)}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-3">{title}</div>
        <div className="truncate font-bold">{name}</div>
        {extra && <div className="text-xs text-ink-3">{extra}</div>}
      </div>
      <a href={`tel:${phone}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-ok-bg px-4 text-sm font-bold text-ok" dir="ltr"><Phone className="size-4" />{phone.replace(/\d/g, (d) => fa(+d)).replace(/٬/g, "")}</a>
    </Card>
  );
}

export function MediaGallery({ v }: { v: FullView }) {
  if (!v.media.length) return null;
  const L = { cargo: "عکس بار", invoice_pickup: "فاکتور مبدأ", invoice_delivery: "فاکتور تحویل" } as const;
  return (
    <Card className="space-y-3 p-4">
      <h3 className="font-bold">مستندات ثبت‌شده</h3>
      <div className="grid grid-cols-3 gap-2">
        {v.media.map((m, i) => (
          <figure key={i} className="overflow-hidden rounded-ui bg-surface-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.dataUrl} alt={L[m.kind]} className="aspect-square w-full object-cover" />
            <figcaption className="px-2 py-1.5 text-[11px] leading-5"><b>{L[m.kind]}</b>{m.items !== undefined && ` · ${fa(m.items)} قلم`}<br /><span className="text-ink-3">{jDateTime(m.takenAt)}</span></figcaption>
          </figure>
        ))}
      </div>
    </Card>
  );
}

export function WaybillLink({ id, no }: { id: string; no?: string }) {
  return (
    <Link href={`/waybill/?id=${id}`} className="flex items-center gap-3 rounded-ui bg-white p-4 shadow-soft transition hover:shadow-lift">
      <span className="grid size-11 place-items-center rounded-ui bg-brand-50 text-brand-700"><FileText className="size-5" /></span>
      <div className="flex-1"><div className="font-bold">بارنامه‌ی سفارش</div><div className="text-xs text-ink-3">شماره {no} · مشاهده و دانلود PDF</div></div>
    </Link>
  );
}

export function RatingBox({ v, meId, ratings, toName }: { v: FullView; meId: string; ratings: Rating[]; toName: string }) {
  const mine = ratings.find((r) => r.orderId === v.id && r.from === meId);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  if (mine)
    return (
      <Card className="flex items-center justify-between p-4">
        <div><div className="font-bold">امتیاز شما به {toName}</div>{mine.comment && <p className="text-sm text-ink-3">{mine.comment}</p>}</div>
        <Stars value={mine.stars} size={22} />
      </Card>
    );
  return (
    <Card className="space-y-3 p-4">
      <h3 className="font-bold">به {toName} امتیاز بدهید</h3>
      <Stars value={stars} onChange={setStars} />
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تجربه‌ی خود را بنویسید (اختیاری)" />
      <Button disabled={!stars} onClick={() => { const r = rate(v.id, stars, comment); toast(r.ok ? "ممنون از بازخورد شما" : r.error, r.ok ? "ok" : "err"); }}>ثبت امتیاز</Button>
    </Card>
  );
}

export function MismatchButton({ id, flagged }: { id: string; flagged: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (flagged) return <Badge tone="warn"><Flag className="size-3.5" />مغایرت فاکتور در دست بررسی پشتیبانی</Badge>;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Flag className="size-4" />گزارش مغایرت فاکتور</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="گزارش مغایرت اقلام">
        <p className="mb-3 text-sm leading-7 text-ink-3">اگر تعداد یا نوع اقلام تحویل‌شده با فاکتور مبدأ نمی‌خواند، توضیح دهید تا تیم پشتیبانی بررسی کند.</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً ۳ کارتن کمتر تحویل شد" />
        <Button className="mt-4" block disabled={note.trim().length < 5} onClick={() => { reportMismatch(id, note.trim()); setOpen(false); toast("گزارش شما برای پشتیبانی ارسال شد"); }}>ارسال گزارش</Button>
      </Modal>
    </>
  );
}

export { relative };
