export type InsightMatch = {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  status: string;
  areaId: string | null;
  assetId: string | null;
  affectedAreaIds: string[];
  affectedAssetIds: string[];
  estimatedFinancialImpact: string | null;
  impactLabel: "estimate" | "not_calculable";
};

export function insightsForSelection(
  insights: InsightMatch[],
  selection: { kind: "asset" | "area"; id: string } | null,
) {
  if (!selection) return [];
  return insights.filter((insight) => {
    if (selection.kind === "asset") {
      return insight.assetId === selection.id || insight.affectedAssetIds.includes(selection.id);
    }
    return insight.areaId === selection.id || insight.affectedAreaIds.includes(selection.id);
  });
}

export function twinSelectionHref(
  insight: { assetId: string | null; areaId: string | null },
  range?: { from?: string | null; to?: string | null },
) {
  const params = new URLSearchParams();
  if (insight.assetId) params.set("select", `asset:${insight.assetId}`);
  else if (insight.areaId) params.set("select", `area:${insight.areaId}`);
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const query = params.toString();
  return query ? `/facilities/twin?${query}` : "/facilities/twin";
}

export function parseTwinSelection(value: string | null | undefined) {
  if (!value) return null;
  const [kind, id] = value.split(":");
  if ((kind !== "asset" && kind !== "area") || !id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return { kind, id } as { kind: "asset" | "area"; id: string };
}
