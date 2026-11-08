import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function InsightsPage() {
  return (
    <ComingNext
      title="AI insights"
      phase="Phase 4"
      description="Deterministic rules will explain the seeded problems. This page does not render insight copy or savings figures yet. The records are available from the insights API."
    />
  );
}
