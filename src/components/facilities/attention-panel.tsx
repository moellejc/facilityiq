import Link from "next/link";
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { twinSelectionHref } from "@/lib/ai/match";
import { formatCount, formatUtcDate } from "@/lib/format";
import type { AttentionFilter, AttentionItem, FacilityAttentionView } from "@/lib/attention";

export function AttentionPanel({ model }: { model: FacilityAttentionView }) {
  return (
    <section aria-labelledby="facility-attention-heading" className="mb-6">
      <Card>
        <CardHeader>
          <h2
            id="facility-attention-heading"
            className="font-heading text-base leading-snug font-medium text-slate-950"
          >
            Needs attention
          </h2>
          <CardDescription>{descriptionFor(model)}</CardDescription>
        </CardHeader>
        <CardContent>
          {model.status === "ready" ? <AttentionList model={model} /> : null}
          {model.status !== "ready" ? (
            <p className="text-sm text-slate-600">{messageFor(model)}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function AttentionList({ model }: { model: Extract<FacilityAttentionView, { status: "ready" }> }) {
  return (
    <div className="space-y-4">
      <nav aria-label="Attention severity" className="flex flex-wrap gap-2 text-sm">
        <FilterLink href="/facilities" active={model.filter === "all"} label="All" />
        <FilterLink
          href="/facilities?attention=critical"
          active={model.filter === "critical"}
          label="Critical"
        />
        <FilterLink
          href="/facilities?attention=warning"
          active={model.filter === "warning"}
          label="Warning"
        />
      </nav>
      {model.truncated ? (
        <p className="text-sm text-slate-600">
          Showing subjects from the 100 most recent warning and critical alerts. Older alerts are
          not listed.
        </p>
      ) : null}
      {model.items.length === 0 ? (
        <p className="text-sm text-slate-600">{emptyMessage(model.filter)}</p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {model.items.map((item) => (
            <AttentionRow key={`${item.subjectKind}:${item.subjectId}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const href = twinSelectionHref(
    item.subjectKind === "asset"
      ? { assetId: item.subjectId, areaId: null }
      : { assetId: null, areaId: item.subjectId },
  );
  const kind = item.subjectKind === "asset" ? "Asset" : "Area";
  const place = item.subjectKind === "asset" && item.areaName ? ` in ${item.areaName}` : "";
  const severityLabel = item.severity === "critical" ? "Critical" : "Warning";
  const alertLabel = item.signalCount === 1 ? "1 alert" : `${formatCount(item.signalCount)} alerts`;

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Link href={href} className="font-medium text-slate-950 hover:text-indigo-700">
          {item.subjectName}
        </Link>
        <p className="text-sm text-slate-600">
          {kind}
          {place}
        </p>
        <p className="mt-1 text-sm text-slate-700">{item.summary || "—"}</p>
        <p className="mt-1 text-xs text-slate-500">
          <time dateTime={item.latestOccurredAt}>{formatUtcDate(item.latestOccurredAt)}</time>
          <span aria-hidden="true"> · </span>
          <span>{alertLabel}</span>
        </p>
      </div>
      <SeverityBadge severity={item.severity} label={severityLabel} />
    </li>
  );
}

function SeverityBadge({
  severity,
  label,
}: {
  severity: AttentionItem["severity"];
  label: string;
}) {
  const critical = severity === "critical";
  const Icon = critical ? CircleAlertIcon : TriangleAlertIcon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium tracking-wide uppercase ${
        critical ? "text-rose-700" : "text-amber-700"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
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

function descriptionFor(model: FacilityAttentionView) {
  if (model.status === "ready") {
    return `Warning and critical alerts stored for ${model.facilityName}. Info alerts stay off this list.`;
  }
  return "Areas and assets with a stored warning or critical alert.";
}

function messageFor(model: Exclude<FacilityAttentionView, { status: "ready" }>) {
  if (model.status === "forbidden") return "Operational alerts are not available for this role.";
  if (model.status === "no_facility") {
    return "Choose a facility to see areas and assets that need attention.";
  }
  return "This facility is not available.";
}

function emptyMessage(filter: AttentionFilter) {
  if (filter === "critical") {
    return "No critical alerts for this facility. Other severities stay on All.";
  }
  if (filter === "warning") {
    return "No warning alerts for this facility. Other severities stay on All.";
  }
  return "No areas or assets need attention. Warning and critical alerts for this facility will show up here.";
}
