import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function ThroughputPage() {
  return (
    <ComingNext
      title="Throughput"
      phase="Phase 3"
      description="Orders per hour and orders per day will be calculated from operational_metrics. The formula helpers exist and are tested; this screen does not display a number yet."
    />
  );
}
