"use client";

import { useEffect, useState } from "react";
import { driverStage } from "./engine/drivers";
import { adminOf, driverOf, person, shipperOf } from "./engine/core";
import { hydrate, tick, useStore } from "./store";
import type { PortalId } from "./types";

/** Everything a portal screen needs about "who am I" — one portal, one session, no role switch. */
export function usePortal(portal: PortalId) {
  const s = useStore();
  const sess = s.session[portal];
  const me = sess.personId ? person(s, sess.personId) : undefined;
  const admin = sess.adminId ? adminOf(s, sess.adminId) : undefined;
  const shipper = portal === "shipper" ? shipperOf(s, me?.id) : undefined;
  const driver = portal === "driver" ? driverOf(s, me?.id) : undefined;
  return {
    s,
    ready: s.ready,
    me,
    admin,
    shipper,
    driver,
    stage: portal === "driver" ? driverStage(s, driver) : undefined,
    signedIn: portal === "admin" ? !!admin : !!me,
    unread: s.notifications.filter((n) => n.personId === me?.id && n.portal === portal && !n.read).length,
  };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Boots the mock backend once on the client and drives time-based transitions. */
export function useBoot() {
  useEffect(() => {
    hydrate();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
}

/** Read a query param on the client (static export has no dynamic routes). */
export function useQueryParam(name = "id") {
  const [v, setV] = useState<string | null | undefined>(undefined);
  useEffect(() => setV(new URLSearchParams(window.location.search).get(name)), [name]);
  return v;
}
export const useQueryId = () => useQueryParam("id");
