"use client";

import { useMemo } from "react";
import { CITIES, cityByName, nearestCity } from "@/lib/geo";
import type { Place } from "@/lib/types";
import { Field, Input, Select } from "./ui";
import { MapView } from "./MapView";

/** City + free-text address + tap-to-refine map pin. */
export function PlacePicker({ label, value, onChange, kind }: { label: string; value: Place; onChange: (p: Place) => void; kind: "origin" | "dest" }) {
  const markers = useMemo(() => [{ id: "p", lat: value.lat, lng: value.lng, kind }], [value.lat, value.lng, kind]);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-[15px] font-bold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Field label="شهر">
          {(id) => (
            <Select id={id} value={value.city} onChange={(e) => { const c = cityByName(e.target.value); onChange({ city: c.name, lat: c.lat, lng: c.lng, address: value.address }); }}>
              {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="نشانی دقیق">
          {(id) => <Input id={id} value={value.address} placeholder="خیابان، پلاک، انبار…" onChange={(e) => onChange({ ...value, address: e.target.value })} />}
        </Field>
      </div>
      <div className="h-48 overflow-hidden rounded-ui border border-line">
        <MapView
          markers={markers}
          fitKey={value.city}
          className="size-full"
          onMapClick={(lat, lng) => { const c = nearestCity(lat, lng); onChange({ ...value, city: c.name, lat, lng }); }}
        />
      </div>
      <p className="text-[13px] text-ink-3">برای دقیق‌تر شدن، روی نقشه بزنید. این نقطه فقط پس از تخصیص راننده دیده می‌شود.</p>
    </fieldset>
  );
}
