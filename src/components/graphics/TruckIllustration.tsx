import { VEHICLES, VEHICLE_COLORS } from "@/lib/vehicles";
import type { Silhouette, VehicleKind } from "@/lib/types";

export type TruckState = "idle" | "driving" | "cooling" | "alert";

const DIMS: Record<Silhouette, { cab: number; box: number; boxH: number; axles: number[] }> = {
  pickup: { cab: 56, box: 78, boxH: 40, axles: [34, 150] },
  small: { cab: 54, box: 104, boxH: 54, axles: [34, 150] },
  mid: { cab: 58, box: 124, boxH: 60, axles: [36, 170] },
  heavy: { cab: 62, box: 150, boxH: 66, axles: [38, 190, 214] },
  trailer: { cab: 62, box: 190, boxH: 70, axles: [38, 70, 236, 262, 288] },
};

const hexOf = (c: string) => VEHICLE_COLORS.find((x) => x.id === c)?.hex ?? (c.startsWith("#") ? c : "#F3F4F6");

/** Live-recolourable vehicle silhouette (faces left, RTL reading direction). Pure SVG, decorative unless `label` is given. */
export function TruckIllustration({ kind, silhouette, color = "white", state = "idle", className, label, reefer = true }: {
  kind?: VehicleKind; silhouette?: Silhouette; color?: string; state?: TruckState; className?: string; label?: string; reefer?: boolean;
}) {
  const sil: Silhouette = silhouette ?? (kind ? VEHICLES[kind].silhouette : "heavy");
  const d = DIMS[sil];
  const W = d.cab + d.box + 14;
  const ground = 86;
  const body = hexOf(color);
  const dark = body.toLowerCase() === "#1f2937" || body.toLowerCase() === "#1e3a8a";
  const trim = dark ? "#e5e7eb" : "#111827";
  const boxTop = ground - 12 - d.boxH;
  const cabH = Math.min(d.boxH - 6, 54);
  const cabTop = ground - 12 - cabH;
  const spin = state === "driving";
  return (
    <svg viewBox={`0 0 ${W} 100`} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} fill="none">
      <ellipse cx={W / 2} cy={ground + 4} rx={W / 2 - 6} ry="3" fill="#111827" opacity=".08" />
      {/* cargo box */}
      <rect x={d.cab + 4} y={boxTop} width={d.box + 6} height={d.boxH} rx="5" fill={body} stroke={trim} strokeWidth="1.6" />
      <path d={`M${d.cab + 12} ${boxTop + 8}h${d.box - 10}`} stroke={trim} strokeOpacity=".18" strokeWidth="1.2" />
      {reefer && <rect x={d.cab + 6} y={boxTop - 7} width="26" height="9" rx="2" fill={trim} />}
      {reefer && state !== "idle" && (
        <g transform={`translate(${d.cab + 40 + d.box / 3} ${boxTop + d.boxH / 2})`} stroke={state === "alert" ? "#B91C1C" : "#146EB4"} strokeWidth="2" strokeLinecap="round">
          <path d="M0-9v18M-8-4.5l16 9M-8 4.5l16-9" /><circle r="1.6" fill="none" />
        </g>
      )}
      {/* cab */}
      <path d={`M2 ${ground - 12}V${cabTop + 16}l10-14h${d.cab - 18}q6 0 6 6V${ground - 12}z`} fill={body} stroke={trim} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={`M8 ${cabTop + 16}l7-10h${d.cab - 26}v14H8z`} fill="#BFE6F7" stroke={trim} strokeWidth="1.2" />
      <rect x="2" y={ground - 16} width="6" height="4" rx="1" fill="#FFB000" />
      {/* chassis */}
      <rect x="2" y={ground - 12} width={W - 8} height="5" rx="2" fill={trim} />
      {/* wheels */}
      {d.axles.map((x, i) => (
        <g key={i} transform={`translate(${x} ${ground - 4})`}>
          <circle r="9.5" fill="#111827" /><circle r="4" fill="#9CA3AF" />
          <path d="M0-3v6M-3 0h6" stroke="#4B5563" strokeWidth="1.2" className={spin ? "origin-center animate-[spin_.7s_linear_infinite] [transform-box:fill-box]" : undefined} />
        </g>
      ))}
      {state === "alert" && (
        <g transform={`translate(${W - 16} 14)`}><circle r="10" fill="#B91C1C" /><path d="M0-5v5.5M0 4.5v.1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></g>
      )}
    </svg>
  );
}
