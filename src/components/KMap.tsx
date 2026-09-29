"use client";

import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "order" | "origin" | "dest" | "truck" | "dot" | "cluster";
  label?: string;
  selected?: boolean;
  /** Set on cluster markers: member coordinates, used to zoom into the group. */
  members?: [number, number][];
}
export interface MapCircle { id: string; lat: number; lng: number; radius: number; tone?: "brand" | "accent" }
export interface MapLine { id: string; points: [number, number][]; dashed?: boolean; tone?: "brand" | "accent" }

interface Props {
  markers?: MapMarker[];
  circles?: MapCircle[];
  lines?: MapLine[];
  onMarkerClick?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  /** Re-fit the viewport whenever this value changes. */
  fitKey?: string;
  /** Group nearby `order` markers into count bubbles. */
  cluster?: boolean;
  className?: string;
}

/** Iran's borders; the default view and the pan limit, so neighbouring countries' labels stay out of frame. */
const IRAN_BOUNDS: L.LatLngBoundsExpression = [[25.0, 44.0], [39.8, 63.4]];
const PAN_LIMIT: L.LatLngBoundsExpression = [[22.0, 41.0], [42.0, 66.0]];

/**
 * Tile source is isolated here. To use a Persian-labelled provider (Neshan,
 * Map.ir) set NEXT_PUBLIC_TILE_URL (+ NEXT_PUBLIC_TILE_ATTRIBUTION) at build
 * time; the default is OpenStreetMap, which needs no key.
 */
const TILES = {
  url: process.env.NEXT_PUBLIC_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || "© OpenStreetMap",
};

const TRUCK_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

const pinHtml = (m: MapMarker, isNew: boolean) => {
  const glyph = m.kind === "truck" ? TRUCK_SVG : m.kind === "origin" ? "مبدأ" : m.kind === "dest" ? "مقصد" : m.label ?? "";
  return `<div class="km-pin ${m.kind} ${m.selected ? "sel" : ""} ${isNew ? "new" : ""}">${m.kind === "dot" ? "" : glyph}</div>`;
};

const CELL = 104; // px, sized for the wide "۱۴ میلیون تومان" price pills

function clusterize(m: L.Map, list: MapMarker[]): MapMarker[] {
  const z = m.getZoom();
  const cells = new Map<string, MapMarker[]>();
  const out: MapMarker[] = [];
  for (const mk of list) {
    if (mk.kind !== "order" || mk.selected) { out.push(mk); continue; }
    const p = m.project([mk.lat, mk.lng], z);
    const key = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(mk);
  }
  for (const [key, group] of cells) {
    if (group.length === 1) { out.push(group[0]); continue; }
    const lat = group.reduce((n, g) => n + g.lat, 0) / group.length;
    const lng = group.reduce((n, g) => n + g.lng, 0) / group.length;
    out.push({ id: `cl:${key}:${group.length}`, lat, lng, kind: "cluster", label: new Intl.NumberFormat("fa-IR").format(group.length), members: group.map((g) => [g.lat, g.lng]) });
  }
  return out;
}

export default function KMap({ markers = [], circles = [], lines = [], onMarkerClick, onMapClick, fitKey, cluster, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const pins = useRef(new Map<string, { m: L.Marker; sig: string }>());
  const clusterPts = useRef(new Map<string, [number, number][]>());
  const seenFirst = useRef(false);
  const clickRef = useRef(onMarkerClick);
  const mapClickRef = useRef(onMapClick);
  const lastFit = useRef<string | undefined>(undefined);
  const pendingFit = useRef(false);
  const [zoomTick, setZoomTick] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  clickRef.current = onMarkerClick;
  mapClickRef.current = onMapClick;

  const fit = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const size = m.getSize();
    if (size.x < 10 || size.y < 10) { pendingFit.current = true; return; }
    pendingFit.current = false;
    const pts: L.LatLngExpression[] = [];
    for (const p of pins.current.values()) pts.push(p.m.getLatLng());
    for (const c of latestGeo.current.circles) pts.push([c.lat, c.lng]);
    for (const l of latestGeo.current.lines) pts.push(...l.points);
    for (const mk of latestGeo.current.markers) pts.push([mk.lat, mk.lng]);
    if (!pts.length) { m.fitBounds(IRAN_BOUNDS, { animate: false }); return; }
    const b = L.latLngBounds(pts);
    if (b.getNorthEast().equals(b.getSouthWest())) m.setView(b.getCenter(), 10, { animate: false });
    else m.fitBounds(b, { padding: [48, 48], maxZoom: 11, animate: false });
  }, []);
  const latestGeo = useRef({ markers, circles, lines });
  latestGeo.current = { markers, circles, lines };

  /* Map + tiles: created once. */
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      zoomControl: false, attributionControl: true, minZoom: 5, maxBounds: PAN_LIMIT, maxBoundsViscosity: 0.9,
    });
    m.fitBounds(IRAN_BOUNDS, { animate: false });
    const tl = L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: 18 }).addTo(m);
    tiles.current = tl;
    let errors = 0;
    let loaded = false;
    const timer = setTimeout(() => { if (!loaded) setStatus("error"); }, 9000);
    tl.on("tileload", () => { loaded = true; errors = 0; setStatus("ready"); });
    tl.on("tileerror", () => { errors += 1; if (!loaded && errors >= 4) setStatus("error"); });
    L.control.zoom({ position: "topleft" }).addTo(m);
    m.on("click", (e) => mapClickRef.current?.(e.latlng.lat, e.latlng.lng));
    m.on("zoomend", () => setZoomTick((z) => z + 1));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;

    // The container is often 0px tall when the map mounts (lazy chunk, hidden step);
    // re-measure on every resize and honour any fit that had to wait for a real size.
    const ro = new ResizeObserver(() => {
      m.invalidateSize({ animate: false });
      if (pendingFit.current || !lastFit.current) fit();
    });
    ro.observe(el.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      m.remove();
      map.current = null;
      pins.current.clear();
    };
  }, [fit]);

  const retry = () => {
    const tl = tiles.current;
    if (!tl) return;
    setStatus("loading");
    tl.redraw();
    setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), 9000);
  };

  /* Layers: diffed markers, rebuilt circles/lines. */
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;

    const shown = cluster ? clusterize(m, markers) : markers;
    clusterPts.current.clear();
    for (const s of shown) if (s.members) clusterPts.current.set(s.id, s.members);

    const ids = new Set(shown.map((x) => x.id));
    for (const [id, p] of pins.current) {
      if (!ids.has(id)) { g.removeLayer(p.m); pins.current.delete(id); }
    }
    for (const mk of shown) {
      const sig = `${mk.kind}|${mk.label}|${mk.selected}`;
      const cur = pins.current.get(mk.id);
      if (cur) {
        cur.m.setLatLng([mk.lat, mk.lng]);
        if (cur.sig !== sig) { cur.m.setIcon(L.divIcon({ html: pinHtml(mk, false), className: "", iconSize: [0, 0] })); cur.sig = sig; }
      } else {
        const marker = L.marker([mk.lat, mk.lng], {
          icon: L.divIcon({ html: pinHtml(mk, seenFirst.current), className: "", iconSize: [0, 0] }),
          keyboard: false,
          zIndexOffset: mk.selected ? 500 : mk.kind === "cluster" ? 200 : 0,
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const pts = clusterPts.current.get(mk.id);
          if (pts) m.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 13 });
          else clickRef.current?.(mk.id);
        });
        marker.addTo(g);
        pins.current.set(mk.id, { m: marker, sig });
      }
    }
    if (shown.length) seenFirst.current = true;

    g.eachLayer((l) => { if (!(l instanceof L.Marker)) g.removeLayer(l); });
    for (const c of circles) {
      const color = c.tone === "accent" ? "#146eb4" : "#ffb000";
      L.circle([c.lat, c.lng], { radius: c.radius, color, weight: 2, fillColor: color, fillOpacity: 0.16, interactive: false }).addTo(g);
    }
    for (const l of lines) {
      L.polyline(l.points, { color: l.tone === "brand" ? "#ffb000" : "#146eb4", weight: 4, opacity: 0.85, dashArray: l.dashed ? "2 10" : undefined, lineCap: "round" }).addTo(g);
    }

    if (fitKey !== lastFit.current) {
      if (markers.length || circles.length || lines.length) {
        lastFit.current = fitKey;
        fit();
      } else if (fitKey !== undefined) {
        lastFit.current = fitKey;
        m.fitBounds(IRAN_BOUNDS, { animate: false });
      }
    }
  }, [markers, circles, lines, fitKey, cluster, zoomTick, fit]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={el} className="absolute inset-0" />
      {status === "loading" && <div className="skeleton pointer-events-none absolute inset-0 z-[450] opacity-70" aria-hidden />}
      {status === "error" && (
        <div role="alert" className="absolute inset-x-3 top-3 z-[600] flex flex-wrap items-center gap-3 rounded-ui bg-white p-3 text-sm shadow-lift">
          <span className="min-w-0 flex-1 font-medium">نقشه بارگذاری نشد. اتصال اینترنت را بررسی کنید.</span>
          <button type="button" onClick={retry} className="h-10 rounded-full bg-brand-500 px-4 font-bold">تلاش دوباره</button>
        </div>
      )}
    </div>
  );
}
