"use client";

import { useState } from "react";
import { Button, Sheet, Tabs, Textarea } from "../../ui";
import { DataTable, type Col } from "../DataTable";
import { Denied, KV, PageHead, Pill, Kpi, useAdmin } from "../kit";
import { guard } from "@/lib/engine/admin";
import { adminResolveComplaint } from "@/lib/engine/comms";
import { audit, nameOf } from "@/lib/engine/core";
import { adminActor } from "@/lib/engine/admin";
import { fa, jDateTime } from "@/lib/format";
import { act, useStore } from "@/lib/store";
import type { CallLog, Chat, Complaint } from "@/lib/types";

const CALL_L: Record<CallLog["status"], [string, "ok" | "warn" | "danger" | "neutral" | "info"]> = { RINGING: ["در حال زنگ", "info"], ACTIVE: ["در مکالمه", "ok"], ENDED: ["پایان‌یافته", "neutral"], MISSED: ["بی‌پاسخ", "warn"], DECLINED: ["رد شد", "danger"] };
const CP_L: Record<Complaint["status"], [string, "ok" | "warn" | "danger" | "info"]> = { OPEN: ["در انتظار پاسخ", "warn"], ANSWERED: ["پاسخ داده شد", "info"], RESOLVED: ["حل‌شده", "ok"], ESCALATED: ["ارجاع‌شده", "danger"] };
const dur = (c: CallLog) => (c.answeredAt && c.endedAt ? `${fa(Math.round((c.endedAt - c.answeredAt) / 1000))} ثانیه` : "—");

/** Staff view of in-app chats, calls and complaints. Opening a transcript is audited. */
export function CommsModule() {
  const s = useStore();
  const { admin, has, run } = useAdmin();
  const [tab, setTab] = useState<"chats" | "calls" | "complaints">("complaints");
  const [chat, setChat] = useState<Chat | null>(null);
  const [cp, setCp] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (!has("comms")) return <Denied perm="comms" />;
  const order = (id: string) => s.orders.find((o) => o.id === id);
  const route = (id: string) => { const o = order(id); return o ? `${o.origin.city} ← ${o.dest.city}` : id; };
  const openChat = (c: Chat) => { act((x) => audit(x, adminActor(x, admin.id), "chat.view", c.orderId, c.orderId)); setChat(c); };
  const chatCols: Col<Chat>[] = [
    { id: "o", label: "سفارش", cell: (c) => <span className="font-bold">{route(c.orderId)}</span>, value: (c) => route(c.orderId) },
    { id: "s", label: "صاحب بار", cell: (c) => nameOf(s, c.shipperId), value: (c) => nameOf(s, c.shipperId) },
    { id: "d", label: "راننده", cell: (c) => nameOf(s, c.driverId), value: (c) => nameOf(s, c.driverId) },
    { id: "n", label: "پیام‌ها", cell: (c) => fa(c.messages.length), value: (c) => c.messages.length, num: true },
    { id: "l", label: "آخرین پیام", cell: (c) => <span className="line-clamp-1 max-w-sm">{c.messages.at(-1)?.text ?? "—"}</span>, value: (c) => c.messages.at(-1)?.text },
    { id: "t", label: "زمان", cell: (c) => (c.messages.at(-1) ? jDateTime(c.messages.at(-1)!.at) : "—"), value: (c) => c.messages.at(-1)?.at },
  ];
  const callCols: Col<CallLog>[] = [
    { id: "t", label: "زمان", cell: (c) => jDateTime(c.at), value: (c) => c.at },
    { id: "o", label: "سفارش", cell: (c) => route(c.orderId), value: (c) => route(c.orderId) },
    { id: "f", label: "تماس‌گیرنده", cell: (c) => nameOf(s, c.from), value: (c) => nameOf(s, c.from) },
    { id: "to", label: "گیرنده", cell: (c) => nameOf(s, c.to), value: (c) => nameOf(s, c.to) },
    { id: "st", label: "نتیجه", cell: (c) => <Pill tone={CALL_L[c.status][1]}>{CALL_L[c.status][0]}</Pill>, value: (c) => CALL_L[c.status][0] },
    { id: "d", label: "مدت مکالمه", cell: (c) => dur(c), value: (c) => (c.answeredAt && c.endedAt ? c.endedAt - c.answeredAt : 0), num: true },
  ];
  const cpCols: Col<Complaint>[] = [
    { id: "t", label: "زمان", cell: (c) => jDateTime(c.at), value: (c) => c.at },
    { id: "c", label: "موضوع", cell: (c) => <b>{c.category}</b>, value: (c) => c.category },
    { id: "o", label: "سفارش", cell: (c) => route(c.orderId), value: (c) => route(c.orderId) },
    { id: "by", label: "شاکی", cell: (c) => `${nameOf(s, c.byId)} · ${c.byRole === "driver" ? "راننده" : "صاحب بار"}`, value: (c) => nameOf(s, c.byId) },
    { id: "ag", label: "طرف مقابل", cell: (c) => nameOf(s, c.againstId), value: (c) => nameOf(s, c.againstId) },
    { id: "st", label: "وضعیت", cell: (c) => <Pill tone={CP_L[c.status][1]}>{CP_L[c.status][0]}</Pill>, value: (c) => CP_L[c.status][0] },
    { id: "m", label: "پیام‌ها", cell: (c) => fa(c.messages.length), value: (c) => c.messages.length, num: true },
  ];
  const c = s.complaints.find((x) => x.id === cp);
  const missed = s.calls.filter((x) => x.status === "MISSED").length;
  return (
    <div>
      <PageHead title="گفتگوها، تماس‌ها و شکایت‌ها" sub="تمام گفتگوی درون‌برنامه‌ای و تماس‌های بین صاحب بار و راننده‌ی هر سفارش؛ مشاهده‌ی متن ثبت می‌شود" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="گفتگوی فعال" value={fa(s.chats.length)} /><Kpi label="تماس‌ها" value={fa(s.calls.length)} sub={`${fa(missed)} بی‌پاسخ`} /><Kpi label="شکایت باز" value={fa(s.complaints.filter((x) => ["OPEN", "ANSWERED"].includes(x.status)).length)} tone="warn" /><Kpi label="ارجاع به پشتیبانی" value={fa(s.complaints.filter((x) => x.status === "ESCALATED").length)} tone={s.complaints.some((x) => x.status === "ESCALATED") ? "danger" : "ok"} /></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "complaints", label: "شکایت‌ها", count: s.complaints.length }, { id: "chats", label: "گفتگوها", count: s.chats.length }, { id: "calls", label: "تماس‌ها", count: s.calls.length }]} className="mb-4" />
      {tab === "complaints" && <DataTable id="complaints" rows={s.complaints} rowKey={(x) => x.id} cols={cpCols} onRow={(x) => { setCp(x.id); setNote(""); }} search={(x) => `${x.category} ${nameOf(s, x.byId)} ${nameOf(s, x.againstId)} ${x.text}`} filters={[{ id: "st", label: "وضعیت", options: Object.entries(CP_L).map(([id, [label]]) => ({ id, label })), test: (x, v) => x.status === v }]} />}
      {tab === "chats" && <DataTable id="chats" rows={s.chats} rowKey={(x) => x.orderId} cols={chatCols} onRow={openChat} search={(x) => `${route(x.orderId)} ${nameOf(s, x.shipperId)} ${nameOf(s, x.driverId)} ${x.messages.map((m) => m.text).join(" ")}`} />}
      {tab === "calls" && <DataTable id="calls" rows={s.calls} rowKey={(x) => x.id} cols={callCols} search={(x) => `${route(x.orderId)} ${nameOf(s, x.from)} ${nameOf(s, x.to)}`} filters={[{ id: "st", label: "نتیجه", options: Object.entries(CALL_L).map(([id, [label]]) => ({ id, label })), test: (x, v) => x.status === v }]} />}

      {chat && <Sheet open onClose={() => setChat(null)} title={`گفتگو · ${route(chat.orderId)}`} wide><div className="space-y-3"><dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="صاحب بار" v={nameOf(s, chat.shipperId)} /><KV k="راننده" v={nameOf(s, chat.driverId)} /><KV k="سفارش" v={chat.orderId} /></dl><p className="rounded-ui bg-warn-bg p-3 text-xs leading-6 text-warn">مشاهده‌ی این گفتگو در گزارش ممیزی ثبت شد. فقط برای رسیدگی به شکایت و کنترل کیفیت استفاده شود.</p><ul className="space-y-2">{chat.messages.map((m) => <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-7 ${m.from === chat.shipperId ? "bg-accent-50" : "ms-auto bg-brand-50"}`}><b className="text-xs text-ink-3">{nameOf(s, m.from)} · {m.from === chat.shipperId ? "صاحب بار" : "راننده"}</b><br />{m.text}<div className="text-[10px] text-ink-4">{jDateTime(m.at)}</div></li>)}</ul></div></Sheet>}
      {c && <Sheet open onClose={() => setCp(null)} title={`شکایت: ${c.category}`} wide footer={has("comms") && c.status !== "RESOLVED" ? <div className="space-y-2"><Textarea aria-label="نتیجه‌ی رسیدگی" value={note} onChange={(e) => setNote(e.target.value)} placeholder="نتیجه‌ی رسیدگی (برای هر دو طرف ارسال می‌شود)" /><Button block onClick={() => { const r = run((x, a) => { const g = guard(x, a, "comms"); return g.ok ? adminResolveComplaint(x, g.actor, c.id, note) : g; }, "شکایت بسته شد"); if (r.ok) setCp(null); }}>بستن شکایت با این توضیح</Button></div> : null}>
        <div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><Pill tone={CP_L[c.status][1]}>{CP_L[c.status][0]}</Pill><Pill>{route(c.orderId)}</Pill>{c.ticketId && <Pill tone="info">تیکت {c.ticketId}</Pill>}</div>
          <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="شاکی" v={`${nameOf(s, c.byId)} (${c.byRole === "driver" ? "راننده" : "صاحب بار"})`} /><KV k="طرف مقابل" v={nameOf(s, c.againstId)} /><KV k="ثبت" v={jDateTime(c.at)} />{c.resolvedBy && <KV k="بسته‌شده توسط" v={c.resolvedBy} />}</dl>
          <ul className="space-y-2">{c.messages.map((m, i) => <li key={i} className={`rounded-xl p-3 text-sm leading-7 ${m.from === "staff" ? "bg-accent-50" : "bg-surface-2"}`}><b className="text-xs text-ink-3">{m.from === "staff" ? "پشتیبانی" : nameOf(s, m.from)}</b><br />{m.text}</li>)}</ul></div>
      </Sheet>}
    </div>
  );
}
