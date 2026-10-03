"use client";

import { MessageSquareText, BellRing } from "lucide-react";
import { useState } from "react";
import { enablePush, pushSupported } from "@/lib/usePush";
import { Tabs } from "./ui";
import { toast } from "./Toaster";
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
  const [tab, setTab] = useState<"inapp" | "sms">("inapp");
  const sms = s.sms.filter((m) => m.personId === me?.id).slice(0, 40);
  const [perm, setPerm] = useState(() => (pushSupported() ? Notification.permission : "unsupported"));
  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "inapp", label: "اعلان‌ها", count: unread }, { id: "sms", label: "پیامک‌ها", count: sms.length }]} />
      {perm !== "granted" && perm !== "unsupported" && tab === "inapp" && <Card className="flex flex-wrap items-center justify-between gap-3 border border-accent-600/20 bg-accent-50 p-4"><span className="flex items-center gap-2 text-sm font-bold text-accent-700"><BellRing className="size-5" aria-hidden />اعلان‌های لحظه‌ای را فعال کنید تا وضعیت سفارش و کارهای لازم را بلافاصله ببینید.</span><Button size="sm" onClick={async () => { const r = await enablePush(); setPerm(r === "unsupported" ? "unsupported" : r); toast(r === "granted" ? "اعلان‌ها فعال شد." : "اجازه‌ی اعلان داده نشد.", r === "granted" ? "ok" : "info"); }}>فعال‌سازی</Button></Card>}
      {tab === "sms" ? (
        <div className="space-y-3"><p className="text-xs leading-6 text-ink-3">نمونه‌ی پیامک‌هایی که برای رویدادهای مهم به شماره‌ی شما ارسال می‌شود (نمایشی؛ در نسخه‌ی عملیاتی از طریق سرویس پیامک ارسال می‌شود).</p>
          {sms.length === 0 ? <EmptyState icon={<MessageSquareText className="size-8" />} title="پیامکی ارسال نشده" /> : sms.map((m) => <div key={m.id} className="max-w-[92%] rounded-2xl rounded-ss-md bg-white p-3 shadow-soft"><div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-bold text-ink-3"><span>KAMIONET</span><span dir="ltr">{m.to}</span></div><p className="text-sm leading-7">{m.text}</p><div className="mt-1 text-[11px] text-ink-4">{jDateTime(m.at)}</div></div>)}</div>
      ) : (<>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-black">اعلان‌ها</h1>{unread > 0 && <Button size="sm" variant="secondary" onClick={() => act((x) => x.notifications.forEach((n) => { if (n.personId === me?.id && n.portal === portal) n.read = true; }))}><CheckCheck className="size-4" aria-hidden />همه خوانده شد</Button>}</div>
      {list.length === 0 ? <EmptyState icon={<BellOff className="size-8" />} title="اعلانی ندارید" body="رویدادهای مهم سفارش و پرداخت اینجا نمایش داده می‌شود." /> : (
        <Card className="divide-y divide-line">{list.map((n) => {
          const body = <><span className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-act"}`} aria-hidden /><span className="min-w-0 flex-1"><span className={`block text-sm leading-7 ${n.read ? "text-ink-2" : "font-bold"}`}>{n.text}</span><span className="text-xs text-ink-3">{jDateTime(n.at)}</span></span></>;
          const mark = () => act((x) => { const q = x.notifications.find((m) => m.id === n.id); if (q) q.read = true; });
          return n.href ? <Link key={n.id} href={n.href} onClick={mark} className="flex min-h-14 gap-3 p-4">{body}</Link> : <button key={n.id} onClick={mark} className="flex min-h-14 w-full gap-3 p-4 text-start">{body}</button>;
        })}</Card>
      )}
      </>)}
    </div>
  );
}
