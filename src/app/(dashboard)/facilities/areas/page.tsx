import { PageIntro } from "@/components/dashboard/coming-next";
import { listAreas } from "@/server/repositories/facilities";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function AreasPage() {
  const context = await requireRequestContext();
  const areas = context.facilityId
    ? await listAreas(context.organizationId, context.userId, context.facilityId, 1, 100)
    : { data: [], total: 0 };

  return (
    <div>
      <PageIntro
        title="Areas"
        description="Operational zones for the active facility. Positions are stored for the later 3D view."
      />
      {areas.data.length === 0 ? (
        <p className="text-sm text-slate-600">No areas for the active facility.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Size (m)</th>
              </tr>
            </thead>
            <tbody>
              {areas.data.map((area) => (
                <tr key={area.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{area.name}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">{area.areaType}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">
                    {Number(area.width).toFixed(0)} × {Number(area.depth).toFixed(0)} ×{" "}
                    {Number(area.height).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
