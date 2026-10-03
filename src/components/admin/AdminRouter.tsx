"use client";

import { Denied, useAdmin } from "./kit";
import { ADMIN_MODS, modAllowed } from "./adminNav";
import { DashboardModule, LiveModule } from "./modules/Overview";
import { DispatchModule, DisputesModule, OrdersModule } from "./modules/Orders";
import { DriversModule, KycModule, ProModule, ShippersModule } from "./modules/People";
import { ClaimsModule, DebtsModule, FinanceOverview, InvoicesModule, PayoutsModule, PaymentsModule, PromoModule, ReconModule, RefundsModule } from "./modules/Finance";
import { ApprovalsModule, AuditModule, BroadcastsModule, ConfigModule, MasterModule, ReviewsModule, RiskModule, RulesModule, SupportModule, SystemModule, TeamModule, WashesModule } from "./modules/Ops";
import { EmptyState } from "../ui";

const VIEWS: Record<string, () => React.ReactNode> = {
  "": () => <DashboardModule />, live: () => <LiveModule />, orders: () => <OrdersModule />, dispatch: () => <DispatchModule />, disputes: () => <DisputesModule />,
  drivers: () => <DriversModule />, kyc: () => <KycModule />, shippers: () => <ShippersModule />, pro: () => <ProModule />,
  finance: () => <FinanceOverview />, payments: () => <PaymentsModule />, payouts: () => <PayoutsModule />, refunds: () => <RefundsModule />, debts: () => <DebtsModule />,
  invoices: () => <InvoicesModule />, recon: () => <ReconModule />, promo: () => <PromoModule />, claims: () => <ClaimsModule />,
  support: () => <SupportModule />, reviews: () => <ReviewsModule />, washes: () => <WashesModule />, risk: () => <RiskModule />, broadcasts: () => <BroadcastsModule />,
  config: () => <ConfigModule />, rules: () => <RulesModule />, master: () => <MasterModule />, approvals: () => <ApprovalsModule />, team: () => <TeamModule />, audit: () => <AuditModule />, system: () => <SystemModule />,
};

export function AdminRouter({ slug }: { slug: string }) {
  const { has } = useAdmin();
  const mod = ADMIN_MODS.find((m) => m.slug === slug);
  const view = VIEWS[slug];
  if (!mod || !view) return <EmptyState icon={null} title="صفحه پیدا نشد" body="این بخش در کنسول مدیریت وجود ندارد." />;
  if (!modAllowed(mod, has)) return <Denied perm={Array.isArray(mod.perm) ? mod.perm[0] : mod.perm} />;
  return <>{view()}</>;
}
