"use client";

import { Snowflake } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { placeByName } from "@/lib/places";
import { fa } from "@/lib/format";

/** Schematic outline of Iran (lng, lat). Stylised on purpose; not a survey-grade border. */
const OUTLINE: [number, number][] = [
  [44.0, 39.4], [45.0, 38.9], [46.2, 38.8], [47.4, 39.3], [48.0, 38.4], [49.0, 37.5], [50.3, 37.2], [51.5, 36.8], [53.0, 36.9], [54.0, 37.3], [55.4, 38.0], [56.5, 38.2],
  [57.4, 37.6], [59.0, 37.3], [60.0, 36.6], [61.2, 36.5], [60.6, 34.5], [60.9, 33.5], [60.6, 31.5], [61.8, 31.3], [61.7, 29.8], [63.3, 29.5], [62.4, 28.0], [61.6, 25.2],
  [59.0, 25.4], [57.3, 25.8], [56.9, 27.1], [56.0, 27.1], [54.5, 26.6], [53.5, 26.8], [52.5, 27.5], [51.3, 28.0], [50.5, 29.4], [49.4, 30.2], [48.6, 30.0], [47.9, 30.6],
  [47.7, 31.4], [47.6, 32.3], [46.1, 33.0], [45.4, 34.0], [45.7, 35.2], [45.1, 36.0], [44.8, 37.1], [44.2, 38.0], [44.4, 39.3],
];
const LNG0 = 43.5, LNG1 = 63.8, LAT0 = 24.8, LAT1 = 39.9;
const W = 640, H = Math.round(W * ((LAT1 - LAT0) / ((LNG1 - LNG0) * Math.cos((32 * Math.PI) / 180))));
export const project = (lat: number, lng: number): [number, number] => [((lng - LNG0) / (LNG1 - LNG0)) * W, (1 - (lat - LAT0) / (LAT1 - LAT0)) * H];

const ROUTES: { from: string; to: string; temp: number; label: string; speed: number }[] = [
  { from: "تهران", to: "مشهد", temp: -19.2, label: "انجمادی", speed: 0.045 },
  { from: "تهران", to: "شیراز", temp: 3.1, label: "لبنیات", speed: 0.05 },
  { from: "تبریز", to: "اصفهان", temp: 4.4, label: "سردخانه‌ای", speed: 0.04 },
  { from: "اهواز", to: "یزد", temp: 5.8, label: "دارو", speed: 0.055 },
  { from: "رشت", to: "کرمان", temp: -2.1, label: "گوشت", speed: 0.035 },
];

const CITIES = ["تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "اهواز", "رشت", "یزد", "کرمان", "بندرعباس", "ساری", "ارومیه"];

function curve(a: [number, number], b: [number, number]) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.12;
  return { d: `M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`, at: (t: number): [number, number] => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]] };
}

export function IranMap({ className }: { className?: string }) {
  const routes = useMemo(() => ROUTES.map((r) => {
    const a = placeByName(r.from)!, b = placeByName(r.to)!;
    return { ...r, ...curve(project(a.lat, a.lng), project(b.lat, b.lng)) };
  }), []);
  const [t, setT] = useState(() => routes.map((_, i) => 0.15 + i * 0.17));
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setT((p) => p.map((v, i) => (v + routes[i].speed * dt) % 1));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [routes]);
  const pts = OUTLINE.map(([lng, lat]) => project(lat, lng).join(",")).join(" ");
  return (
    <div className={className} dir="ltr">
      <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" role="img" aria-label="نقشه‌ی شماتیک ایران با مسیر کامیون‌های یخچال‌دار در حال حرکت">
          <defs>
            <linearGradient id="irg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8F6FC" /><stop offset="1" stopColor="#FFF8E6" /></linearGradient>
          </defs>
          <polygon points={pts} fill="url(#irg)" stroke="#146EB4" strokeOpacity=".35" strokeWidth="2" strokeLinejoin="round" />
          {routes.map((r, i) => <path key={i} d={r.d} fill="none" stroke="#146EB4" strokeOpacity=".55" strokeWidth="2" className="route-dash" />)}
          {CITIES.map((c) => { const p = placeByName(c); if (!p) return null; const [x, y] = project(p.lat, p.lng); return <circle key={c} cx={x} cy={y} r="3.5" fill="#fff" stroke="#111827" strokeWidth="1.6" />; })}
        </svg>
        {routes.map((r, i) => {
          const [x, y] = r.at(t[i]);
          return (
            <div key={i} className="absolute" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, translate: "-50% -50%" }}>
              <span className="relative grid size-7 place-items-center rounded-full bg-brand-500 shadow-lift ring-2 ring-white">
                <span className="live-ring absolute inset-0 rounded-full bg-brand-500/50" aria-hidden />
                <svg viewBox="0 0 24 24" className="relative size-4" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 16V7h11v9M13 10h5l3 3v3H13" /><circle cx="7" cy="17" r="1.8" fill="#fff" /><circle cx="17" cy="17" r="1.8" fill="#fff" /></svg>
              </span>
              {i < 3 && (
                <span dir="rtl" className="absolute start-full top-1/2 ms-1.5 hidden -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-accent-700 shadow-soft sm:flex">
                  <Snowflake className="size-3" aria-hidden /><span dir="ltr">{r.temp < 0 ? "−" : ""}{fa(Math.abs(r.temp))}°</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
