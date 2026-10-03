"use client";

import { ArrowRight, CircleCheck, Headset, LifeBuoy, Phone, Send, Star } from "lucide-react";
import { cv } from "@/lib/config";
import { person } from "@/lib/engine/core";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES, CHANNELS, openTicket, rateTicket, replyTicket } from "@/lib/engine/trust";
import { fa, jDateTime } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";
import type { Ticket, TicketChannel } from "@/lib/types";
import { toast } from "./Toaster";
import { Badge, Button, Field, Input, Select, Sheet, Stars, Tabs, Textarea, cx } from "./ui";

const ST: Record<Ticket["status"], [string, "ok" | "warn" | "info" | "neutral"]> = { OPEN: ["باز", "warn"], PENDING: ["پاسخ داده شد", "info"], ESCALATED: ["ارجاع‌شده", "warn"], RESOLVED: ["حل‌شده", "ok"], CLOSED: ["بسته", "neutral"] };

/** Floating, context-aware support: opens on the right channel for the screen the user is on and attaches the current order. */
export function SupportWidget({ portal }: { portal: "shipper" | "driver" }) {
  const { s, me } = usePortal(portal);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"new" | "list">("new");
  const [ch, setCh] = useState<TicketChannel>("trip");
  const [cat, setCat] = useState("");
  const [text, setText] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [orderId, setOrderId] = useState<string | undefined>();
  useEffect(() => {
    if (!open) return;
    setOrderId(new URLSearchParams(window.location.search).get("id") ?? undefined);
    setCh(path.includes("wallet") ? "finance" : path.includes("profile") || path.includes("kyc") ? "account" : "trip");
  }, [open, path]);
  useEffect(() => setCat(CATEGORIES[ch][0]), [ch]);
  if (!me) return null;
  const mine = s.tickets.filter((t) => t.personId === me.id).sort((a, b) => b.at - a.at);
  const t = sel ? mine.find((x) => x.id === sel) : undefined;
  const order = orderId ? s.orders.find((o) => o.id === orderId) : undefined;
  const open_ = mine.filter((x) => !["RESOLVED", "CLOSED"].includes(x.status)).length;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={open_ ? `پشتیبانی، ${open_} گفتگوی باز` : "پشتیبانی"} className="fixed bottom-[92px] end-3 z-40 grid size-12 place-items-center rounded-full bg-accent-600 text-white shadow-lift transition hover:scale-105 lg:bottom-6 lg:end-6">
        <Headset className="size-5" aria-hidden />{open_ > 0 && <span className="absolute -end-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-black ring-2 ring-white">{fa(open_)}</span>}
      </button>
      <Sheet open={open} onClose={() => { setOpen(false); setSel(null); }} title={t ? t.subject : "پشتیبانی"} wide>
        {t ? (
          <div className="space-y-4">
            <button onClick={() => setSel(null)} className="inline-flex h-11 items-center gap-1 text-sm font-bold text-accent-600"><ArrowRight className="size-4" aria-hidden />همه‌ی گفتگوها</button>
            <div className="flex flex-wrap items-center gap-2"><Badge tone={ST[t.status][1]}>{ST[t.status][0]}</Badge><span className="text-xs text-ink-3">{CHANNELS[t.channel].label} · {t.category}</span></div>
            <div className="space-y-2">{t.messages.map((m, i) => <div key={i} className={cx("max-w-[88%] rounded-2xl p-3 text-sm leading-7", m.from === "user" ? "ms-auto bg-act-soft" : m.from === "agent" ? "bg-white shadow-soft" : "bg-surface-2 text-ink-3")}>{m.from === "agent" && <div className="text-xs font-bold text-accent-700">{m.by ?? "پشتیبانی"}</div>}{m.text}<div className="mt-1 text-[11px] text-ink-4">{jDateTime(m.at)}</div></div>)}</div>
            {t.status === "RESOLVED" && !t.csat && <div className="space-y-2 rounded-ui bg-surface-2 p-4 text-center"><div className="text-sm font-bold">از پشتیبانی راضی بودید؟</div><div className="flex justify-center"><Stars value={0} size={30} onChange={(n) => { act((x) => rateTicket(x, t.id, n)); toast("سپاس از بازخورد شما."); }} /></div></div>}
            {t.csat && <p className="flex items-center gap-1 text-sm text-ok"><Star className="size-4 fill-current" aria-hidden />امتیاز شما: {fa(t.csat)} از ۵</p>}
            {t.status !== "CLOSED" && <div className="flex gap-2"><Input aria-label="پیام" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پیام شما…" /><Button aria-label="ارسال" disabled={!reply.trim()} onClick={() => { act((x) => replyTicket(x, t.id, "user", reply)); setReply(""); }}><Send className="size-4" /></Button></div>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-2xl bg-gradient-to-br from-accent-50 to-white p-4 ring-1 ring-accent-600/10">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-accent-600 text-white"><Phone className="size-5" aria-hidden /></span><div><div className="font-extrabold">تماس مستقیم با پشتیبانی</div><div className="text-xs text-ink-3">ساعات پاسخ‌گویی: {cv<string>(s, "support.hours")} · هر روز</div></div></div>
              <div className="grid grid-cols-2 gap-2"><a href={`tel:${cv<string>(s, "support.phone").replace(/[^0-9۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))}`} className="flex h-12 items-center justify-center gap-2 rounded-ui bg-accent-600 font-black text-white"><Phone className="size-4" aria-hidden /><span dir="ltr" className="tabular">{cv<string>(s, "support.phone")}</span></a>
                <Button variant="secondary" onClick={() => { const r = act((x) => openTicket(x, me.id, portal, { channel: "trip", category: "سایر", subject: "درخواست تماس تلفنی", text: `لطفاً با شماره‌ی ${person(x, me.id)?.phone} تماس بگیرید.` })); toast(r.ok ? "درخواست تماس ثبت شد؛ همکاران ما تماس می‌گیرند." : r.error, r.ok ? "ok" : "err"); }}>درخواست تماس از طرف ما</Button></div>
            </div>
            <Tabs value={view} onChange={setView} tabs={[{ id: "new", label: "درخواست جدید" }, { id: "list", label: "گفتگوهای من", count: mine.length }]} />
            {view === "new" ? (
              <div className="space-y-4">
                <div role="radiogroup" aria-label="کانال پشتیبانی" className="grid gap-2">
                  {(Object.keys(CHANNELS) as TicketChannel[]).map((k) => <button key={k} role="radio" aria-checked={ch === k} onClick={() => setCh(k)} className={cx("rounded-ui border-2 p-3 text-start", ch === k ? "border-act bg-act-soft" : "border-line bg-white")}><div className="font-extrabold">{CHANNELS[k].label}</div><div className="text-xs text-ink-3">{CHANNELS[k].hint}</div></button>)}
                </div>
                {order && ch === "trip" && <p className="flex items-center gap-2 rounded-ui bg-accent-50 p-3 text-sm font-medium text-accent-700"><LifeBuoy className="size-4" aria-hidden />سفارش {order.origin.city} ← {order.dest.city} به این درخواست پیوست می‌شود.</p>}
                <Field label="موضوع">{(id) => <Select id={id} value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES[ch].map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
                <Field label="شرح مشکل">{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
                <Button block size="lg" disabled={text.trim().length < 5} onClick={() => { const r = act((x) => openTicket(x, me.id, portal, { channel: ch, category: cat, subject: cat, text, orderId: ch === "trip" ? orderId : undefined })); if (r.ok) { toast("درخواست ثبت شد."); setText(""); setView("list"); setSel(r.id); } else toast(r.error, "err"); }}>ثبت درخواست</Button>
              </div>
            ) : mine.length === 0 ? <p className="py-8 text-center text-sm text-ink-3">هنوز گفتگویی ندارید.</p> : (
              <ul className="divide-y divide-line rounded-ui bg-white shadow-soft">{mine.map((x) => <li key={x.id}><button onClick={() => setSel(x.id)} className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-start"><span className="min-w-0"><span className="block truncate font-bold">{x.subject}</span><span className="text-xs text-ink-3">{CHANNELS[x.channel].label} · {jDateTime(x.at)}</span></span><Badge tone={ST[x.status][1]}>{ST[x.status][0]}</Badge></button></li>)}</ul>
            )}
          </div>
        )}
      </Sheet>
      <span className="sr-only"><CircleCheck /></span>
    </>
  );
}
