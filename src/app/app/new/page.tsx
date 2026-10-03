"use client";

import { OrderWizard } from "@/components/wizard/OrderWizard";
import { usePortal, useQueryParam } from "@/lib/hooks";
import { T } from "@/lib/money";

export default function Page() {
  const { s, me } = usePortal("shipper");
  const from = useQueryParam("from");
  if (!me || from === undefined || !s.ready) return null;
  const o = from ? s.orders.find((x) => x.id === from && x.shipperId === me.id) : undefined;
  const initial = o ? {
    from: { city: o.origin.city, lat: o.origin.lat, lng: o.origin.lng }, fromAddr: o.origin.address, fromPin: { lat: o.origin.lat, lng: o.origin.lng }, to: { city: o.dest.city, lat: o.dest.lat, lng: o.dest.lng }, toAddr: o.dest.address, toPin: { lat: o.dest.lat, lng: o.dest.lng },
    consName: o.consignee.name, consPhone: o.consignee.phone, mode: o.cargoMode, cargo: o.cargo, tMin: o.tempMin ?? 0, tMax: o.tempMax ?? 4, odor: o.odor, odorSensitive: o.odorSensitive,
    vehicle: o.vehicleKind, weightKg: o.weightKg, pallets: o.pallets, volume: o.volumeM3, packaging: o.packaging, itemized: o.itemizedInvoice, declaredT: T(o.declaredValue), cleanOnly: o.cleanOnly,
    service: o.serviceClass, assign: o.assignMode === "DIRECT" || o.assignMode === "SMART" ? o.assignMode : o.serviceClass === "PRO" ? ("PRO_POOL" as const) : ("OPEN" as const), directId: o.directDriverId,
    freightT: T(Math.round(o.freight / (1 + o.proUpliftPct) / 10000) * 10000), insurance: o.insurance.productId, terms: o.terms,
  } : undefined;
  return <OrderWizard key={from ?? "new"} shipperId={me.id} initial={initial} />;
}
