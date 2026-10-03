import { useMemo } from "react";
import { VEHICLES, VEHICLE_COLORS } from "@/lib/vehicles";
import type { Silhouette, VehicleKind } from "@/lib/types";
import { TRUCK_ART } from "./truckAssets";

export type TruckState = "idle" | "driving" | "cooling" | "alert";

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function mix(hex: string, to: number, amt: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(v + (to - v) * amt));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
const hexOf = (c: string) => VEHICLE_COLORS.find((x) => x.id === c)?.hex ?? (c.startsWith("#") ? c : "#F3F4F6");

/** Silhouette → vector art + relative scale (so a trailer reads bigger than a pickup) + where the fridge badge sits. */
const ART: Record<Silhouette, { art: keyof typeof TRUCK_ART; scale: number; badge?: [number, number] }> = {
  pickup: { art: "pickup-truck", scale: 0.8 },
  small: { art: "delivery-truck", scale: 0.84, badge: [93, 55] },
  mid: { art: "delivery-truck", scale: 0.94, badge: [93, 55] },
  heavy: { art: "articulated-lorry", scale: 0.94, badge: [86, 50] },
  trailer: { art: "articulated-lorry", scale: 1, badge: [86, 50] },
};

/**
 * Vehicle illustration. Based on Noto Emoji vector art (Apache-2.0) with colour roles, so the cab/body takes the
 * driver's real vehicle colour live; the cargo box is white (reefer) or sand (dry) and carries a fridge badge.
 */
export function TruckIllustration({ kind, silhouette, color = "white", state = "idle", className, label, reefer = true }: {
  kind?: VehicleKind; silhouette?: Silhouette; color?: string; state?: TruckState; className?: string; label?: string; reefer?: boolean;
}) {
  const sil: Silhouette = silhouette ?? (kind ? VEHICLES[kind].silhouette : "heavy");
  const dry = kind ? !VEHICLES[kind].fridge : !reefer;
  const spec = ART[sil];
  const base = hexOf(color);
  const html = useMemo(() => {
    const map: Record<string, string> = {
      base, dark: mix(base, 0, 0.28), accent: "#146EB4",
      box: dry ? "#d6b98a" : "#f4f6f8", boxDark: dry ? "#b8975f" : "#cfd5dc",
    };
    return TRUCK_ART[spec.art].replace(/\{\{(\w+)\}\}/g, (_, k: string) => map[k] ?? "#999");
  }, [spec.art, base, dry]);
  const alert = state === "alert";
  return (
    <svg viewBox="4 12 120 111" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} fill="none">
      <ellipse cx="64" cy="115" rx={52 * spec.scale} ry="4.5" fill="#0f172a" opacity=".14" />
      <g transform={`translate(${64 - 64 * spec.scale} ${(116 - 116 * spec.scale).toFixed(1)}) scale(${spec.scale})`}>
        <g className={state === "driving" ? "animate-[rumble_.5s_ease-in-out_infinite]" : undefined} dangerouslySetInnerHTML={{ __html: html }} />
        {reefer && !dry && spec.badge && (
          <g transform={`translate(${spec.badge[0]} ${spec.badge[1]})`}>
            <circle r="11" fill="#fff" opacity=".92" />
            <g stroke={alert ? "#DC2626" : "#146EB4"} strokeWidth="2.4" strokeLinecap="round"><path d="M0-7v14M-6.1-3.5l12.2 7M-6.1 3.5l12.2-7" /></g>
          </g>
        )}
      </g>
      {alert && <g transform="translate(112 16)"><circle r="10" fill="#B91C1C" /><path d="M0-5v5.5M0 4.5v.1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></g>}
    </svg>
  );
}
