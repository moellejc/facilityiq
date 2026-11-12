import "server-only";

import { AppError } from "@/lib/errors";
import {
  presentFacilityAddress,
  toFacilitySummary,
  type FacilityAddress,
  type FacilityAddressColumns,
} from "@/lib/facilities";
import { assertRole } from "@/lib/permissions";
import { facilityCreateSchema, facilityUpdateSchema } from "@/lib/validation";

import {
  deleteFacility,
  getFacility,
  insertFacility,
  updateFacility,
  type FacilityPatch,
} from "../repositories/facilities";
import type { RequestContext } from "./context";

function addressColumns(address: FacilityAddress | null): FacilityAddressColumns {
  if (!address) {
    return {
      addressStreet: null,
      addressCity: null,
      addressRegion: null,
      addressPostalCode: null,
      addressCountry: null,
    };
  }
  return {
    addressStreet: address.street,
    addressCity: address.city,
    addressRegion: address.region,
    addressPostalCode: address.postalCode,
    addressCountry: address.country,
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
    ...addressColumns(parsed.address ?? null),
  });
  if (result.status === "conflict") {
    throw new AppError("CONFLICT", "A facility with that name already exists.", 409);
  }
  return { data: toFacilitySummary(result.facility) };
}

export async function readFacilityRecord(context: RequestContext, facilityId: string) {
  assertRole(context.role, "facilities:read");
  const facility = await getFacility(context.organizationId, context.userId, facilityId);
  if (!facility) throw new AppError("NOT_FOUND", "Facility not found.", 404);
  return {
    data: {
      id: facility.id,
      organizationId: facility.organizationId,
      name: facility.name,
      location: facility.location,
      facilityType: facility.facilityType,
      squareFootage: facility.squareFootage,
      timezone: facility.timezone,
      metadata: facility.metadata,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
      address: presentFacilityAddress(facility),
    },
  };
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
  if (parsed.address !== undefined) Object.assign(patch, addressColumns(parsed.address));
  const result = await updateFacility(context.organizationId, context.userId, facilityId, patch);
  if (result.status === "missing") throw new AppError("NOT_FOUND", "Facility not found.", 404);
  if (result.status === "conflict") {
    throw new AppError("CONFLICT", "A facility with that name already exists.", 409);
  }
  return { data: toFacilitySummary(result.facility) };
}

export async function removeFacilityRecord(context: RequestContext, facilityId: string) {
  assertRole(context.role, "facilities:write");
  const result = await deleteFacility(context.organizationId, context.userId, facilityId);
  if (result.status === "missing") throw new AppError("NOT_FOUND", "Facility not found.", 404);
  return { data: { id: result.facility.id } };
}
