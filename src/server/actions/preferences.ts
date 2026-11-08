"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { FACILITY_COOKIE, ORG_COOKIE, preferenceCookieOptions } from "@/lib/auth/cookies";
import { AppError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";

import { listFacilities } from "../repositories/facilities";
import { requireRequestContext } from "../services/context";

export async function setActiveOrganization(organizationId: string) {
  const context = await requireRequestContext();
  const id = uuidSchema.parse(organizationId);
  const membership = context.memberships.find((item) => item.organizationId === id);
  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of that organization.", 403);
  }
  const facilities = await listFacilities(id, context.userId);
  const jar = await cookies();
  jar.set(ORG_COOKIE, id, preferenceCookieOptions());
  if (facilities[0]) {
    jar.set(FACILITY_COOKIE, facilities[0].id, preferenceCookieOptions());
  } else {
    jar.delete(FACILITY_COOKIE);
  }
  revalidatePath("/", "layout");
}

export async function setActiveFacility(facilityId: string) {
  const context = await requireRequestContext();
  const id = uuidSchema.parse(facilityId);
  const facility = context.facilities.find((item) => item.id === id);
  if (!facility) {
    throw new AppError("NOT_FOUND", "Facility not found in the active organization.", 404);
  }
  const jar = await cookies();
  jar.set(ORG_COOKIE, context.organizationId, preferenceCookieOptions());
  jar.set(FACILITY_COOKIE, id, preferenceCookieOptions());
  revalidatePath("/", "layout");
}
