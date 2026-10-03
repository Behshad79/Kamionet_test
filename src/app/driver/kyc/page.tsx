"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { InReview, KycWizard } from "@/components/driver/KycWizard";
import { Rejected, Suspended, isLive } from "@/components/driver/Stages";
import { Skeleton } from "@/components/ui";
import { usePortal } from "@/lib/hooks";

/** Identity + documents. The load board is open to everyone; this is where the sign-up / verification step lives. */
export default function Page() {
  const { me, driver, stage, ready } = usePortal("driver");
  const router = useRouter();
  const done = isLive(stage);
  useEffect(() => { if (ready && done) router.replace("/driver/"); }, [ready, done, router]);
  if (!ready || !me || done) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (stage === "suspended") return <Suspended pid={me.id} />;
  if (stage === "in_review") return <InReview submittedAt={driver?.kyc.submittedAt} />;
  if (stage === "rejected") return <Rejected pid={me.id} reasons={driver?.kyc.rejectReasons ?? []} />;
  return <KycWizard pid={me.id} />;
}
