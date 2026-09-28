"use client";

import { useBoot } from "@/lib/hooks";
import { Toaster } from "./Toaster";

export function Boot() {
  useBoot();
  return <Toaster />;
}
