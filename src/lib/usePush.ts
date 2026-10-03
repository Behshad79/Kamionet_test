"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/Toaster";
import type { Notification as AppNotification, PortalId } from "./types";

export const pushSupported = () => typeof window !== "undefined" && "Notification" in window;

export async function enablePush(): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  return Notification.requestPermission();
}

/**
 * Turns every *new* in-app notification into a visible alert: an in-app banner always, plus an OS/browser push
 * (through the service worker) when the user allowed it. SMS copies of the key events live in `state.sms`.
 */
export function usePushBridge(list: AppNotification[], portal: PortalId, ready: boolean) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!seen.current) { seen.current = new Set(list.map((n) => n.id)); return; }
    const fresh = list.filter((n) => !seen.current!.has(n.id) && !n.read && n.kind !== "new_order");
    for (const n of fresh) {
      seen.current.add(n.id);
      toast(n.text, "info");
      if (pushSupported() && Notification.permission === "granted") {
        const opts: NotificationOptions = { body: n.text, dir: "rtl", lang: "fa", tag: n.id, icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons/icon-192.png`, data: { href: n.href } };
        navigator.serviceWorker?.ready.then((r) => r.showNotification("کامیونت", opts)).catch(() => new Notification("کامیونت", opts));
      }
    }
  }, [list, portal, ready]);
}
