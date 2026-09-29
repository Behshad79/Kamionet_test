"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button, Card, cx, ButtonLink } from "@/components/ui";
import { fa } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { expiryStatus } from "@/lib/matching";

export function DriverBanner() {
  const { driver, standing } = useApp();
  const ex = expiryStatus(driver);
  if (standing === "verified" && !ex.soon.length) return null;
  const cfg = {
    none: { t: "برای انتخاب سفارش، احراز هویت راننده را کامل کنید.", cta: "شروع احراز هویت", tone: "bg-brand-50" },
    draft: { t: "مدارک شما هنوز کامل نیست؛ ادامه دهید تا سریع‌تر تأیید شوید.", cta: "ادامه‌ی مدارک", tone: "bg-brand-50" },
    pending: { t: "مدارک شما در حال بررسی است (معمولاً کمتر از ۲۴ ساعت). تا آن موقع می‌توانید بارها را ببینید.", cta: "", tone: "bg-accent-50" },
    rejected: { t: `مدارک نیاز به اصلاح دارد: ${driver?.rejectReason ?? ""}`, cta: "اصلاح مدارک", tone: "bg-danger-bg" },
    suspended: { t: `حساب شما به‌دلیل انقضای ${ex.expired.map((e) => e.label).join(" و ")} معلق شد. مدرک جدید را بارگذاری کنید.`, cta: "به‌روزرسانی مدارک", tone: "bg-danger-bg" },
    verified: { t: `${ex.soon.map((e) => `${e.label} تا ${fa(e.days ?? 0)} روز دیگر`).join(" و ")} منقضی می‌شود؛ پس از انقضا حساب معلق خواهد شد.`, cta: "تمدید مدارک", tone: "bg-warn-bg" },
  }[standing];
  return (
    <Card className={cx("mb-4 flex animate-rise flex-wrap items-center gap-3 p-4 shadow-none", cfg.tone)}>
      {standing === "verified" ? <AlertTriangle className="size-5 shrink-0 text-warn" /> : <ShieldAlert className="size-5 shrink-0" />}
      <p className="min-w-0 flex-1 text-sm font-medium leading-7">{cfg.t}</p>
      {cfg.cta && <ButtonLink href="/driver/kyc/" size="sm">{cfg.cta}</ButtonLink>}
    </Card>
  );
}
