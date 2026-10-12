"use client";

import { MessageCircle, Phone, Send, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "../Toaster";
import { Badge, Button, Card, Field, Select, Sheet, Textarea } from "../ui";
import { COMPLAINT_CATEGORIES, commsWritable, escalateComplaint, fileComplaint, markChatRead, replyComplaint, resolveComplaint, sendChat, startCall, unreadCount } from "@/lib/engine/comms";
import { person } from "@/lib/engine/core";
import { hhmm, jShort } from "@/lib/format";
import { act, useStore } from "@/lib/store";
import type { Complaint, Order } from "@/lib/types";

const ST: Record<Complaint["status"], [string, "warn" | "info" | "ok" | "danger"]> = { OPEN: ["در انتظار پاسخ", "warn"], ANSWERED: ["پاسخ داده شد", "info"], RESOLVED: ["حل‌شده", "ok"], ESCALATED: ["ارجاع به پشتیبانی", "danger"] };

/**
 * Chat + in-app call + complaints between the shipper and the confirmed driver of one order.
 * Opens when the driver confirms (numbers stay hidden until the deposit), read-only after a short grace period once delivered.
 */
export function OrderComms({ o, meId }: { o: Order; meId: string }) {
  const s = useStore();
  const [text, setText] = useState("");
  const [cOpen, setCOpen] = useState(false);
  const chat = s.chats.find((c) => c.orderId === o.id);
  const writable = commsWritable(s, o);
  const role = meId === o.shipperId ? "shipper" : "driver";
  const peer = person(s, role === "shipper" ? o.driverId : o.shipperId);
  const bottom = useRef<HTMLDivElement>(null);
  const unread = unreadCount(s, meId, o.id);
  const msgs = chat?.messages.length ?? 0;
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); if (unread) act((x) => markChatRead(x, meId, o.id)); }, [msgs, unread, meId, o.id]);
  const complaints = s.complaints.filter((c) => c.orderId === o.id && (c.byId === meId || c.againstId === meId));
  if (!o.driverId && !chat) return null;
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-extrabold"><MessageCircle className="size-5 text-act" aria-hidden />گفتگو با {peer?.name ?? "طرف مقابل"}</h2>{writable ? <Badge tone="ok" dot>فعال</Badge> : <Badge>بسته‌شده</Badge>}</div>
      <div className="max-h-64 min-h-24 space-y-2 overflow-y-auto rounded-ui bg-surface-2 p-3" role="log" aria-label="پیام‌ها">
        {msgs === 0 && <p className="py-4 text-center text-sm text-ink-3">هنوز پیامی نیست. برای هماهنگی بارگیری و رسیدن، همین‌جا پیام بدهید.</p>}
        {chat?.messages.map((m) => <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-7 ${m.from === meId ? "ms-auto bg-act text-white" : "bg-white shadow-soft"}`}>{m.text}<div className={`mt-0.5 text-[10px] ${m.from === meId ? "text-white/70" : "text-ink-4"}`}>{jShort(m.at)}، {hhmm(m.at)}</div></div>)}
        <div ref={bottom} />
      </div>
      {writable ? (
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const r = act((x) => sendChat(x, meId, o.id, text)); if (r.ok) setText(""); else toast(r.error, "err"); }}>
          <label className="min-w-0 flex-1"><span className="sr-only">پیام شما</span><textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="پیام شما…" className="min-h-12 w-full resize-none rounded-ui border border-line bg-white px-4 py-3 text-[15px] focus:border-accent-600 focus:outline-none focus:ring-4 focus:ring-accent-600/15" /></label>
          <Button type="submit" aria-label="ارسال پیام" disabled={!text.trim()}><Send className="size-4" aria-hidden /></Button>
        </form>
      ) : <p className="text-xs text-ink-3">گفتگو پس از تحویل بسته می‌شود؛ تاریخچه فقط برای شما و پشتیبانی کامیونت قابل مشاهده است.</p>}
      <div className="flex flex-wrap gap-2">
        {writable && <Button variant="secondary" size="sm" onClick={() => { const r = act((x) => startCall(x, meId, o.id)); if (!r.ok) toast(r.error, "err"); }}><Phone className="size-4" aria-hidden />تماس درون‌برنامه‌ای</Button>}
        <Button variant="secondary" size="sm" onClick={() => setCOpen(true)}><ShieldAlert className="size-4" aria-hidden />ثبت شکایت / مشکل</Button>
      </div>
      <p className="text-[11px] leading-6 text-ink-4">گفتگو و تماس‌های این سفارش برای کیفیت و رسیدگی به شکایت‌ها ثبت می‌شود و شماره‌ی شما در تماس درون‌برنامه‌ای نمایش داده نمی‌شود.</p>

      {complaints.map((c) => <ComplaintCard key={c.id} c={c} meId={meId} />)}
      <ComplaintSheet open={cOpen} onClose={() => setCOpen(false)} o={o} role={role} meId={meId} />
    </Card>
  );
}

function ComplaintCard({ c, meId }: { c: Complaint; meId: string }) {
  const s = useStore();
  const [t, setT] = useState("");
  const mine = c.byId === meId;
  return (
    <div className="space-y-2 rounded-ui border-2 border-warn/30 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{mine ? "شکایت شما" : "شکایت از شما"}: {c.category}</b><Badge tone={ST[c.status][1]}>{ST[c.status][0]}</Badge></div>
      <ul className="space-y-1.5">{c.messages.map((m, i) => <li key={i} className={`rounded-xl p-2 text-sm leading-7 ${m.from === "staff" ? "bg-accent-50" : m.from === meId ? "bg-act-soft" : "bg-surface-2"}`}><b className="text-xs text-ink-3">{m.from === "staff" ? "پشتیبانی" : m.from === meId ? "شما" : person(s, m.from)?.name}: </b>{m.text}</li>)}</ul>
      {c.status !== "RESOLVED" && c.status !== "ESCALATED" && (
        <>
          <div className="flex gap-2"><input aria-label="پاسخ" value={t} onChange={(e) => setT(e.target.value)} placeholder={mine ? "توضیح بیشتر…" : "پاسخ شما به این شکایت…"} className="h-11 min-w-0 flex-1 rounded-ui border border-line px-3 text-sm" /><Button size="sm" disabled={!t.trim()} onClick={() => { const r = act((x) => replyComplaint(x, meId, c.id, t)); if (r.ok) setT(""); else toast(r.error, "err"); }}>ارسال</Button></div>
          <div className="flex flex-wrap gap-2">{mine && <Button size="sm" variant="secondary" onClick={() => act((x) => resolveComplaint(x, meId, c.id))}>مشکل حل شد</Button>}<Button size="sm" variant="ghost" onClick={() => { act((x) => escalateComplaint(x, meId, c.id)); toast("به پشتیبانی کامیونت ارجاع شد."); }}>ارجاع به پشتیبانی</Button></div>
          {c.status === "OPEN" && !mine && <p className="text-xs text-warn">اگر تا چند دقیقه پاسخ ندهید، شکایت خودکار به پشتیبانی می‌رود.</p>}
        </>
      )}
      {c.status === "ESCALATED" && <p className="text-xs leading-6 text-ink-3">پرونده نزد پشتیبانی است و نتیجه را اعلان می‌گیرید.</p>}
    </div>
  );
}

function ComplaintSheet({ open, onClose, o, role, meId }: { open: boolean; onClose: () => void; o: Order; role: "shipper" | "driver"; meId: string }) {
  const [cat, setCat] = useState<string>(COMPLAINT_CATEGORIES[role][0]);
  const [text, setText] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="ثبت شکایت یا مشکل" footer={<Button block disabled={text.trim().length < 5} onClick={() => { const r = act((x) => fileComplaint(x, meId, o.id, cat, text)); if (r.ok) { toast("شکایت ثبت شد؛ طرف مقابل همین حالا مطلع می‌شود."); setText(""); onClose(); } else toast(r.error, "err"); }}>ثبت و اطلاع به طرف مقابل</Button>}>
      <div className="space-y-4"><p className="text-sm leading-7 text-ink-3">ابتدا مشکل را مستقیم با طرف مقابل حل کنید: او همین حالا مطلع می‌شود و می‌تواند پاسخ دهد. اگر در چند دقیقه حل نشد، به پشتیبانی کامیونت می‌رود.</p>
        <Field label="موضوع">{(id) => <Select id={id} value={cat} onChange={(e) => setCat(e.target.value)}>{COMPLAINT_CATEGORIES[role].map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <Field label="شرح مشکل">{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="چه اتفاقی افتاد؟ چه انتظاری دارید؟" />}</Field></div>
    </Sheet>
  );
}
