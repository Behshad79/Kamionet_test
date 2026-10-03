"use client";

import { UserX } from "lucide-react";
import Link from "next/link";
import { DriverPublicProfile } from "@/components/driver/PublicProfile";
import { EmptyState, Skeleton } from "@/components/ui";
import { driverOf } from "@/lib/engine/core";
import { usePortal, useQueryId } from "@/lib/hooks";

export default function Page() {
  const id = useQueryId();
  const { s, ready } = usePortal("shipper");
  if (id === undefined || !ready) return <Skeleton className="h-96" />;
  const d = id ? driverOf(s, id) : undefined;
  if (!d) return <EmptyState icon={<UserX className="size-8" />} title="راننده پیدا نشد" action={<Link href="/app/" className="font-bold text-accent-600">بازگشت</Link>} />;
  return <div className="mx-auto max-w-2xl"><DriverPublicProfile d={d} s={s} /></div>;
}
