import { cache } from "react";
import { cookies } from "next/headers";

import { FACILITY_COOKIE, ORG_COOKIE } from "@/lib/auth/cookies";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { toFacilitySummary, type FacilitySummary } from "@/lib/facilities";
import type { Role } from "@/lib/permissions";

import { listFacilities } from "../repositories/facilities";
import { listMemberships } from "../repositories/membership";

export type ShellFacility = FacilitySummary;

export type ShellMembership = {
  memberId: string;
  organizationId: string;
  name: string;
  slug: string;
  role: Role;
};

export type RequestContext = {
  userId: string;
  email: string;
  name: string | null;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: Role;
  facilityId: string | null;
  memberships: ShellMembership[];
  facilities: ShellFacility[];
};

export const loadRequestContext = cache(async (): Promise<RequestContext | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  const memberships = await listMemberships(session.user.id);
  if (memberships.length === 0) return null;

  const jar = await cookies();
  const requestedOrg = jar.get(ORG_COOKIE)?.value;
  const membership =
    memberships.find((item) => item.organizationId === requestedOrg) ?? memberships[0]!;
  const facilities = (await listFacilities(membership.organizationId, session.user.id)).map(
    toFacilitySummary,
  );
  const requestedFacility = jar.get(FACILITY_COOKIE)?.value;
  const facility =
    facilities.find((item) => item.id === requestedFacility) ?? facilities[0] ?? null;

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    organizationId: membership.organizationId,
    organizationName: membership.name,
    organizationSlug: membership.slug,
    role: membership.role,
    facilityId: facility?.id ?? null,
    memberships,
    facilities,
  };
});

export async function requireRequestContext() {
  const context = await loadRequestContext();
  if (!context) {
    throw new AppError("UNAUTHORIZED", "Authentication required.", 401);
  }
  return context;
}
