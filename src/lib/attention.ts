import { attentionQuerySchema } from "@/lib/validation";

export const UNNAMED_ASSET = "Unnamed asset";
export const UNNAMED_AREA = "Unnamed area";

export const attentionFilters = ["all", "warning", "critical"] as const;

export type AttentionFilter = (typeof attentionFilters)[number];
export type AttentionSeverity = Exclude<AttentionFilter, "all">;

export type AttentionSignal = {
  id: string;
  assetId: string | null;
  areaId: string | null;
  assetName: string | null;
  areaName: string | null;
  severity: "info" | AttentionSeverity | string;
  summary: string;
  occurredAt: string;
};

export type AttentionItem = {
  subjectKind: "area" | "asset";
  subjectId: string;
  subjectName: string;
  areaName: string | null;
  severity: AttentionSeverity;
  summary: string;
  signalCount: number;
  latestOccurredAt: string;
};

export type FacilityAttentionResult =
  | { status: "no_facility" }
  | { status: "not_found" }
  | {
      status: "ready";
      facilityName: string;
      filter: AttentionFilter;
      items: AttentionItem[];
      totalSignals: number;
      truncated: boolean;
    };

export type FacilityAttentionView = FacilityAttentionResult | { status: "forbidden" };

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  warning: 1,
  critical: 2,
};

export function attentionFilterFromQuery(value: unknown): AttentionFilter {
  const parsed = attentionQuerySchema.safeParse({
    attention: typeof value === "string" ? value : undefined,
  });
  if (!parsed.success || !parsed.data.attention) return "all";
  return parsed.data.attention;
}

/**
 * Areas and assets that need attention.
 * Info signals are excluded. A subject is critical when any of its signals is critical.
 * The summary and timestamp come from the newest signal of that winning severity.
 */
export function selectAttentionItems(signals: AttentionSignal[]): AttentionItem[] {
  const groups = new Map<string, { subject: AttentionSubject; signals: AttentionSignal[] }>();

  for (const signal of signals) {
    if (!isAttentionSeverity(signal.severity)) continue;
    const subject = subjectOf(signal);
    if (!subject) continue;
    const key = `${subject.kind}:${subject.id}`;
    const existing = groups.get(key);
    if (existing) existing.signals.push(signal);
    else groups.set(key, { subject, signals: [signal] });
  }

  const items: AttentionItem[] = [];
  for (const group of groups.values()) {
    const severity: AttentionSeverity = group.signals.some(
      (signal) => signal.severity === "critical",
    )
      ? "critical"
      : "warning";
    const representative = group.signals
      .filter((signal) => signal.severity === severity)
      .reduce((best, signal) => (compareSignals(signal, best) > 0 ? signal : best));
    const subjectName =
      cleanName(
        group.subject.kind === "asset" ? representative.assetName : representative.areaName,
      ) ??
      firstName(group.signals, group.subject.kind) ??
      (group.subject.kind === "asset" ? UNNAMED_ASSET : UNNAMED_AREA);
    const areaName =
      group.subject.kind === "asset"
        ? (cleanName(representative.areaName) ?? firstAreaName(group.signals))
        : null;
    items.push({
      subjectKind: group.subject.kind,
      subjectId: group.subject.id,
      subjectName,
      areaName,
      severity,
      summary: representative.summary.trim(),
      signalCount: group.signals.length,
      latestOccurredAt: representative.occurredAt,
    });
  }

  items.sort(compareItems);
  return items;
}

export function filterAttentionItems(
  items: AttentionItem[],
  filter: AttentionFilter,
): AttentionItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.severity === filter);
}

type AttentionSubject = {
  kind: "area" | "asset";
  id: string;
  name: string;
  areaName: string | null;
};

function isAttentionSeverity(value: string): value is AttentionSeverity {
  return value === "warning" || value === "critical";
}

function subjectOf(signal: AttentionSignal): AttentionSubject | null {
  const assetName = cleanName(signal.assetName);
  const areaName = cleanName(signal.areaName);
  if (signal.assetId) {
    return {
      kind: "asset",
      id: signal.assetId,
      name: assetName ?? UNNAMED_ASSET,
      areaName,
    };
  }
  if (signal.areaId) {
    return {
      kind: "area",
      id: signal.areaId,
      name: areaName ?? UNNAMED_AREA,
      areaName: null,
    };
  }
  return null;
}

function cleanName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function firstName(signals: AttentionSignal[], kind: AttentionSubject["kind"]) {
  for (const signal of signals) {
    const name = cleanName(kind === "asset" ? signal.assetName : signal.areaName);
    if (name) return name;
  }
  return null;
}

function firstAreaName(signals: AttentionSignal[]) {
  for (const signal of signals) {
    const name = cleanName(signal.areaName);
    if (name) return name;
  }
  return null;
}

function timeValue(iso: string) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function compareSignals(left: AttentionSignal, right: AttentionSignal) {
  const timeDelta = timeValue(left.occurredAt) - timeValue(right.occurredAt);
  if (timeDelta !== 0) return timeDelta;
  return left.id.localeCompare(right.id);
}

function compareItems(left: AttentionItem, right: AttentionItem) {
  const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
  if (severityDelta !== 0) return severityDelta;
  const timeDelta = timeValue(right.latestOccurredAt) - timeValue(left.latestOccurredAt);
  if (timeDelta !== 0) return timeDelta;
  const nameDelta = left.subjectName.localeCompare(right.subjectName, "en");
  if (nameDelta !== 0) return nameDelta;
  return left.subjectId.localeCompare(right.subjectId);
}
