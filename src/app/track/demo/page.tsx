"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Static hosting has no dynamic route, so the sample link redirects to the tokenised page. */
export default function Page() {
  const r = useRouter();
  useEffect(() => { r.replace("/track/?t=demo"); }, [r]);
  return null;
}
