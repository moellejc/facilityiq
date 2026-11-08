import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { uuidSchema } from "@/lib/validation";
import { getScenario } from "@/server/repositories/records";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    void request;
    const context = await requireRequestContext();
    assertRole(context.role, "scenarios:read");
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const result = await getScenario(context.organizationId, context.userId, scenarioId);
    if (!result) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
    return NextResponse.json({ data: result.scenario, results: result.results });
  } catch (error) {
    return toErrorResponse(error);
  }
}
