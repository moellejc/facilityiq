import { DateRangeControls } from "@/components/dashboard/date-range-controls";
import { TwinLoader } from "@/components/facilities/twin-loader";
import { parseTwinSelection } from "@/lib/ai/match";
import { analyticsPresets, getFacilityAnalytics } from "@/server/services/analytics-service";
import { requireRequestContext } from "@/server/services/context";
import { listInsightsForFacility } from "@/server/services/insight-service";
import { getFacilityScene } from "@/server/services/scene-service";

export const dynamic = "force-dynamic";

export default async function TwinPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; select?: string }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  const scene = await getFacilityScene(context);

  if (!scene || !context.facilityId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Choose a facility before opening the digital twin.
      </div>
    );
  }

  const analytics = await getFacilityAnalytics({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId: context.facilityId,
    role: context.role,
    query,
  });
  const insights = await listInsightsForFacility({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId: context.facilityId,
    role: context.role,
  });
  const initialSelection = parseTwinSelection(query.select);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">3D Digital Twin</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {scene.facility.name}
          {scene.facility.location ? ` · ${scene.facility.location}` : ""}. Heatmap colors use the
          selected date range.
        </p>
      </div>
      <DateRangeControls
        pathname="/facilities/twin"
        from={analytics.range.from}
        to={analytics.range.to}
        freshness={analytics.freshness}
        presets={analyticsPresets(analytics.freshness)}
        preserve={query.select ? { select: query.select } : undefined}
      />
      <TwinLoader
        scene={scene}
        heatmap={analytics.heatmap}
        insights={insights}
        initialSelection={initialSelection}
      />
    </div>
  );
}
