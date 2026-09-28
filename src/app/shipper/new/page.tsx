"use client";

import { AppShell } from "@/components/AppShell";
import { OrderWizard } from "@/components/OrderWizard";

export default function NewOrder() {
  return (
    <AppShell area="shipper">
      <h1 className="mb-5 text-2xl font-black">ثبت سفارش حمل</h1>
      <OrderWizard />
    </AppShell>
  );
}
