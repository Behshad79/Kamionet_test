"use client";

import { LifeBuoy, Send } from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge, Button, Card, EmptyState, Input, cx } from "@/components/ui";
import { hhmm, jShort } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { addTicketMsg, closeTicket } from "@/lib/store";

export default function AdminTickets() {
  const { s } = useApp();
  const [id, setId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const t = s.tickets.find((x) => x.id === (id ?? s.tickets[0]?.id));
  const name = (uid: string) => s.users.find((u) => u.id === uid)?.name ?? "—";
  return (
    <AdminShell title="پشتیبانی">
      {s.tickets.length === 0 ? <EmptyState icon={<LifeBuoy className="size-7" />} title="تیکتی وجود ندارد" /> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {s.tickets.map((x) => (
              <button key={x.id} onClick={() => setId(x.id)} className={cx("w-full rounded-ui bg-white p-4 text-start shadow-soft transition", t?.id === x.id && "ring-2 ring-accent-600")}>
                <div className="flex items-center justify-between gap-2"><b className="line-clamp-1">{x.subject}</b><Badge tone={x.status === "open" ? "warn" : "ok"}>{x.status === "open" ? "باز" : "بسته"}</Badge></div>
                <div className="mt-1 text-xs text-ink-3">{name(x.userId)}</div>
              </button>
            ))}
          </div>
          {t && (
            <Card className="flex min-h-96 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-line p-4"><div><b>{t.subject}</b><div className="text-xs text-ink-3">{name(t.userId)}</div></div>{t.status === "open" && <Button size="sm" variant="secondary" onClick={() => closeTicket(t.id)}>بستن تیکت</Button>}</div>
              <div className="flex-1 space-y-3 bg-surface-2 p-4">
                {t.messages.map((m, i) => (
                  <div key={i} className={cx("flex", m.from === "user" ? "justify-start" : "justify-end")}>
                    <div className={cx("max-w-[80%] rounded-ui px-4 py-2.5 text-sm leading-7", m.from === "user" ? "bg-white shadow-soft" : "bg-brand-100")}>{m.text}<div className="mt-1 text-[11px] text-ink-3">{jShort(m.at)}، {hhmm(m.at)}</div></div>
                  </div>
                ))}
              </div>
              {t.status === "open" && (
                <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addTicketMsg(t.id, text.trim(), "admin"); setText(""); } }}>
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="پاسخ پشتیبانی…" /><Button aria-label="ارسال"><Send className="size-4 rotate-180" /></Button>
                </form>
              )}
            </Card>
          )}
        </div>
      )}
    </AdminShell>
  );
}
