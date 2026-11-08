import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function LayoutsPage() {
  return (
    <ComingNext
      title="Layouts"
      phase="Phase 2"
      description="Layout versions are already stored. Editing, grid snap, and restore arrive with the layout tools. The latest layout is available from the API."
    />
  );
}
