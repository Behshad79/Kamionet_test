"use client";

import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { ProfileHero, ReviewItem } from "@/components/profile";
import { Badge, Card, EmptyState, Progress, Skeleton } from "@/components/ui";
import { person, shipperOf } from "@/lib/engine/core";
import { shipperStats } from "@/lib/engine/stats";
import { fa, jShort } from "@/lib/format";
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
      <ProfileHero name={sh.displayName} hue={sh.hue} verified={sh.businessVerified} rating={st.rating} ratingCount={st.ratingCount} headline={sh.company?.sector ? `صاحب بار · ${sh.company.sector}` : "صاحب بار"}
        badges={sh.businessVerified ? <Badge tone="ok"><BadgeCheck className="size-3.5" aria-hidden />کسب‌وکار تأییدشده</Badge> : undefined}
        stats={[{ label: "محموله", value: fa(st.shipments) }, { label: "بارگیری به‌موقع", value: `${fa(Math.round(st.onTimeLoading * 100))}٪` }, { label: "لغو", value: `${fa(Math.round(st.cancelRate * 100))}٪` }]} />
      <Card className="space-y-3 p-5"><h2 className="font-extrabold">ریز امتیازها</h2>{Object.entries(st.breakdown).map(([k, v]) => <div key={k} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 text-ink-3">{L[k] ?? k}</span><Progress value={(v / 5) * 100} /><span className="w-8 text-end font-bold tabular">{fa(Math.round(v * 10) / 10)}</span></div>)}</Card>
      <Card className="space-y-4 p-5"><h2 className="font-extrabold">نظر رانندگان</h2>{st.recent.length === 0 ? <p className="text-sm text-ink-3">هنوز نظری ثبت نشده است.</p> : st.recent.slice(0, 5).map((r) => <ReviewItem key={r.id} name={person(s, r.fromId)?.name ?? "راننده"} rating={r.overall} text={r.comment} at={jShort(r.at)} hue={(r.fromId.length * 47) % 360} />)}</Card>
    </div>
  );
}
