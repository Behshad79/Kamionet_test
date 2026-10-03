"use client";

import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { RatingPill } from "@/components/molecules";
import { Badge, Card, EmptyState, Progress, Skeleton } from "@/components/ui";
import { shipperOf } from "@/lib/engine/core";
import { shipperStats } from "@/lib/engine/stats";
import { fa } from "@/lib/format";
import { useQueryId, usePortal } from "@/lib/hooks";

const L: Record<string, string> = { honesty: "اظهار صادقانه‌ی بار", loading: "سرعت بارگیری", behavior: "رفتار", payment: "پرداخت" };

/** Public company profile as drivers see it: no phone, no address. */
export default function Page() {
  const id = useQueryId();
  const { s, ready } = usePortal("driver");
  if (id === undefined || !ready) return <Skeleton className="h-64" />;
  const sh = id ? shipperOf(s, id) : undefined;
  if (!sh || !id) return <EmptyState icon={<BadgeCheck className="size-8" />} title="پروفایل پیدا نشد" action={<Link href="/driver/" className="font-bold text-accent-600">بازگشت</Link>} />;
  const st = shipperStats(s, id);
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5"><div className="flex items-center gap-2 text-xl font-black">{sh.displayName}{sh.businessVerified && <Badge tone="ok"><BadgeCheck className="size-3.5" aria-hidden />کسب‌وکار تأییدشده</Badge>}</div>
        {sh.company?.sector && <p className="text-sm text-ink-3">حوزه‌ی فعالیت: {sh.company.sector}</p>}<RatingPill r={{ avg: st.rating, count: st.ratingCount }} />
        <dl className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">محموله</dt><dd className="font-black">{fa(st.shipments)}</dd></div><div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">بارگیری به‌موقع</dt><dd className="font-black">{fa(Math.round(st.onTimeLoading * 100))}٪</dd></div><div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">لغو</dt><dd className="font-black">{fa(Math.round(st.cancelRate * 100))}٪</dd></div></dl></Card>
      <Card className="space-y-3 p-4"><h2 className="font-extrabold">ریز امتیازها</h2>{Object.entries(st.breakdown).map(([k, v]) => <div key={k} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 text-ink-3">{L[k] ?? k}</span><Progress value={(v / 5) * 100} /><span className="w-8 text-end font-bold tabular">{fa(Math.round(v * 10) / 10)}</span></div>)}</Card>
      {st.recent.length > 0 && <Card className="space-y-3 p-4"><h2 className="font-extrabold">نظر رانندگان</h2>{st.recent.slice(0, 5).map((r) => <div key={r.id} className="border-t border-line pt-3 first:border-0 first:pt-0"><RatingPill r={{ avg: r.overall, count: 0 }} /><p className="mt-1 text-sm">{r.comment || "—"}</p></div>)}</Card>}
    </div>
  );
}
