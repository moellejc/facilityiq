import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function BottlenecksPage() {
  return (
    <ComingNext
      title="Bottlenecks"
      phase="Phase 3"
      description="Bottleneck count uses severity above 0.70. The seeded aisle and packing station already carry that signal in the database."
    />
  );
}
