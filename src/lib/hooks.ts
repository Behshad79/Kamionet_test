"use client";

import { useEffect, useState } from "react";
import { hydrate, tick, useStore } from "./store";
import { standing } from "./matching";

export function useApp() {
  const s = useStore();
  const me = s.users.find((u) => u.id === s.session.userId);
  const driver = s.drivers.find((d) => d.userId === me?.id);
  return {
    s,
    ready: s.ready,
    me,
    driver,
    role: s.session.role,
    admin: s.session.admin,
    standing: standing(driver),
    unread: s.notifications.filter((n) => n.userId === me?.id && !n.read).length,
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

/** Read `?id=` from the URL on the client (static export has no dynamic routes). */
export function useQueryId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id")), []);
  return id;
}
