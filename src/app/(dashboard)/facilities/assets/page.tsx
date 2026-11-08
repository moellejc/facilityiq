import Link from "next/link";

import { PageIntro } from "@/components/dashboard/coming-next";
import { ASSET_TYPE_LABELS, formatCount } from "@/lib/format";
import { listAssets } from "@/server/repositories/facilities";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; assetType?: string }>;
}) {
  const context = await requireRequestContext();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const assetType =
    params.assetType && params.assetType in ASSET_TYPE_LABELS ? params.assetType : undefined;
  const result = context.facilityId
    ? await listAssets(context.organizationId, context.userId, context.facilityId, {
        page,
        limit: 25,
        order: "asc",
        sort: "name",
        assetType,
      })
    : { data: [], total: 0, page: 1, limit: 25 };
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const query = assetType ? `&assetType=${assetType}` : "";

  return (
    <div>
      <PageIntro
        title="Assets"
        description={`${formatCount(result.total)} assets in the active facility. This table is the inventory, not a performance ranking.`}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FilterLink href="/facilities/assets" active={!assetType} label="All" />
        {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => (
          <FilterLink
            key={type}
            href={`/facilities/assets?assetType=${type}`}
            active={assetType === type}
            label={label}
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-slate-500">
                  No assets match this filter.
                </td>
              </tr>
            ) : (
              result.data.map((asset) => (
                <tr key={asset.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{asset.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
                  </td>
                  <td className="px-4 py-2">
                    <StatusDot status={asset.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {result.page} of {pages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link className="text-indigo-700" href={`/facilities/assets?page=${page - 1}${query}`}>
              Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link className="text-indigo-700" href={`/facilities/assets?page=${page + 1}${query}`}>
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"
      }`}
    >
      {label}
    </Link>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-emerald-500"
      : status === "maintenance"
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <span className="inline-flex items-center gap-2 capitalize text-slate-600">
      <span className={`size-2 rounded-full ${color}`} />
      {status}
    </span>
  );
}
