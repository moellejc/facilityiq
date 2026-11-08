import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api";
import { uuidSchema } from "@/lib/validation";
import { requireRequestContext } from "@/server/services/context";
import { runScenario } from "@/server/services/scenario-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const url = new URL(request.url);
    const data = await runScenario({
      organizationId: context.organizationId,
      userId: context.userId,
      scenarioId,
      role: context.role,
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
