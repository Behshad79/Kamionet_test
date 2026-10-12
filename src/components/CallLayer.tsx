"use client";

import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { useState } from "react";
import { answerCall, declineCall, endCall, RING_SEC } from "@/lib/engine/comms";
import { person } from "@/lib/engine/core";
import { faText } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { act, useStore } from "@/lib/store";
import { Avatar } from "./profile";

const mmss = (ms: number) => faText(`${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`);

/** Full-width call banner/sheet shown on any screen of the portal while this user is ringing or in a call (simulated audio). */
export function CallLayer({ meId }: { meId?: string }) {
  const s = useStore();
  const now = useNow(1000);
  const [mute, setMute] = useState(false);
  const [spk, setSpk] = useState(false);
  const call = meId ? s.calls.find((c) => (c.status === "RINGING" || c.status === "ACTIVE") && (c.from === meId || c.to === meId)) : undefined;
  if (!call || !meId) return null;
  const peer = person(s, call.from === meId ? call.to : call.from);
  const incoming = call.to === meId;
  const o = s.orders.find((x) => x.id === call.orderId);
  const left = Math.max(0, RING_SEC - Math.floor((now - call.at) / 1000));
  return (
    <div role="alertdialog" aria-live="assertive" aria-label={incoming && call.status === "RINGING" ? "تماس ورودی" : "تماس"} className="fixed inset-x-0 top-0 z-[70] p-3">
      <div className="mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-[28px] bg-ink p-4 text-white shadow-lift">
        <Avatar name={peer?.name ?? ""} size={52} hue={((peer?.id.length ?? 5) * 61) % 360} />
        <div className="min-w-0 flex-1"><div className="truncate font-black">{peer?.name}</div><div className="text-xs text-white/70">{call.status === "RINGING" ? (incoming ? `تماس ورودی درون‌برنامه‌ای · ${faText(String(left))} ثانیه` : "در حال تماس…") : `در مکالمه · ${mmss(now - (call.answeredAt ?? call.at))}`}{o ? ` · ${o.origin.city} ← ${o.dest.city}` : ""}</div></div>
        {call.status === "RINGING" && incoming ? (
          <div className="flex gap-2"><button aria-label="رد تماس" onClick={() => act((x) => declineCall(x, meId, call.id))} className="grid size-14 place-items-center rounded-full bg-danger text-white"><PhoneOff className="size-6" aria-hidden /></button><button aria-label="پاسخ" onClick={() => act((x) => answerCall(x, meId, call.id))} className="grid size-14 place-items-center rounded-full bg-ok text-white"><Phone className="size-6" aria-hidden /></button></div>
        ) : (
          <div className="flex gap-2">{call.status === "ACTIVE" && <><button aria-pressed={mute} aria-label="بی‌صدا" onClick={() => setMute(!mute)} className={`grid size-12 place-items-center rounded-full ${mute ? "bg-white text-ink" : "bg-white/15"}`}>{mute ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}</button><button aria-pressed={spk} aria-label="بلندگو" onClick={() => setSpk(!spk)} className={`grid size-12 place-items-center rounded-full ${spk ? "bg-white text-ink" : "bg-white/15"}`}><Volume2 className="size-5" aria-hidden /></button></>}<button aria-label="پایان تماس" onClick={() => act((x) => endCall(x, meId, call.id))} className="grid size-14 place-items-center rounded-full bg-danger text-white"><PhoneOff className="size-6" aria-hidden /></button></div>
        )}
        <p className="w-full text-[11px] text-white/50">شماره‌ی شما نمایش داده نمی‌شود · تماس برای کیفیت ثبت می‌شود · (نسخه‌ی نمایشی: صدا شبیه‌سازی است)</p>
      </div>
    </div>
  );
}
