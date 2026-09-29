"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useState, type ComponentProps, type ReactNode } from "react";

/** Leaflet touches `window`, so it is client-only. */
const KMap = dynamic(() => import("./KMap"), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

function MapPlaceholder() {
  return (
    <div className="skeleton absolute inset-0 grid place-items-center" role="status" aria-label="در حال بارگذاری نقشه">
      <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm text-ink-3 shadow-soft"><Loader2 className="size-4 animate-spin" />در حال بارگذاری نقشه…</span>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="absolute inset-0 grid place-items-center bg-surface-3 p-4 text-center">
        <div className="space-y-3">
          <p className="font-bold">نقشه بارگذاری نشد</p>
          <p className="text-sm text-ink-3">اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</p>
          <button type="button" className="h-11 rounded-full bg-brand-500 px-5 font-bold" onClick={() => { this.setState({ failed: false }); this.props.onRetry(); }}>تلاش دوباره</button>
        </div>
      </div>
    );
  }
}

/** Wrapper owns the box; KMap fills it. Skeleton while loading, distinct state when it fails. */
export function MapView({ className, ...props }: ComponentProps<typeof KMap>) {
  const [k, setK] = useState(0);
  return (
    <div className={`relative ${className ?? ""}`}>
      <Boundary key={k} onRetry={() => setK((n) => n + 1)}>
        <KMap {...props} className="absolute inset-0" />
      </Boundary>
    </div>
  );
}
