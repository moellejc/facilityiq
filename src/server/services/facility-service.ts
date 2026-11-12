import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { facilityCreateSchema, facilityUpdateSchema } from "@/lib/validation";

import {
  deleteFacility,
  insertFacility,
  updateFacility,
  type FacilityPatch,
} from "../repositories/facilities";
import type { RequestContext } from "./context";

function presentFacility(facility: {
  id: string;
  name: string;
  location: string | null;
  facilityType: string;
  squareFootage: string | null;
  timezone: string;
}) {
  return {
    id: facility.id,
    name: facility.name,
    location: facility.location,
    facilityType: facility.facilityType,
    squareFootage: facility.squareFootage,
    timezone: facility.timezone,
  };
}

export async function createFacilityRecord(context: RequestContext, input: unknown) {
  assertRole(context.role, "facilities:write");
  const parsed = facilityCreateSchema.parse(input);
  const result = await insertFacility(context.organizationId, context.userId, {
    name: parsed.name,
    location: parsed.location ?? null,
    facilityType: parsed.facilityType,
    squareFootage: parsed.squareFootage ?? null,
    timezone: parsed.timezone,
  });
  if (result.status === "conflict") {
    throw new AppError("CONFLICT", "A facility with that name already exists.", 409);
  }
  return { data: presentFacility(result.facility) };
}

export async function updateFacilityRecord(
  context: RequestContext,
  facilityId: string,
  input: unknown,
) {
  assertRole(context.role, "facilities:write");
  const parsed = facilityUpdateSchema.parse(input);
  const patch: FacilityPatch = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.location !== undefined) patch.location = parsed.location;
  if (parsed.facilityType !== undefined) patch.facilityType = parsed.facilityType;
  if (parsed.squareFootage !== undefined) patch.squareFootage = parsed.squareFootage;
  if (parsed.timezone !== undefined) patch.timezone = parsed.timezone;
  const result = await updateFacility(context.organizationId, context.userId, facilityId, patch);
  if (result.status === "missing") throw new AppError("NOT_FOUND", "Facility not found.", 404);
  if (result.status === "conflict") {
    throw new AppError("CONFLICT", "A facility with that name already exists.", 409);
  }
  return { data: presentFacility(result.facility) };
}

export async function removeFacilityRecord(context: RequestContext, facilityId: string) {
  assertRole(context.role, "facilities:write");
  const result = await deleteFacility(context.organizationId, context.userId, facilityId);
  if (result.status === "missing") throw new AppError("NOT_FOUND", "Facility not found.", 404);
  return { data: { id: result.facility.id } };
}
