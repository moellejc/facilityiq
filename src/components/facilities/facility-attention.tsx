import { AttentionPanel } from "@/components/facilities/attention-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { isAppError } from "@/lib/errors";
import type { AttentionFilter, FacilityAttentionView } from "@/lib/attention";
import type { Role } from "@/lib/permissions";
import { getFacilityAttention } from "@/server/services/attention-service";

export async function FacilityAttention({
  organizationId,
  userId,
  facilityId,
  role,
  filter,
}: {
  organizationId: string;
  userId: string;
  facilityId: string | null;
  role: Role;
  filter: AttentionFilter;
}) {
  let model: FacilityAttentionView;
  try {
    model = await getFacilityAttention({
      organizationId,
      userId,
      facilityId,
      role,
      filter,
    });
  } catch (error) {
    if (!isAppError(error) || error.code !== "FORBIDDEN") throw error;
    model = { status: "forbidden" };
  }
  return <AttentionPanel model={model} />;
}

export function AttentionPanelSkeleton() {
  return (
    <div
      className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      aria-busy="true"
    >
      <p className="sr-only">Loading areas and assets that need attention.</p>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
