"use client";

import { BellOff, CheckCheck } from "lucide-react";
import Link from "next/link";
import { jDateTime } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";
import type { PortalId } from "@/lib/types";
import { Button, Card, EmptyState } from "./ui";

export function NotificationsList({ portal }: { portal: "shipper" | "driver" }) {
  const { s, me } = usePortal(portal as PortalId);
  const list = s.notifications.filter((n) => n.personId === me?.id && n.portal === portal).sort((a, b) => b.at - a.at).slice(0, 80);
  const unread = list.filter((n) => !n.read).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-black">اعلان‌ها</h1>{unread > 0 && <Button size="sm" variant="secondary" onClick={() => act((x) => x.notifications.forEach((n) => { if (n.personId === me?.id && n.portal === portal) n.read = true; }))}><CheckCheck className="size-4" aria-hidden />همه خوانده شد</Button>}</div>
      {list.length === 0 ? <EmptyState icon={<BellOff className="size-8" />} title="اعلانی ندارید" body="رویدادهای مهم سفارش و پرداخت اینجا نمایش داده می‌شود." /> : (
        <Card className="divide-y divide-line">{list.map((n) => {
          const body = <><span className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-act"}`} aria-hidden /><span className="min-w-0 flex-1"><span className={`block text-sm leading-7 ${n.read ? "text-ink-2" : "font-bold"}`}>{n.text}</span><span className="text-xs text-ink-3">{jDateTime(n.at)}</span></span></>;
          const mark = () => act((x) => { const q = x.notifications.find((m) => m.id === n.id); if (q) q.read = true; });
          return n.href ? <Link key={n.id} href={n.href} onClick={mark} className="flex min-h-14 gap-3 p-4">{body}</Link> : <button key={n.id} onClick={mark} className="flex min-h-14 w-full gap-3 p-4 text-start">{body}</button>;
        })}</Card>
      )}
    </div>
  );
}
