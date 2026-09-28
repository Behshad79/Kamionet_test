"use client";

import { LifeBuoy, Send } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea, cx } from "@/components/ui";
import { hhmm, jShort } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { addTicketMsg, createTicket } from "@/lib/store";

function Support() {
  const { s, me, role } = useApp();
  const mine = s.tickets.filter((t) => t.userId === me?.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [orderId, setOrderId] = useState<string>();

  useEffect(() => {
    const o = new URLSearchParams(window.location.search).get("order");
    if (o) { setOrderId(o); setCreating(true); }
  }, []);

  const t = mine.find((x) => x.id === openId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-black">پشتیبانی</h1><p className="mt-1 text-sm text-ink-3">معمولاً کمتر از یک ساعت پاسخ می‌دهیم.</p></div>
        {!creating && !t && <Button onClick={() => setCreating(true)}>تیکت جدید</Button>}
      </div>

      {creating && (
        <Card className="animate-rise space-y-4 p-5">
          <Field label="موضوع">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={orderId ? "مشکل در این سفارش" : "مثلاً مشکل در پرداخت"} />}</Field>
          <Field label="شرح مشکل">{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
          {orderId && <Badge tone="info">مرتبط با یک سفارش</Badge>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>انصراف</Button>
            <Button disabled={subject.trim().length < 3 || text.trim().length < 5} onClick={() => { createTicket(subject.trim(), text.trim(), orderId); setCreating(false); setSubject(""); setText(""); toast("تیکت ثبت شد"); }}>ارسال</Button>
          </div>
        </Card>
      )}

      {t ? (
        <Card className="animate-rise overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-4">
            <div><div className="font-bold">{t.subject}</div><Badge tone={t.status === "open" ? "warn" : "ok"} className="mt-1">{t.status === "open" ? "باز" : "بسته"}</Badge></div>
            <button className="text-sm font-bold text-accent-600" onClick={() => setOpenId(null)}>بازگشت</button>
          </div>
          <div className="space-y-3 bg-surface-2 p-4">
            {t.messages.map((m, i) => (
              <div key={i} className={cx("flex", m.from === "user" ? "justify-start" : "justify-end")}>
                <div className={cx("max-w-[80%] rounded-ui px-4 py-2.5 text-sm leading-7", m.from === "user" ? "bg-brand-100" : "bg-white shadow-soft")}>
                  {m.text}<div className="mt-1 text-[11px] text-ink-3">{m.from === "admin" ? "پشتیبانی · " : ""}{jShort(m.at)}، {hhmm(m.at)}</div>
                </div>
              </div>
            ))}
          </div>
          {t.status === "open" && (
            <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) { addTicketMsg(t.id, reply.trim(), "user"); setReply(""); } }}>
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پیام شما…" />
              <Button aria-label="ارسال"><Send className="size-4 rotate-180" /></Button>
            </form>
          )}
        </Card>
      ) : !creating && (mine.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="size-7" />} title="تیکتی ندارید" body={`اگر درباره‌ی سفارش یا حساب ${role === "driver" ? "راننده" : "صاحب بار"} سؤالی دارید، تیکت بسازید.`} action={<Button onClick={() => setCreating(true)}>ساخت تیکت</Button>} />
      ) : (
        <div className="space-y-2">
          {mine.map((x) => (
            <button key={x.id} onClick={() => setOpenId(x.id)} className="flex w-full items-center justify-between rounded-ui bg-white p-4 text-start shadow-soft transition hover:shadow-lift">
              <div><div className="font-bold">{x.subject}</div><div className="text-sm text-ink-3 line-clamp-1">{x.messages[x.messages.length - 1].text}</div></div>
              <Badge tone={x.status === "open" ? "warn" : "ok"}>{x.status === "open" ? "باز" : "بسته"}</Badge>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SupportPage() {
  return <AppShell area={undefined}><Suspense><SupportGuard /></Suspense></AppShell>;
}

function SupportGuard() {
  const { me, ready } = useApp();
  if (ready && !me) return <p className="py-20 text-center text-ink-3">برای استفاده از پشتیبانی ابتدا <Link className="font-bold text-accent-600" href="/login/">وارد شوید</Link>.</p>;
  return <Support />;
}
