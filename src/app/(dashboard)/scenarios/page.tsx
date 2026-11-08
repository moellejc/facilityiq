import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function ScenariosPage() {
  return (
    <ComingNext
      title="Scenarios"
      phase="Phase 5"
      description="Three sample scenarios are seeded with modeled results. Creating, running, and comparing scenarios is not implemented yet. The run API returns a clear not-implemented response."
    />
  );
}
