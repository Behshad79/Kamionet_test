"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "./ui";

/** Leaflet touches `window`, so it is client-only. */
export const MapView = dynamic(() => import("./KMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-60 w-full rounded-none" />,
});
