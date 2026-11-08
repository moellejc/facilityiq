import type { NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { uuidSchema } from "@/lib/validation";
import { notImplemented } from "@/server/http";
import { getScenario } from "@/server/repositories/records";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

/** Authenticated stub. Scenario execution is Phase 5. */
export async function POST(_request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    assertRole(context.role, "scenarios:write");
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const existing = await getScenario(context.organizationId, context.userId, scenarioId);
    if (!existing) throw new AppError("NOT_FOUND", "Scenario not found.", 404);
    notImplemented("Scenario execution");
  } catch (error) {
    return toErrorResponse(error);
  }
}
