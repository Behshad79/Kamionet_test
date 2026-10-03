"use client";

import { useSyncExternalStore } from "react";
import { act } from "./store";
import { arriveDelivery, deliver, startTrip } from "./engine/orders";
import type { Media } from "./types";

/**
 * Offline-tolerant action queue for the driver app: actions that carry photos are applied immediately
 * when online, otherwise stored (localStorage) and replayed when the connection returns.
 */
export type Job =
  | { id: string; kind: "startTrip"; driverId: string; orderId: string; cargo: Media; invoice: Media; items?: number }
  | { id: string; kind: "deliver"; driverId: string; orderId: string; otp: string; invoice: Media; items?: number; cashReceived?: number };

type DistOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type JobInput = DistOmit<Job, "id">;
const KEY = "kamionet:queue";
const subs = new Set<() => void>();
let cache: Job[] | null = null;
let attempted = new Set<string>();
const read = (): Job[] => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; } return cache!; };
const write = (j: Job[]) => { cache = j; try { localStorage.setItem(KEY, JSON.stringify(j)); } catch { /* storage full: keep in memory */ } subs.forEach((s) => s()); };

function run(j: Job) {
  return act((s) => (j.kind === "startTrip" ? startTrip(s, j.driverId, j.orderId, { cargo: j.cargo, invoice: j.invoice, items: j.items }) : deliver(s, j.driverId, j.orderId, { otp: j.otp, invoice: j.invoice, items: j.items, cashReceived: j.cashReceived })));
}

export function submitJob(j: JobInput): { queued: boolean; result?: ReturnType<typeof run> } {
  const job = { ...j, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` } as Job;
  if (typeof navigator !== "undefined" && navigator.onLine === false) { write([...read(), job]); return { queued: true }; }
  return { queued: false, result: run(job) };
}

export function flushQueue() {
  const jobs = read();
  if (!jobs.length || navigator.onLine === false) return [];
  const failed: { job: Job; error: string }[] = [];
  const keep: Job[] = [];
  for (const j of jobs) {
    if (attempted.has(j.id)) { keep.push(j); continue; }
    attempted.add(j.id);
    const r = run(j);
    if (!r.ok) failed.push({ job: j, error: r.error });
  }
  write(keep);
  attempted = new Set();
  return failed;
}

if (typeof window !== "undefined") window.addEventListener("online", () => { flushQueue(); });

export const queuedFor = (orderId: string) => read().filter((j) => j.orderId === orderId);
export function useQueueCount() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => read().length, () => 0);
}
void arriveDelivery;
