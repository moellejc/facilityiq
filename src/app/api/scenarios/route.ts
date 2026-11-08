import { NextResponse, type NextRequest } from "next/server";

import { readJson, toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { withApi } from "@/server/http";
import { requireRequestContext } from "@/server/services/context";
import { createScenario, listScenariosForFacility } from "@/server/services/scenario-service";

export const dynamic = "force-dynamic";

export const GET = withApi(async (_request, context) => {
  assertRole(context.role, "scenarios:read");
  if (!context.facilityId) {
    throw new AppError("VALIDATION_ERROR", "Choose a facility first.", 400);
  }
  const data = await listScenariosForFacility({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId: context.facilityId,
    role: context.role,
  });
  return { data, total: data.length };
});

export async function POST(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if (!context.facilityId) {
      throw new AppError("VALIDATION_ERROR", "Choose a facility first.", 400);
    }
    const body = await readJson(request);
    const data = await createScenario({
      organizationId: context.organizationId,
      userId: context.userId,
      facilityId: context.facilityId,
      role: context.role,
      body,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
