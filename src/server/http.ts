import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { assertRole, type Permission } from "@/lib/permissions";
import { uuidSchema } from "@/lib/validation";

import { getFacility } from "./repositories/facilities";
import { requireRequestContext, type RequestContext } from "./services/context";

export function withApi(
  handler: (request: NextRequest, context: RequestContext) => Promise<unknown>,
) {
  return async (request: NextRequest) => {
    try {
      const context = await requireRequestContext();
      return NextResponse.json(await handler(request, context));
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function withFacilityApi(
  permission: Permission,
  handler: (request: NextRequest, context: RequestContext, facilityId: string) => Promise<unknown>,
) {
  return async (request: NextRequest, route: { params: Promise<{ id: string }> }) => {
    try {
      const context = await requireRequestContext();
      assertRole(context.role, permission);
      const { id } = await route.params;
      const facilityId = uuidSchema.parse(id);
      const facility = await getFacility(context.organizationId, context.userId, facilityId);
      if (!facility) throw new AppError("NOT_FOUND", "Facility not found.", 404);
      return NextResponse.json(await handler(request, context, facilityId));
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function notImplemented(feature: string): never {
  throw new AppError("NOT_IMPLEMENTED", `${feature} is not available in this phase.`, 501);
}
