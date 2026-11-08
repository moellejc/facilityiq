import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function AssetCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  return (
    <div>
      <PageIntro
        title="Asset costs"
        description="Only assets with stored cost rows appear. Missing cost is not shown as zero."
      />
      <FacilityAnalytics
        context={context}
        query={query}
        pathname="/finance/asset-costs"
        focus="asset-costs"
      />
    </div>
  );
}
