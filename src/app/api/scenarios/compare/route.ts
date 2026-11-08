import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { requireRequestContext } from "@/server/services/context";
import { compareScenarios } from "@/server/services/scenario-service";

export const dynamic = "force-dynamic";

/** Compare one scenario to baseline, or two scenarios to each other. */
export async function GET(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if (!context.facilityId) {
      throw new AppError("VALIDATION_ERROR", "Choose a facility first.", 400);
    }
    const url = new URL(request.url);
    const leftId = uuidSchema.parse(url.searchParams.get("left"));
    const rightRaw = url.searchParams.get("right");
    const rightId = rightRaw ? uuidSchema.parse(rightRaw) : null;
    const data = await compareScenarios({
      organizationId: context.organizationId,
      userId: context.userId,
      facilityId: context.facilityId,
      role: context.role,
      leftId,
      rightId,
      query: {
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
