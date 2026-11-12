import "server-only";

import {
  filterAttentionItems,
  selectAttentionItems,
  type AttentionFilter,
  type AttentionSignal,
  type FacilityAttentionResult,
} from "@/lib/attention";
import { assertRole, type Role } from "@/lib/permissions";
import { getFacility } from "@/server/repositories/facilities";
import { listFacilityAttentionEvents } from "@/server/repositories/events";

export async function getFacilityAttention(input: {
  organizationId: string;
  userId: string;
  facilityId: string | null;
  role: Role;
  filter: AttentionFilter;
}): Promise<FacilityAttentionResult> {
  assertRole(input.role, "operations:read");
  if (!input.facilityId) return { status: "no_facility" };

  const facility = await getFacility(input.organizationId, input.userId, input.facilityId);
  if (!facility) return { status: "not_found" };

  const events = await listFacilityAttentionEvents(
    input.organizationId,
    input.userId,
    input.facilityId,
    input.filter,
  );
  const signals: AttentionSignal[] = events.data.map((row) => ({
    id: row.id,
    assetId: row.assetId,
    areaId: row.areaId,
    assetName: row.assetName,
    areaName: row.areaName,
    severity: row.severity,
    summary: row.summary,
    occurredAt: row.occurredAt.toISOString(),
  }));
  return {
    status: "ready",
    facilityName: facility.name,
    filter: input.filter,
    items: filterAttentionItems(selectAttentionItems(signals), input.filter),
    totalSignals: events.total,
    truncated: events.total > events.data.length,
  };
}
