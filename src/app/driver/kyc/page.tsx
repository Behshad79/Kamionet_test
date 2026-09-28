"use client";

import { AppShell } from "@/components/AppShell";
import { KycWizard } from "@/components/KycWizard";

export default function Kyc() {
  return (
    <AppShell area="driver">
      <h1 className="mb-1 text-2xl font-black">احراز هویت راننده</h1>
      <p className="mb-5 text-sm text-ink-3">یک‌بار مدارک را کامل کنید تا بتوانید سفارش انتخاب کنید.</p>
      <KycWizard />
    </AppShell>
  );
}
