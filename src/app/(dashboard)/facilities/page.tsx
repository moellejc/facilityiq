import { Suspense } from "react";

import { PageIntro } from "@/components/dashboard/coming-next";
import {
  AttentionPanelSkeleton,
  FacilityAttention,
} from "@/components/facilities/facility-attention";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { attentionFilterFromQuery } from "@/lib/attention";
import { formatSquareFeet } from "@/lib/format";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ attention?: string | string[] }>;
}) {
  const context = await requireRequestContext();
  const query = await searchParams;
  const filter = attentionFilterFromQuery(query.attention);

  return (
    <div>
      <PageIntro
        title="Facilities"
        description="Sites in the active organization, plus areas and assets with a stored warning or critical alert."
      />
      <Suspense fallback={<AttentionPanelSkeleton />}>
        <FacilityAttention
          organizationId={context.organizationId}
          userId={context.userId}
          facilityId={context.facilityId}
          role={context.role}
          filter={filter}
        />
      </Suspense>
      {context.facilities.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No facilities</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            This organization does not have a facility yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {context.facilities.map((facility) => (
            <Card key={facility.id}>
              <CardHeader>
                <CardTitle>{facility.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-600">
                <p>{facility.location ?? "Location not recorded"}</p>
                <p className="capitalize">{facility.facilityType.replaceAll("_", " ")}</p>
                <p>{formatSquareFeet(facility.squareFootage)}</p>
                {facility.id === context.facilityId ? (
                  <p className="pt-2 text-xs font-medium tracking-wide text-indigo-700 uppercase">
                    Active facility
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
