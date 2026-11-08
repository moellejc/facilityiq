import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/dashboard/coming-next";
import { formatSquareFeet } from "@/lib/format";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const context = await requireRequestContext();

  return (
    <div>
      <PageIntro
        title="Facilities"
        description="Sites available in the active organization. The 3D twin, layout editor, and heatmaps are later phases."
      />
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
