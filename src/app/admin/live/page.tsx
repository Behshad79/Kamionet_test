"use client";

import { useMemo } from "react";
import { AdminShell } from "@/components/AdminShell";
import { MapView } from "@/components/MapView";
import { tripProgress } from "@/components/order";
import { Badge, Card } from "@/components/ui";
import { fa } from "@/lib/format";
import { lerp } from "@/lib/geo";
import { useApp, useNow } from "@/lib/hooks";

export default function AdminLive() {
  const { s } = useApp();
  const now = useNow(2000);
  const active = s.orders.filter((o) => ["OPEN", "LOCKED", "ASSIGNED", "IN_TRANSIT"].includes(o.status));
  const transit = active.filter((o) => o.status === "IN_TRANSIT");

  const markers = useMemo(() => active.map((o) => {
    if (o.status === "IN_TRANSIT") {
      const p = lerp(o.origin, o.dest, tripProgress(o.startedAt, now, o.status));
      return { id: o.id, lat: p.lat, lng: p.lng, kind: "truck" as const };
    }
    return { id: o.id, lat: o.origin.lat, lng: o.origin.lng, kind: "order" as const, label: o.status === "OPEN" ? "باز" : o.status === "LOCKED" ? "قفل" : "تخصیص" };
  }), [active, now]);
  const lines = useMemo(() => transit.map((o) => ({ id: o.id, points: [[o.origin.lat, o.origin.lng], [o.dest.lat, o.dest.lng]] as [number, number][], dashed: true })), [transit]);

  return (
    <AdminShell title="نقشه‌ی زنده">
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone="warn">{fa(active.filter((o) => o.status === "OPEN").length)} سفارش باز</Badge>
        <Badge tone="brand">{fa(active.filter((o) => o.status === "LOCKED").length)} در قفل</Badge>
        <Badge tone="info">{fa(active.filter((o) => o.status === "ASSIGNED").length)} تخصیص‌یافته</Badge>
        <Badge tone="ok">{fa(transit.length)} راننده در مسیر</Badge>
      </div>
      <Card className="h-[60vh] min-h-96 overflow-hidden"><MapView markers={markers} lines={lines} fitKey="live" className="size-full" /></Card>
    </AdminShell>
  );
}
