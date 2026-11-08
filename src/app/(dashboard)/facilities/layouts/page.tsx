import Link from "next/link";

import { PageIntro } from "@/components/dashboard/coming-next";
import { formatUtcDate } from "@/lib/format";
import { assertRole } from "@/lib/permissions";
import { getLatestLayout } from "@/server/repositories/facilities";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function LayoutsPage() {
  const context = await requireRequestContext();
  assertRole(context.role, "layouts:read");
  const layout = context.facilityId
    ? await getLatestLayout(context.organizationId, context.userId, context.facilityId)
    : null;
  const bounds = readBounds(layout?.layoutData);

  return (
    <div>
      <PageIntro
        title="Layouts"
        description="Layout editing stays on this route, separate from the operational twin. Snap, overlap checks, and restore are not available yet. Nothing here writes to the database."
      />
      {!layout ? (
        <p className="text-sm text-slate-600">
          No layout version is stored for the active facility.
        </p>
      ) : (
        <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] tracking-wide text-indigo-700 uppercase">Saved version</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {layout.name} · v{layout.version}
          </h2>
          <dl className="mt-3 space-y-1 text-sm text-slate-700">
            <div>Saved {formatUtcDate(layout.createdAt)}</div>
            {bounds ? (
              <div>
                Bounds {bounds.width} × {bounds.depth} × {bounds.height} m
                {bounds.gridSize ? ` · grid ${bounds.gridSize} m` : ""}
              </div>
            ) : null}
          </dl>
          <Link
            href="/facilities/twin"
            className="mt-4 inline-block text-sm font-medium text-indigo-700"
          >
            Open this layout in the operational viewer
          </Link>
        </div>
      )}
    </div>
  );
}

function readBounds(layoutData: unknown) {
  if (!layoutData || typeof layoutData !== "object") return null;
  const record = layoutData as {
    bounds?: { width?: number; depth?: number; height?: number };
    gridSize?: number;
  };
  const bounds = record.bounds;
  if (!bounds || typeof bounds.width !== "number") return null;
  return {
    width: bounds.width,
    depth: bounds.depth ?? 0,
    height: bounds.height ?? 0,
    gridSize: record.gridSize ?? null,
  };
}
