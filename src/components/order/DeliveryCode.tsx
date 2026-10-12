"use client";

import { Copy, KeyRound, MessageSquare } from "lucide-react";
import { toast } from "../Toaster";
import { Button, Card } from "../ui";
import { now, uid } from "@/lib/engine/core";
import { faText, jDateTime } from "@/lib/format";
import { act, useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

/** Shipper-only: the recipient's delivery code, in case the recipient's phone is unreachable. It must go to the recipient, never to the driver. */
export function DeliveryCodeCard({ o }: { o: Order }) {
  const s = useStore();
  const sent = s.sms.find((m) => m.to === o.consignee.phone && m.kind === "delivery_code" && m.text.includes(o.id));
  return (
    <Card className="space-y-3 border-2 border-act/40 p-5">
      <div className="flex items-center gap-2 font-extrabold"><KeyRound className="size-5 text-act" aria-hidden />کد تحویل گیرنده</div>
      <div className="flex items-center justify-between gap-3 rounded-ui bg-act-soft p-4"><span dir="ltr" className="text-4xl font-black tracking-[0.3em] tabular" aria-label={`کد تحویل ${o.consignee.otp}`}>{faText(o.consignee.otp)}</span>
        <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(o.consignee.otp); toast("کد کپی شد."); }}><Copy className="size-4" aria-hidden />کپی</Button></div>
      <p className="rounded-ui bg-warn-bg p-3 text-sm font-bold leading-7 text-warn">این کد را به راننده نگویید. فقط به گیرنده ({o.consignee.name}) بدهید و با خود او در ارتباط باشید؛ راننده باید کد را از دهان گیرنده بشنود.</p>
      <p className="text-sm leading-7 text-ink-3">پیامک این کد به شماره‌ی گیرنده ({faText(o.consignee.phone)}) هم می‌رود. اگر گوشی او در دسترس نبود، همین کد را خودتان به او اعلام کنید.{sent ? ` آخرین ارسال: ${jDateTime(sent.at)}.` : ""}</p>
      <Button size="sm" variant="secondary" onClick={() => { act((st) => { st.sms.unshift({ id: uid(st, "sms"), at: now(st), personId: o.shipperId, to: o.consignee.phone, kind: "delivery_code", text: `کامیونت: کد تحویل بار ${o.id}: ${o.consignee.otp}. فقط هنگام تحویل به راننده بگویید.` }); }); toast("پیامک دوباره برای گیرنده ارسال شد."); }}><MessageSquare className="size-4" aria-hidden />ارسال دوباره‌ی پیامک به گیرنده</Button>
    </Card>
  );
}
