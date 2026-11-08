import { FacilityAnalytics } from "@/components/dashboard/facility-analytics";
import { PageIntro } from "@/components/dashboard/coming-next";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function BottlenecksPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  return (
    <div>
      <PageIntro
        title="Bottlenecks"
        description="Count and mean severity from stored bottleneck samples, plus facility downtime."
      />
      <FacilityAnalytics
        context={context}
        query={query}
        pathname="/operations/bottlenecks"
        focus="bottlenecks"
      />
    </div>
  );
}
