"use client";

import { Crosshair, MapPin } from "lucide-react";
import { useState } from "react";
import { fa } from "@/lib/format";
import { MapView } from "./MapView";
import { Button } from "./ui";

export interface Pin { lat: number; lng: number }

/** Tap the map to drop an exact pin. The pin stays hidden from drivers until the deposit is paid. */
export function PinPicker({ label, tone, center, value, onChange, error }: { label: string; tone: "origin" | "dest"; center?: Pin; value?: Pin; onChange: (p: Pin) => void; error?: string }) {
  const [busy, setBusy] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    const t = setTimeout(() => setBusy(false), 3000);
    navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); setBusy(false); onChange({ lat: p.coords.latitude, lng: p.coords.longitude }); }, () => { clearTimeout(t); setBusy(false); }, { timeout: 2500 });
  };
  const c = value ?? center;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-ink-2">{label}</span>
        <Button type="button" size="sm" variant="ghost" loading={busy} onClick={locate}><Crosshair className="size-4" aria-hidden />موقعیت من</Button></div>
      <div className={`h-56 overflow-hidden rounded-ui ring-2 ${error ? "ring-danger" : "ring-transparent"}`}>
        {c ? (
          <MapView className="size-full" fitKey={`${tone}${center?.lat}${center?.lng}${value ? "p" : ""}`}
            markers={[{ id: "pin", lat: c.lat, lng: c.lng, kind: value ? tone : "dot" }]} onMapClick={(lat, lng) => onChange({ lat, lng })} />
        ) : <div className="grid size-full place-items-center bg-surface-3 text-sm text-ink-3">ابتدا شهر را انتخاب کنید</div>}
      </div>
      <p className={`flex items-center gap-1.5 text-xs ${value ? "font-bold text-ok" : error ? "text-danger" : "text-ink-3"}`} role={error ? "alert" : undefined}>
        <MapPin className="size-4" aria-hidden />{value ? `پین ثبت شد (${fa(Math.round(value.lat * 1000) / 1000)}، ${fa(Math.round(value.lng * 1000) / 1000)})` : error ?? "روی نقشه بزنید تا محل دقیق را پین کنید."}
      </p>
    </div>
  );
}
