import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function OperatingCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  return (
    <div>
      <PageIntro
        title="Operating costs"
        description="Labor, maintenance, energy, equipment, and overhead summed from stored cost rows."
      />
      <FacilityAnalytics
        context={context}
        query={query}
        pathname="/finance/operating-costs"
        focus="costs"
      />
    </div>
  );
}
