import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;

  return (
    <div>
      <PageIntro
        title={`${context.organizationName}`}
        description={`${context.name?.split(" ")[0] ?? "Signed in"} · ${ROLE_LABELS[context.role]}. Cards and charts use the selected date range.`}
      />
      <FacilityAnalytics context={context} query={query} pathname="/dashboard" focus="overview" />
    </div>
  );
}
