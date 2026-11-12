import { describe, expect, it } from "vitest";

import {
  UNNAMED_AREA,
  UNNAMED_ASSET,
  attentionFilterFromQuery,
  filterAttentionItems,
  selectAttentionItems,
  type AttentionSignal,
} from "@/lib/attention";

function signal(
  overrides: Partial<AttentionSignal> & Pick<AttentionSignal, "id">,
): AttentionSignal {
  return {
    assetId: null,
    areaId: null,
    assetName: null,
    areaName: null,
    severity: "warning",
    summary: "Needs a look",
    occurredAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectAttentionItems", () => {
  it("excludes info alerts and signals with no area or asset", () => {
    const items = selectAttentionItems([
      signal({
        id: "info",
        severity: "info",
        areaId: "area-1",
        areaName: "Receiving",
        summary: "Receiving is steady",
      }),
      signal({ id: "orphan", severity: "critical", summary: "Nowhere" }),
      signal({
        id: "warning",
        severity: "warning",
        assetId: "asset-1",
        assetName: "FL-04",
        areaName: "Staging",
      }),
    ]);

    expect(items).toEqual([
      {
        subjectKind: "asset",
        subjectId: "asset-1",
        subjectName: "FL-04",
        areaName: "Staging",
        severity: "warning",
        summary: "Needs a look",
        signalCount: 1,
        latestOccurredAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
  });

  it("keeps an area when the alert has no asset", () => {
    const items = selectAttentionItems([
      signal({
        id: "aisle",
        severity: "critical",
        areaId: "aisle-04",
        areaName: "Aisle 04",
        summary: "Aisle 04 stayed above 94% utilization.",
        occurredAt: "2026-10-30T00:00:00.000Z",
      }),
    ]);

    expect(items[0]).toMatchObject({
      subjectKind: "area",
      subjectId: "aisle-04",
      subjectName: "Aisle 04",
      areaName: null,
      severity: "critical",
    });
  });

  it("treats a blank name as unnamed and prefers the asset when both ids are present", () => {
    const items = selectAttentionItems([
      signal({
        id: "blank",
        severity: "warning",
        assetId: "asset-9",
        assetName: "  ",
        areaId: "area-9",
        areaName: "  ",
      }),
    ]);

    expect(items[0]).toMatchObject({
      subjectKind: "asset",
      subjectId: "asset-9",
      subjectName: UNNAMED_ASSET,
      areaName: null,
    });
  });

  it("uses the area name when an area alert has a blank name", () => {
    const items = selectAttentionItems([
      signal({ id: "area", severity: "warning", areaId: "area-2", areaName: " " }),
    ]);
    expect(items[0]?.subjectName).toBe(UNNAMED_AREA);
  });

  it("lets a critical alert outrank a newer warning on the same asset", () => {
    const items = selectAttentionItems([
      signal({
        id: "newer-warning",
        severity: "warning",
        assetId: "ps-02",
        assetName: "PS-02",
        summary: "Queue is growing",
        occurredAt: "2026-11-01T12:00:00.000Z",
      }),
      signal({
        id: "older-critical",
        severity: "critical",
        assetId: "ps-02",
        assetName: "PS-02",
        areaName: "Packing",
        summary: "PS-02 cannot clear its queue",
        occurredAt: "2026-10-28T00:00:00.000Z",
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      severity: "critical",
      summary: "PS-02 cannot clear its queue",
      signalCount: 2,
      latestOccurredAt: "2026-10-28T00:00:00.000Z",
      areaName: "Packing",
    });
  });

  it("keeps a known area name when the winning alert omits it", () => {
    const items = selectAttentionItems([
      signal({
        id: "warning",
        severity: "warning",
        assetId: "ps-02",
        assetName: "PS-02",
        areaName: "Packing",
        occurredAt: "2026-11-01T00:00:00.000Z",
      }),
      signal({
        id: "critical",
        severity: "critical",
        assetId: "ps-02",
        assetName: " ",
        areaName: null,
        summary: "Queue is stuck",
        occurredAt: "2026-10-01T00:00:00.000Z",
      }),
    ]);

    expect(items[0]).toMatchObject({
      subjectName: "PS-02",
      areaName: "Packing",
      severity: "critical",
      summary: "Queue is stuck",
    });
  });

  it("uses the newest signal of the winning severity", () => {
    const items = selectAttentionItems([
      signal({
        id: "older",
        severity: "warning",
        areaId: "shipping",
        areaName: "Shipping",
        summary: "Dwell started rising",
        occurredAt: "2026-10-01T00:00:00.000Z",
      }),
      signal({
        id: "newer",
        severity: "warning",
        areaId: "shipping",
        areaName: "Shipping",
        summary: "Dwell is still rising",
        occurredAt: "2026-10-20T00:00:00.000Z",
      }),
    ]);

    expect(items[0]).toMatchObject({
      summary: "Dwell is still rising",
      signalCount: 2,
      latestOccurredAt: "2026-10-20T00:00:00.000Z",
    });
  });

  it("sorts critical before warning, then newest, then name", () => {
    const items = selectAttentionItems([
      signal({
        id: "warn-late",
        severity: "warning",
        assetId: "fl-05",
        assetName: "FL-05",
        occurredAt: "2026-11-01T00:00:00.000Z",
      }),
      signal({
        id: "crit-early",
        severity: "critical",
        assetId: "cv-02",
        assetName: "CV-02",
        occurredAt: "2026-10-01T00:00:00.000Z",
      }),
      signal({
        id: "warn-zeta",
        severity: "warning",
        assetId: "zeta",
        assetName: "Zeta dock",
        occurredAt: "2026-10-15T00:00:00.000Z",
      }),
      signal({
        id: "warn-alpha",
        severity: "warning",
        assetId: "alpha",
        assetName: "Alpha dock",
        occurredAt: "2026-10-15T00:00:00.000Z",
      }),
    ]);

    expect(items.map((item) => item.subjectName)).toEqual([
      "CV-02",
      "FL-05",
      "Alpha dock",
      "Zeta dock",
    ]);
  });

  it("returns an empty list when nothing qualifies", () => {
    expect(selectAttentionItems([])).toEqual([]);
    expect(
      selectAttentionItems([
        signal({ id: "info", severity: "info", areaId: "receiving", areaName: "Receiving" }),
      ]),
    ).toEqual([]);
  });

  it("breaks ties on the signal id when timestamps match", () => {
    const items = selectAttentionItems([
      signal({
        id: "a",
        severity: "critical",
        assetId: "ps-02",
        assetName: "PS-02",
        summary: "Earlier id",
        occurredAt: "2026-11-01T00:00:00.000Z",
      }),
      signal({
        id: "b",
        severity: "critical",
        assetId: "ps-02",
        assetName: "PS-02",
        summary: "Later id",
        occurredAt: "2026-11-01T00:00:00.000Z",
      }),
    ]);
    expect(items[0]?.summary).toBe("Later id");
  });
});

describe("filterAttentionItems", () => {
  const items = selectAttentionItems([
    signal({ id: "c", severity: "critical", assetId: "ps-02", assetName: "PS-02" }),
    signal({ id: "w", severity: "warning", assetId: "fl-04", assetName: "FL-04" }),
  ]);

  it("returns every qualifying subject when the filter is all", () => {
    expect(filterAttentionItems(items, "all").map((item) => item.subjectName)).toEqual([
      "PS-02",
      "FL-04",
    ]);
  });

  it("returns only the requested severity", () => {
    expect(filterAttentionItems(items, "critical").map((item) => item.subjectName)).toEqual([
      "PS-02",
    ]);
    expect(filterAttentionItems(items, "warning").map((item) => item.subjectName)).toEqual([
      "FL-04",
    ]);
  });
});

describe("attentionFilterFromQuery", () => {
  it("accepts warning and critical", () => {
    expect(attentionFilterFromQuery("warning")).toBe("warning");
    expect(attentionFilterFromQuery("critical")).toBe("critical");
  });

  it("treats a missing or unknown value as all", () => {
    expect(attentionFilterFromQuery(undefined)).toBe("all");
    expect(attentionFilterFromQuery("info")).toBe("all");
    expect(attentionFilterFromQuery(["critical"])).toBe("all");
  });
});
