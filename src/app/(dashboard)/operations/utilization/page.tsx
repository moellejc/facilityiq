import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function UtilizationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  return (
    <div>
      <PageIntro
        title="Utilization"
        description="Asset, area, and packing-station capacity utilization. Empty periods stay unavailable."
      />
      <FacilityAnalytics
        context={context}
        query={query}
        pathname="/operations/utilization"
        focus="utilization"
      />
    </div>
  );
}
