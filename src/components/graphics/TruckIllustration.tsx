import { useId } from "react";
import { VEHICLES, VEHICLE_COLORS } from "@/lib/vehicles";
import type { Silhouette, VehicleKind } from "@/lib/types";

export type TruckState = "idle" | "driving" | "cooling" | "alert";

/* ───────── colour helpers ───────── */
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function mix(hex: string, to: number, amt: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(v + (to - v) * amt));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
const lum = (hex: string) => { const n = parseInt(hex.replace("#", ""), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const hexOf = (c: string) => VEHICLE_COLORS.find((x) => x.id === c)?.hex ?? (c.startsWith("#") ? c : "#F3F4F6");

/* ───────── per-silhouette geometry (all facing left; ground y = 100) ───────── */
interface Spec { hood?: boolean; cab: number; box: number; boxH: number; r: number; front: number[]; rear: number[]; /** rear axle x as offset from the right edge */ trailer?: boolean; stack?: boolean; unit: number; tractor?: number[] }
const SPEC: Record<Silhouette, Spec> = {
  pickup: { hood: true, cab: 64, box: 92, boxH: 44, r: 10, front: [22], rear: [-26], unit: 0.7 },
  small: { cab: 52, box: 112, boxH: 56, r: 10.5, front: [24], rear: [-28], unit: 0.85 },
  mid: { cab: 56, box: 134, boxH: 62, r: 11, front: [26], rear: [-30], unit: 0.95 },
  heavy: { cab: 60, box: 164, boxH: 68, r: 11.5, front: [27], rear: [-30, -56], stack: true, unit: 1.05 },
  trailer: { cab: 60, box: 232, boxH: 76, r: 11.5, front: [27], rear: [-14, -40, -66], tractor: [74, 100], trailer: true, stack: true, unit: 1.1 },
};

/**
 * Vector side-view of a refrigerated vehicle. Faces left (RTL reading direction); body colour is live.
 * Layers: ground shadow → chassis → box (gradient, ribs, door) → reefer unit → cab (glass, door, lights) → wheels.
 */
export function TruckIllustration({ kind, silhouette, color = "white", state = "idle", className, label, reefer = true }: {
  kind?: VehicleKind; silhouette?: Silhouette; color?: string; state?: TruckState; className?: string; label?: string; reefer?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const sil: Silhouette = silhouette ?? (kind ? VEHICLES[kind].silhouette : "heavy");
  const dry = kind ? !VEHICLES[kind].fridge : false;
  const sp = SPEC[sil];
  const base = hexOf(color);
  const light = mix(base, 255, 0.28);
  const dark = mix(base, 0, 0.22);
  const edge = mix(base, 0, 0.45);
  const isDark = lum(base) < 0.35;
  const ink = isDark ? "#E5E7EB" : "#111827";
  const W = sp.cab + (sp.trailer ? 26 : 6) + sp.box + 12;
  const g = 100;
  const cy = g - sp.r - 1;
  const chTop = g - sp.r * 2 - 5; // chassis rail top
  const boxBottom = chTop - 1;
  const boxTop = boxBottom - sp.boxH;
  const bx = sp.cab + (sp.trailer ? 26 : 6);
  const bw = sp.box;
  const cabH = sp.hood ? 54 : sp.trailer ? 62 : sp.boxH - 4;
  const cabTop = chTop - 2 - cabH;
  const spin = state === "driving";
  const vbTop = Math.min(0, Math.floor(boxTop - 16 * sp.unit));
  const wheel = (x: number, i: number) => (
    <g key={i} transform={`translate(${x} ${cy})`}>
      <path d={`M${-sp.r - 2.5} 0 a${sp.r + 2.5} ${sp.r + 2.5} 0 0 1 ${(sp.r + 2.5) * 2} 0z`} fill="#0f1218" transform="translate(0 -1)" />
      <circle r={sp.r} fill="#1a1d24" />
      <circle r={sp.r - 2.2} fill="none" stroke="#2b303b" strokeWidth="1.2" />
      <circle r={sp.r * 0.55} fill={`url(#${uid}rim)`} />
      <g className={spin ? "origin-center animate-[spin_.6s_linear_infinite] [transform-box:fill-box]" : undefined}>
        {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * sp.r * 0.34} cy={Math.sin((a * Math.PI) / 180) * sp.r * 0.34} r="0.9" fill="#4b5563" />)}
        <path d={`M0 ${-sp.r * 0.5}v${sp.r}`} stroke="#6b7280" strokeWidth=".8" opacity=".6" />
      </g>
      <circle r="1.6" fill="#374151" />
    </g>
  );

  /* cab outline ------------------------------------------------------------------ */
  const cabPath = sp.hood
    ? `M2 ${chTop - 2} V${cabTop + 36} Q2 ${cabTop + 30} 8 ${cabTop + 28} L26 ${cabTop + 22} L40 ${cabTop + 2} Q42 ${cabTop} 46 ${cabTop} H${sp.cab - 6} Q${sp.cab} ${cabTop} ${sp.cab} ${cabTop + 6} V${chTop - 2} Z`
    : `M2 ${chTop - 2} V${cabTop + 14} Q2 ${cabTop + 6} 9 ${cabTop + 3} L${12} ${cabTop} H${sp.cab - 8} Q${sp.cab - 1} ${cabTop} ${sp.cab - 1} ${cabTop + 7} V${chTop - 2} Z`;
  const glass = sp.hood
    ? `M31 ${cabTop + 20} L42 ${cabTop + 6} H${sp.cab - 12} Q${sp.cab - 8} ${cabTop + 6} ${sp.cab - 8} ${cabTop + 10} V${cabTop + 22} Z`
    : `M12 ${cabTop + 7} Q14 ${cabTop + 4} 18 ${cabTop + 4} H${sp.cab - 14} Q${sp.cab - 9} ${cabTop + 4} ${sp.cab - 9} ${cabTop + 9} V${cabTop + 28} H8 V${cabTop + 16} Z`;
  const doorL = sp.hood ? 30 : 11;

  return (
    <svg viewBox={`0 ${vbTop} ${W} ${110 - vbTop}`} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} fill="none">
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={light} /><stop offset=".55" stopColor={base} /><stop offset="1" stopColor={dark} /></linearGradient>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9f0ff" /><stop offset="1" stopColor="#7fb8d9" /></linearGradient>
        <radialGradient id={`${uid}rim`} cx=".35" cy=".35" r=".8"><stop offset="0" stopColor="#e5e7eb" /><stop offset="1" stopColor="#6b7280" /></radialGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".0" /><stop offset=".5" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>

      <ellipse cx={W / 2} cy={g + 4} rx={W / 2 - 4} ry="3.5" fill="#0f172a" opacity=".12" />

      {/* chassis */}
      <rect x="4" y={chTop} width={W - 10} height="5" rx="2" fill="#1f2430" />
      {sp.trailer && <rect x={sp.cab - 8} y={chTop - 4} width="28" height="6" rx="2" fill="#2b303b" />}
      {sp.trailer && <rect x={sp.cab + 2} y={chTop + 4} width="3" height="10" fill="#2b303b" />}
      {!sp.trailer && !sp.hood && <rect x={sp.cab + 8} y={chTop + 4} width={Math.min(34, bw * 0.22)} height="10" rx="4" fill="#4b5563" stroke="#1f2430" strokeWidth=".8" />}
      <rect x={W - 12} y={chTop + 3} width="8" height="3" rx="1" fill="#1f2430" />

      {/* cargo box */}
      <rect x={bx} y={boxTop} width={bw} height={sp.boxH} rx="5" fill={`url(#${uid}b)`} stroke={edge} strokeWidth="1.2" />
      <rect x={bx + 2} y={boxTop + 2} width={bw - 4} height="5" rx="2.5" fill="#fff" opacity=".22" />
      {Array.from({ length: Math.floor(bw / 22) }, (_, i) => <path key={i} d={`M${bx + 14 + i * 22} ${boxTop + 9}V${boxBottom - 7}`} stroke={edge} strokeOpacity=".16" strokeWidth="1" />)}
      <rect x={bx} y={boxBottom - 5} width={bw} height="5" rx="2" fill={edge} opacity=".55" />
      <path d={`M${bx + bw - 10} ${boxTop + 4}V${boxBottom - 4}`} stroke={edge} strokeOpacity=".5" strokeWidth="1.2" />
      <rect x={bx + bw - 8} y={boxTop + sp.boxH / 2 - 4} width="2.2" height="9" rx="1" fill={edge} opacity=".8" />
      <rect x={bx + bw - 5} y={boxBottom - 14} width="4" height="8" rx="1.2" fill="#dc2626" />
      <rect x={bx + 6} y={boxTop + sp.boxH / 2 - 7} width={bw * 0.28} height="14" rx="3" fill="#fff" opacity=".0" />

      {/* reefer unit + snowflake badge */}
      {reefer && !dry && (
        <g>
          <rect x={bx + 2} y={boxTop - 11 * sp.unit} width={24 * sp.unit} height={11 * sp.unit + 4} rx="2.5" fill="#273043" />
          {[0, 1, 2].map((i) => <rect key={i} x={bx + 5 + i * 5 * sp.unit} y={boxTop - 8 * sp.unit} width={3 * sp.unit} height={7 * sp.unit} rx="1" fill="#fff" opacity=".28" />)}
          <g transform={`translate(${bx + bw / 2 + 4} ${boxTop + sp.boxH / 2 - 2})`} stroke={state === "alert" ? "#DC2626" : "#146EB4"} strokeWidth="2.2" strokeLinecap="round" opacity=".95">
            <path d="M0-10v20M-8.7-5l17.4 10M-8.7 5l17.4-10" />
            <path d="M-2.4-8.2 0-6l2.4-2.2M-2.4 8.2 0 6l2.4 2.2" strokeWidth="1.4" />
          </g>
        </g>
      )}
      {dry && <g transform={`translate(${bx + bw / 2 + 4} ${boxTop + sp.boxH / 2})`} stroke={edge} strokeWidth="2" opacity=".45"><rect x="-10" y="-7" width="20" height="14" rx="2" /><path d="M-10-1h20" /></g>}

      {/* cab */}
      <path d={cabPath} fill={`url(#${uid}b)`} stroke={edge} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={glass} fill={`url(#${uid}g)`} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
      <path d={glass} fill={`url(#${uid}s)`} opacity=".6" />
      <path d={`M${doorL} ${cabTop + 6}V${chTop - 4}M${sp.cab - 10} ${cabTop + 8}V${chTop - 4}`} stroke={edge} strokeOpacity=".4" strokeWidth="1" />
      <rect x={sp.cab - 20} y={cabTop + (sp.hood ? 30 : 36)} width="8" height="2.6" rx="1.3" fill={edge} opacity=".8" />
      <rect x="3" y={cabTop + (sp.hood ? 36 : 30)} width="4" height="8" rx="2" fill="#fde68a" stroke="#f59e0b" strokeWidth=".8" />
      <rect x="1" y={chTop - 8} width="12" height="6" rx="2" fill="#1f2430" />
      <rect x={sp.hood ? 8 : 5} y={cabTop + (sp.hood ? 30 : 22)} width="3" height="12" rx="1.5" fill="#111827" opacity=".85" />
      {sp.stack && <rect x={sp.cab - 4} y={cabTop - 10} width="3" height={cabH * 0.7} rx="1.5" fill="#6b7280" />}
      {!sp.hood && <rect x="14" y={cabTop - 3} width={sp.cab - 28} height="3" rx="1.5" fill="#f59e0b" opacity=".0" />}

      {/* wheels */}
      {[...sp.front, ...(sp.tractor ?? []), ...sp.rear.map((o) => W + o)].map(wheel)}

      {state === "alert" && <g transform={`translate(${W - 14} 12)`}><circle r="10" fill="#B91C1C" /><path d="M0-5v5.5M0 4.5v.1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></g>}
    </svg>
  );
}
