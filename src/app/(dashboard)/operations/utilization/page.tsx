import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function UtilizationPage() {
  return (
    <ComingNext
      title="Utilization"
      phase="Phase 3"
      description="Area and asset utilization charts will average stored samples. An empty period stays blank instead of rendering 0%."
    />
  );
}
