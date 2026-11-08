import Link from "next/link";

import { insightsForSelection, type InsightMatch } from "@/lib/ai/match";
import { ASSET_TYPE_LABELS, formatUtcDate } from "@/lib/format";
import { eventsForArea, eventsForAsset, findArea, findAsset } from "@/lib/twin/scene";
import type { FacilityScene, SceneEvent, SceneSample, TwinSelection } from "@/lib/twin/types";

export function SelectionPanel({
  scene,
  selection,
  insights = [],
}: {
  scene: FacilityScene;
  selection: TwinSelection;
  insights?: InsightMatch[];
}) {
  if (!selection) {
    return (
      <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-80">
        <h2 className="text-sm font-semibold text-slate-950">Selection</h2>
        <p className="mt-2 text-sm text-slate-600">
          Select an aisle, zone, or piece of equipment. Details come from the facility record.
        </p>
      </aside>
    );
  }

  if (selection.kind === "asset") {
    const asset = findAsset(scene, selection.id);
    if (!asset) return <Missing label="That asset is not in this facility." />;
    const maintenance = eventsForAsset(scene, asset.id).filter(
      (event) => event.eventType === "maintenance",
    );
    return (
      <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-80">
        <p className="text-[11px] tracking-wide text-indigo-700 uppercase">Asset</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{asset.name}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Type" value={ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType} />
          <Row label="Status" value={asset.status} />
          <Row label="Area" value={asset.areaName ?? "Unassigned"} />
          <Row
            label="Position"
            value={`${asset.position.x.toFixed(1)}, ${asset.position.y.toFixed(1)}, ${asset.position.z.toFixed(1)} m`}
          />
          {asset.rackName ? <Row label="Rack" value={asset.rackName} /> : null}
          {asset.level !== null ? <Row label="Level" value={String(asset.level)} /> : null}
          <Row label="Model" value={asset.modelUrl ?? "Procedural geometry"} />
        </dl>
        <SampleBlock sample={asset.latestUtilization} />
        <MaintenanceBlock events={maintenance} />
        <EventList events={eventsForAsset(scene, asset.id)} />
        <RelatedInsights insights={insightsForSelection(insights, selection)} />
      </aside>
    );
  }

  const area = findArea(scene, selection.id);
  if (!area) return <Missing label="That area is not in this facility." />;
  return (
    <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-80">
      <p className="text-[11px] tracking-wide text-indigo-700 uppercase">Area</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-950">{area.name}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Type" value={area.areaType} />
        <Row
          label="Size"
          value={`${area.size.width.toFixed(0)} × ${area.size.depth.toFixed(0)} × ${area.size.height.toFixed(0)} m`}
        />
      </dl>
      <SampleBlock sample={area.latestUtilization} />
      <EventList events={eventsForArea(scene, area.id)} />
      <RelatedInsights insights={insightsForSelection(insights, selection)} />
    </aside>
  );
}

function RelatedInsights({ insights }: { insights: InsightMatch[] }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">Related insights</p>
      {insights.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">No stored insight is linked to this object.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {insights.map((insight) => (
            <li key={insight.id} className="text-sm">
              <p className="font-medium text-slate-900">{insight.title}</p>
              <p className="text-xs text-slate-500">
                {insight.severity} · {insight.status}
                {insight.impactLabel === "estimate" && insight.estimatedFinancialImpact
                  ? ` · Estimate ${insight.estimatedFinancialImpact} USD`
                  : ""}
              </p>
              <Link href="/insights" className="text-xs font-medium text-indigo-700">
                Open insights
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SampleBlock({ sample }: { sample: SceneSample | null }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">
        Latest utilization sample
      </p>
      {sample ? (
        <p className="mt-1 text-slate-900">
          {sample.value.toFixed(1)} {sample.unit}
          <span className="text-slate-500"> · {formatUtcDate(sample.recordedAt)}</span>
        </p>
      ) : (
        <p className="mt-1 text-slate-600">No utilization sample is stored.</p>
      )}
    </div>
  );
}

function MaintenanceBlock({ events }: { events: SceneEvent[] }) {
  const latest = events[0];
  return (
    <div className="mt-3 text-sm">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">Last maintenance</p>
      {latest ? (
        <p className="mt-1 text-slate-800">
          {formatUtcDate(latest.occurredAt)} · {latest.description}
        </p>
      ) : (
        <p className="mt-1 text-slate-600">No maintenance event is stored.</p>
      )}
    </div>
  );
}

function EventList({ events }: { events: SceneEvent[] }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">Events</p>
      {events.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">No events are stored.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="text-sm text-slate-700">
              <span className={severityClass(event.severity)}>{event.severity}</span>
              <span className="text-slate-400"> · {formatUtcDate(event.occurredAt)}</span>
              <p>{event.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900 capitalize">{value}</dd>
    </div>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm lg:w-80">
      {label}
    </aside>
  );
}

function severityClass(severity: SceneEvent["severity"]) {
  if (severity === "critical") return "font-medium text-rose-700";
  if (severity === "warning") return "font-medium text-amber-700";
  return "font-medium text-emerald-700";
}
