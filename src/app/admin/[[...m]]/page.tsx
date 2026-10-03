import { ADMIN_MODS } from "@/components/admin/adminNav";
import { AdminRouter } from "@/components/admin/AdminRouter";

export const dynamicParams = false;

export function generateStaticParams() {
  return ADMIN_MODS.map((m) => ({ m: m.slug ? [m.slug] : [] }));
}

export default async function Page({ params }: { params: Promise<{ m?: string[] }> }) {
  const { m } = await params;
  return <AdminRouter slug={m?.[0] ?? ""} />;
}
