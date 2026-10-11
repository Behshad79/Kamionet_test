"use client";

import { Radio } from "lucide-react";
import Link from "next/link";
import { Avatar } from "./profile";
import { SensorBadge } from "./driver/vehicleUi";
import { AvailLine, TimesChip } from "./driver/Availability";
import { Badge, Button, Card } from "./ui";
import { suggestFree } from "@/lib/engine/avail";
import { person } from "@/lib/engine/core";
import { driverStats } from "@/lib/engine/stats";
import { fa } from "@/lib/format";
import { vehicleTitle } from "@/lib/vehicles";
import type { OrderInput, Rial, State } from "@/lib/types";

type Probe = Pick<OrderInput, "pickupAt" | "vehicleKind" | "weightKg" | "cargoMode" | "tempMin" | "tempMax"> & { originCity: string; destCity: string; freight?: Rial; shipperId?: string };

/** Free drivers who fit this order, with their conditions and average arrival times. `onPick` turns a card into a direct request. */
export function FreeDrivers({ s, probe, pickedId, onPick, auto, onAuto, pickLabel = "انتخاب" }: { s: State; probe: Probe; pickedId?: string; onPick: (driverId: string | undefined) => void; auto?: boolean; onAuto?: (v: boolean) => void; pickLabel?: string }) {
  const hits = suggestFree(s, probe);
  if (hits.length === 0) return null;
  return (
    <Card className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-extrabold"><Radio className="size-5 text-ok" aria-hidden />رانندگان آزاد روی این مسیر <Badge tone="ok">{fa(hits.length)}</Badge></h2>
      <p className="text-sm leading-7 text-ink-3">این رانندگان همین حالا آزادند و شرایط بار شما را دارند. انتخاب کنید تا درخواست مستقیم برایشان برود.</p>
      <div className="space-y-2">
        {hits.slice(0, 5).map(({ a }) => {
          const d = s.drivers.find((x) => x.personId === a.driverId)!;
          const st = driverStats(s, a.driverId);
          const on = pickedId === a.driverId;
          return (
            <div key={a.id} className={`space-y-2 rounded-ui border-2 p-3 ${on ? "border-act bg-act-soft" : "border-line bg-white"}`}>
              <div className="flex items-center gap-3"><Avatar name={person(s, a.driverId)?.name ?? "راننده"} pro={d.pro.status === "pro"} size={42} hue={(a.driverId.length * 61) % 360} />
                <div className="min-w-0 flex-1"><Link href={`/app/driver/?id=${a.driverId}`} className="font-black text-accent-700 hover:underline">{person(s, a.driverId)?.name}</Link><div className="truncate text-xs text-ink-3">{vehicleTitle(d.vehicle)} · {fa(Math.round(st.rating * 10) / 10)} از ۵ · {fa(st.trips)} سفر</div></div>
                {d.vehicle.thermo?.connected && <SensorBadge />}</div>
              <p className="text-sm leading-7"><AvailLine a={a} /></p>
              {a.note && <p className="text-xs leading-6 text-ink-3">شرط راننده: {a.note}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2"><TimesChip s={s} pid={a.driverId} /><Button size="sm" variant={on ? "secondary" : "primary"} onClick={() => onPick(on ? undefined : a.driverId)}>{on ? "لغو انتخاب" : pickLabel}</Button></div>
            </div>
          );
        })}
      </div>
      {onAuto && <label className="flex min-h-12 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={!!auto} onChange={(e) => onAuto(e.target.checked)} />اگر راننده‌ی آزادِ مناسبی که پذیرش خودکار دارد پیدا شد، همان لحظه انتخاب شود.</label>}
    </Card>
  );
}
