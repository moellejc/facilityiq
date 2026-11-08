import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function ThroughputPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  return (
    <div>
      <PageIntro
        title="Throughput"
        description="Orders per hour, orders per day, and units processed from facility-level samples."
      />
      <FacilityAnalytics
        context={context}
        query={query}
        pathname="/operations/throughput"
        focus="throughput"
      />
    </div>
  );
}
