"use client";

import { Download, FileCheck2, Hourglass } from "lucide-react";
import { Card } from "../ui";
import { cv } from "@/lib/config";
import { faText, jDateTime } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

/** The official freight slip: Kamionet prints, stamps and uploads it a few minutes after the instant waybill. */
export function OfficialDocCard({ o }: { o: Order }) {
  const s = useStore();
  const now = useNow(30_000);
  const d = o.officialDoc;
  if (!d) return null;
  if (d.status === "PENDING") {
    const sla = cv<number>(s, "official.slaMin");
    const left = Math.max(0, Math.ceil((d.requestedAt + sla * 60_000 - now) / 60_000));
    return <Card className="flex items-start gap-3 p-4"><Hourglass className="mt-0.5 size-6 shrink-0 text-warn" aria-hidden /><div><h2 className="font-extrabold">حواله‌ی رسمی کرایه‌ی حمل در حال صدور است</h2><p className="text-sm leading-7 text-ink-3">تیم کامیونت حواله را رسماً دریافت، مهر و بارگذاری می‌کند؛ {left > 0 ? `حدود ${faText(String(left))} دقیقه‌ی دیگر` : "تا چند لحظه‌ی دیگر"} آماده می‌شود و اعلان می‌گیرید. تا آن موقع «بارنامه‌ی کامیونت» معتبر و قابل استفاده است.</p></div></Card>;
  }
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border border-ok/30 p-4">
      <div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden /><div><h2 className="font-extrabold">حواله‌ی رسمی کرایه‌ی حمل آماده است</h2><p className="text-xs text-ink-3">{d.no ? `شماره ${faText(d.no)} · ` : ""}مهر و تأیید کامیونت · {d.readyAt ? jDateTime(d.readyAt) : ""}</p></div></div>
      <a href={d.dataUrl} download={`official-slip-${o.id}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-ui bg-ink px-4 font-bold text-white"><Download className="size-4" aria-hidden />مشاهده و دانلود</a>
    </Card>
  );
}
