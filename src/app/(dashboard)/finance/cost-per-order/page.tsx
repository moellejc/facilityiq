import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function CostPerOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  return (
    <div>
      <PageIntro
        title="Cost per order"
        description="Operating cost divided by facility orders. A period with no orders stays unavailable."
      />
      <FacilityAnalytics
        context={context}
        query={query}
        pathname="/finance/cost-per-order"
        focus="cost-per-order"
      />
    </div>
  );
}
