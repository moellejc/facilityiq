import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { facilitySummary } from "@/server/repositories/facilities";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireRequestContext().catch(() => null);
  if (!context) redirect("/sign-in");

  let openInsights = 0;
  if (context.facilityId) {
    const summary = await facilitySummary(
      context.organizationId,
      context.userId,
      context.facilityId,
    );
    openInsights = summary?.openInsights ?? 0;
  }

  return (
    <AppShell
      model={{
        name: context.name,
        email: context.email,
        role: context.role,
        organizationId: context.organizationId,
        organizationName: context.organizationName,
        facilityId: context.facilityId,
        memberships: context.memberships.map((membership) => ({
          organizationId: membership.organizationId,
          name: membership.name,
          slug: membership.slug,
          role: membership.role,
        })),
        facilities: context.facilities.map((facility) => ({
          id: facility.id,
          name: facility.name,
        })),
        openInsights,
      }}
    >
      {children}
    </AppShell>
  );
}
