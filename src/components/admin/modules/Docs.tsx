"use client";

import { useState } from "react";
import { FileDrop } from "../../molecules";
import { Button, Field, Input, Sheet } from "../../ui";
import { DataTable, type Col } from "../DataTable";
import { Kpi, PageHead, Pill, useAdmin } from "../kit";
import { guard, uploadOfficialDoc } from "@/lib/engine/admin";
import { nameOf } from "@/lib/engine/core";
import { faText, jDateTime, relative, toman } from "@/lib/format";
import { cv } from "@/lib/config";
import { officialPlaceholder } from "@/lib/officialPlaceholder";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

/** Queue of official freight slips: customers see «issuing…» until staff stamp and upload the file. */
export function DocsModule() {
  const s = useStore();
  const { run } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const [file, setFile] = useState<string>();
  const [no, setNo] = useState("");
  const rows = s.orders.filter((o) => o.officialDoc).sort((a, b) => Number(b.officialDoc!.status === "PENDING") - Number(a.officialDoc!.status === "PENDING") || b.officialDoc!.requestedAt - a.officialDoc!.requestedAt);
  const pending = rows.filter((o) => o.officialDoc!.status === "PENDING");
  const sla = cv<number>(s, "official.slaMin") * 60_000;
  const o = rows.find((x) => x.id === sel);
  const cols: Col<Order>[] = [
    { id: "st", label: "وضعیت", cell: (x) => x.officialDoc!.status === "READY" ? <Pill tone="ok">آماده</Pill> : <Pill tone={Date.now() - x.officialDoc!.requestedAt > sla ? "danger" : "warn"}>{Date.now() - x.officialDoc!.requestedAt > sla ? "از مهلت گذشته" : "در انتظار صدور"}</Pill>, value: (x) => x.officialDoc!.status },
    { id: "id", label: "سفارش", cell: (x) => <span className="font-mono text-xs">{x.id}</span>, value: (x) => x.id },
    { id: "route", label: "مسیر", cell: (x) => `${x.origin.city} ← ${x.dest.city}`, value: (x) => x.origin.city },
    { id: "sh", label: "صاحب بار", cell: (x) => nameOf(s, x.shipperId), value: (x) => nameOf(s, x.shipperId) },
    { id: "fr", label: "کرایه", cell: (x) => toman(x.freight), value: (x) => x.freight / 10, num: true },
    { id: "req", label: "درخواست", cell: (x) => relative(x.officialDoc!.requestedAt), value: (x) => x.officialDoc!.requestedAt },
    { id: "no", label: "شماره‌ی حواله", cell: (x) => faText(x.officialDoc!.no ?? "—"), value: (x) => x.officialDoc!.no },
  ];
  return (
    <div>
      <PageHead title="حواله‌های رسمی" sub="بعد از بارنامه‌ی آنی، حواله‌ی رسمی را از باربری بگیرید، مهر کنید و اینجا بارگذاری کنید؛ مشتری اعلان می‌گیرد" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3"><Kpi label="در انتظار صدور" value={faText(String(pending.length))} tone={pending.length ? "warn" : "ok"} /><Kpi label="مهلت وعده‌داده‌شده" value={`${faText(String(sla / 60_000))} دقیقه`} /><Kpi label="آماده‌شده" value={faText(String(rows.length - pending.length))} /></div>
      <DataTable id="official" rows={rows} rowKey={(x) => x.id} cols={cols} search={(x) => `${x.id} ${x.origin.city} ${x.dest.city} ${nameOf(s, x.shipperId)}`} onRow={(x) => { setSel(x.id); setFile(undefined); setNo(""); }} />
      {o && (
        <Sheet open onClose={() => setSel(null)} title={`حواله‌ی ${o.origin.city} ← ${o.dest.city}`} footer={<div className="grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => { const n = no.trim() || `1405/${o.id.replace(/\D/g, "").padStart(7, "0")}`; if (run((x, a) => { const g = guard(x, a, "docs"); return g.ok ? uploadOfficialDoc(x, a, o.id, officialPlaceholder(o, n), n) : g; }, "نمونه بارگذاری شد").ok) setSel(null); }}>بارگذاری نمونه (دمو)</Button><Button disabled={!file} onClick={() => { if (run((x, a) => uploadOfficialDoc(x, a, o.id, file!, no), "حواله بارگذاری شد و مشتری مطلع شد").ok) setSel(null); }}>بارگذاری و اطلاع‌رسانی</Button></div>}>
          <div className="space-y-4">
            <p className="text-sm leading-7 text-ink-3">{o.officialDoc!.status === "READY" ? "این حواله قبلاً بارگذاری شده؛ بارگذاری دوباره جایگزین می‌شود." : "فایل اسکن یا عکس حواله‌ی مهرشده را بارگذاری کنید."}</p>
            <Field label="شماره‌ی حواله">{(id) => <Input id={id} dir="ltr" value={no} onChange={(e) => setNo(e.target.value)} placeholder="مثلاً 12/1404-7159620" />}</Field>
            <FileDrop label="تصویر حواله‌ی رسمی" hint="مهر و امضا دیده شود" value={file} onChange={(c) => setFile(c.dataUrl)} />
            <p className="text-xs text-ink-3">ثبت: {jDateTime(o.officialDoc!.requestedAt)}</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
