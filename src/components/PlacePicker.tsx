"use client";

import { useMemo } from "react";
import { nearestCity } from "@/lib/geo";
import type { Place } from "@/lib/types";
import type { GazPlace } from "@/lib/places";
import { MapView } from "./MapView";
import { PlaceCombobox } from "./inputs";
import { Field, Input } from "./ui";

export const emptyPlace = (): Place => ({ city: "", lat: 0, lng: 0, address: "" });

/** Searchable city + required free-text address + tap-to-refine map pin. Starts empty on purpose. */
export function PlacePicker({
  label, value, onChange, kind, errors,
}: {
  label: string; value: Place; onChange: (p: Place) => void; kind: "origin" | "dest"; errors?: { city?: string; address?: string };
}) {
  const chosen = value.city !== "";
  const markers = useMemo(() => (chosen ? [{ id: "p", lat: value.lat, lng: value.lng, kind }] : []), [chosen, value.lat, value.lng, kind]);
  const pick = (p: GazPlace | null) =>
    onChange(p ? { city: p.name, province: p.province, lat: p.lat, lng: p.lng, address: value.address } : { ...emptyPlace(), address: value.address });
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-[15px] font-bold">{label}</legend>
      <PlaceCombobox label="شهر یا شهرک صنعتی" value={value.city ? `${value.city}${value.province ? `، ${value.province}` : ""}` : ""} onSelect={pick} error={errors?.city} />
      <Field label="نشانی دقیق" error={errors?.address}>
        {(id) => (
          <Input id={id} value={value.address} placeholder="خیابان، پلاک، نام انبار یا کارخانه…" aria-invalid={!!errors?.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })} />
        )}
      </Field>
      <div className="h-64 overflow-hidden rounded-ui border border-line">
        <MapView
          markers={markers}
          fitKey={chosen ? value.city : ""}
          className="size-full"
          onMapClick={(lat, lng) => {
            const c = nearestCity(lat, lng);
            onChange({ ...value, city: value.city || c.name, province: value.city ? value.province : c.province, lat, lng });
          }}
        />
      </div>
      <p className="text-[13px] text-ink-3">برای دقیق‌تر شدن، روی نقشه بزنید. این نقطه فقط پس از تأیید نهایی راننده برای او نمایش داده می‌شود.</p>
    </fieldset>
  );
}
