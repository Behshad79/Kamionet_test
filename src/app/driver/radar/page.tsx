"use client";

import { BellRing, LocateFixed, Navigation, Radar, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/MapView";
import { PlaceCombobox } from "@/components/inputs";
import { isLive } from "@/components/driver/Stages";
import { toast } from "@/components/Toaster";
import { Badge, Button, ButtonLink, Card, Segmented } from "@/components/ui";
import { driverNetFor } from "@/lib/engine/pay";
import { radarBlock, radarLoads, type LatLng } from "@/lib/engine/radar";
import { cityByName, lerp } from "@/lib/geo";
import { CARGO, fa, toman } from "@/lib/format";
import { usePortal } from "@/lib/hooks";

const COOLDOWN = 90_000;

/**
 * Live radar: while the driver is on this screen with an empty truck, loads near the current position (or along a chosen route) are
 * shown on the map and a single alert appears when a new one comes close. No background polling, no alerts with cargo on board.
 */
export default function Page() {
  const { s, me, stage, ready } = usePortal("driver");
  const [mode, setMode] = useState<"near" | "route">("near");
  const [destName, setDestName] = useState("");
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState<LatLng>(() => ({ lat: 35.7, lng: 51.4 }));
  const [sim, setSim] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const last = useRef(0);
  const dest = destName ? cityByName(destName) : undefined;
  const block = me ? radarBlock(s, me.id) : "";

  // Real GPS when allowed; otherwise the user can run the demo drive.
  useEffect(() => {
    if (!on || sim || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => toast("موقعیت در دسترس نیست؛ می‌توانید «شبیه‌سازی حرکت» را بزنید.", "err"), { enableHighAccuracy: true, maximumAge: 10_000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [on, sim]);
  // Demo drive: Tehran → destination (or Isfahan) at a visible pace.
  useEffect(() => {
    if (!on || !sim) return;
    const a = { lat: 35.69, lng: 51.39 }, b = dest ?? cityByName("اصفهان");
    let t = 0;
    const id = setInterval(() => { t = Math.min(1, t + 0.02); setPos(lerp(a, b, t)); }, 1500);
    return () => clearInterval(id);
  }, [on, sim, dest]);

  const hits = useMemo(() => (on && me && !block ? radarLoads(s, me.id, pos, { radiusKm: 30, dest, corridorKm: 25 }) : []), [on, me, block, s, pos, dest]);

  // One alert at a time, per-load once, with a cooldown, only while the screen is open and the truck is empty.
  useEffect(() => {
    if (!on || block) return;
    const fresh = hits.find((h) => !seen.current.has(h.o.id) && h.km <= 20);
    if (!fresh || Date.now() - last.current < COOLDOWN) return;
    seen.current.add(fresh.o.id);
    last.current = Date.now();
    setAlert(fresh.o.id);
    if ("vibrate" in navigator) navigator.vibrate?.(120);
  }, [hits, on, block]);

  if (!ready || !me) return null;
  if (!isLive(stage)) return <Card className="space-y-3 p-6 text-center"><h1 className="text-xl font-black">رادار بار</h1><p className="text-sm leading-7 text-ink-3">پس از تأیید احراز هویت، بارهای سر مسیر را آنی می‌بینید.</p><ButtonLink href="/driver/kyc/" block>ادامه‌ی احراز هویت</ButtonLink></Card>;
  const a = alert ? s.orders.find((o) => o.id === alert) : undefined;
  const hit = hits.find((h) => h.o.id === alert);

  return (
    <div className="space-y-4">
      <div><h1 className="flex items-center gap-2 text-xl font-black"><Radar className="size-6 text-act" aria-hidden />رادار بار</h1><p className="mt-1 text-sm leading-7 text-ink-3">با رادار روشن، بارهای نزدیک یا سر مسیرتان را روی نقشه می‌بینید و اگر باری نزدیک شد خبر می‌گیرید. فقط وقتی این صفحه باز است و بار ندارید فعال است.</p></div>
      {block && <p role="status" className="rounded-ui bg-warn-bg p-3 text-sm font-bold text-warn">{block}</p>}
      <Card className="space-y-3 p-4">
        <Segmented<"near" | "route"> value={mode} onChange={(v) => { setMode(v); if (v === "near") setDestName(""); }} options={[{ value: "near", label: "اطراف من", sub: "تا ۳۰ کیلومتر" }, { value: "route", label: "مسیر من", sub: "از اینجا تا مقصد" }]} />
        {mode === "route" && <PlaceCombobox label="مقصد من" value={destName} onSelect={(p) => setDestName(p?.name ?? "")} />}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!!block || (mode === "route" && !dest)} onClick={() => { setOn(!on); seen.current.clear(); }}>{on ? "خاموش‌کردن رادار" : "روشن‌کردن رادار"}</Button>
          {on && <Button variant="secondary" onClick={() => setSim(!sim)}><Navigation className="size-4" aria-hidden />{sim ? "توقف شبیه‌سازی" : "شبیه‌سازی حرکت (دمو)"}</Button>}
          {on && <Badge tone="ok"><LocateFixed className="size-3.5" aria-hidden />رادار روشن · {fa(hits.length)} بار</Badge>}
        </div>
      </Card>

      {a && hit && (
        <Card role="alert" className="space-y-3 border-2 border-act p-4 shadow-lift">
          <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2 font-black text-act-ink"><BellRing className="size-5" aria-hidden />باری سر راه شماست</div><button onClick={() => setAlert(null)} aria-label="بستن" className="grid size-11 place-items-center rounded-full hover:bg-ink/5"><X className="size-5" /></button></div>
          <div className="font-black">{a.origin.city} ← {a.dest.city} · {CARGO[a.cargo].label}</div>
          <p className="text-sm text-ink-3">{fa(hit.km)} کیلومتر تا مبدأ{hit.fromRoute !== undefined ? ` · ${fa(hit.fromRoute)} کیلومتر از مسیر شما دور است` : ""} · درآمد خالص {toman(driverNetFor(s, a).net)}</p>
          <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setAlert(null)}>بعداً</Button><ButtonLink href={`/driver/order/?id=${a.id}`}>دیدن بار</ButtonLink></div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <MapView className="h-[52dvh]" fitKey={`${on}-${mode}-${destName}`} markers={[{ id: "me", lat: pos.lat, lng: pos.lng, kind: "truck" as const }, ...(dest ? [{ id: "dest", lat: dest.lat, lng: dest.lng, kind: "dest" as const }] : []), ...hits.map((h) => ({ id: h.o.id, lat: h.o.origin.lat, lng: h.o.origin.lng, kind: "order" as const, label: `${fa(Math.round(driverNetFor(s, h.o).net / 10_000) / 100)}م` }))]} lines={dest ? [{ id: "r", points: [[pos.lat, pos.lng], [dest.lat, dest.lng]] as [number, number][] }] : []} onMarkerClick={(id) => { if (id !== "me" && id !== "dest") window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/driver/order/?id=${id}`; }} />
      </Card>
      {on && hits.length > 0 && <ul className="space-y-2">{hits.slice(0, 6).map((h) => <li key={h.o.id}><Link href={`/driver/order/?id=${h.o.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-ui bg-white p-3 shadow-soft"><span className="font-bold">{h.o.origin.city} ← {h.o.dest.city}</span><span className="text-sm text-ink-3">{fa(h.km)} کیلومتر · <b className="text-ok">{toman(driverNetFor(s, h.o).net)}</b></span></Link></li>)}</ul>}
      {on && hits.length === 0 && !block && <p className="text-center text-sm text-ink-3">فعلاً باری در این محدوده نیست؛ رادار روشن می‌ماند و اگر باری آمد خبر می‌گیرید.</p>}
    </div>
  );
}
