"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "order" | "origin" | "dest" | "truck" | "dot";
  label?: string;
  selected?: boolean;
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
  className?: string;
}

const IRAN: [number, number] = [32.4, 53.7];

/**
 * Tile source is isolated here on purpose: to move to Neshan/Balad, replace
 * the URL/attribution below (or plug their SDK) — no other file cares.
 */
const TILES = { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" };

const pinHtml = (m: MapMarker, isNew: boolean) => {
  const glyph = m.kind === "truck" ? "🚚" : m.kind === "origin" ? "مبدأ" : m.kind === "dest" ? "مقصد" : m.label ?? "";
  return `<div class="km-pin ${m.kind} ${m.selected ? "sel" : ""} ${isNew ? "new" : ""}">${m.kind === "dot" ? "" : glyph}</div>`;
};

export default function KMap({ markers = [], circles = [], lines = [], onMarkerClick, onMapClick, fitKey, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pins = useRef(new Map<string, { m: L.Marker; sig: string }>());
  const seenFirst = useRef(false);
  const clickRef = useRef(onMarkerClick);
  const mapClickRef = useRef(onMapClick);
  const lastFit = useRef<string | undefined>(undefined);
  clickRef.current = onMarkerClick;
  mapClickRef.current = onMapClick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: IRAN, zoom: 5, zoomControl: false, attributionControl: true });
    L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: 18 }).addTo(m);
    L.control.zoom({ position: "bottomleft" }).addTo(m);
    m.on("click", (e) => mapClickRef.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      pins.current.clear();
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;

    // Markers: diffed so only genuinely new pins animate in.
    const ids = new Set(markers.map((x) => x.id));
    for (const [id, p] of pins.current) {
      if (!ids.has(id)) {
        g.removeLayer(p.m);
        pins.current.delete(id);
      }
    }
    for (const mk of markers) {
      const sig = `${mk.kind}|${mk.label}|${mk.selected}`;
      const cur = pins.current.get(mk.id);
      if (cur) {
        cur.m.setLatLng([mk.lat, mk.lng]);
        if (cur.sig !== sig) {
          cur.m.setIcon(L.divIcon({ html: pinHtml(mk, false), className: "", iconSize: [0, 0] }));
          cur.sig = sig;
        }
      } else {
        const marker = L.marker([mk.lat, mk.lng], {
          icon: L.divIcon({ html: pinHtml(mk, seenFirst.current), className: "", iconSize: [0, 0] }),
          keyboard: false,
          zIndexOffset: mk.selected ? 500 : 0,
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          clickRef.current?.(mk.id);
        });
        marker.addTo(g);
        pins.current.set(mk.id, { m: marker, sig });
      }
    }
    if (markers.length) seenFirst.current = true;

    // Circles and lines are cheap: rebuild.
    g.eachLayer((l) => {
      if (!(l instanceof L.Marker)) g.removeLayer(l);
    });
    for (const c of circles) {
      const color = c.tone === "accent" ? "#146eb4" : "#ffb000";
      L.circle([c.lat, c.lng], { radius: c.radius, color, weight: 2, fillColor: color, fillOpacity: 0.16, interactive: false }).addTo(g);
    }
    for (const l of lines) {
      L.polyline(l.points, {
        color: l.tone === "brand" ? "#ffb000" : "#146eb4", weight: 4, opacity: 0.85, dashArray: l.dashed ? "2 10" : undefined, lineCap: "round",
      }).addTo(g);
    }

    if (fitKey !== lastFit.current) {
      const pts: L.LatLngExpression[] = [
        ...markers.map((x) => [x.lat, x.lng] as [number, number]),
        ...circles.map((x) => [x.lat, x.lng] as [number, number]),
      ];
      if (pts.length) {
        lastFit.current = fitKey;
        m.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 11, animate: false });
      }
    }
  }, [markers, circles, lines, fitKey]);

  return <div ref={el} className={className} style={{ minHeight: 240 }} />;
}
