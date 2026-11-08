import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function OperatingCostsPage() {
  return (
    <ComingNext
      title="Operating costs"
      phase="Phase 3"
      description="Labor, energy, equipment, overhead, and maintenance will be summed from financial_metrics. No cost total is shown here yet."
    />
  );
}
