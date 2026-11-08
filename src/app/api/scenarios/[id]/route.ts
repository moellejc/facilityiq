import { NextResponse, type NextRequest } from "next/server";

import { readJson, toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { uuidSchema } from "@/lib/validation";
import { requireRequestContext } from "@/server/services/context";
import {
  deleteScenario,
  duplicateScenario,
  getScenarioDetail,
  updateScenario,
} from "@/server/services/scenario-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    void request;
    const context = await requireRequestContext();
    assertRole(context.role, "scenarios:read");
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const data = await getScenarioDetail({
      organizationId: context.organizationId,
      userId: context.userId,
      scenarioId,
      role: context.role,
    });
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const body = await readJson(request);
    const data = await updateScenario({
      organizationId: context.organizationId,
      userId: context.userId,
      scenarioId,
      role: context.role,
      body,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    void request;
    const context = await requireRequestContext();
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const data = await deleteScenario({
      organizationId: context.organizationId,
      userId: context.userId,
      scenarioId,
      role: context.role,
    });
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const { id } = await route.params;
    const scenarioId = uuidSchema.parse(id);
    const url = new URL(request.url);
    if (url.searchParams.get("action") !== "duplicate") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Use ?action=duplicate to copy a scenario, or POST /api/scenarios/[id]/run to execute it.",
        400,
      );
    }
    const data = await duplicateScenario({
      organizationId: context.organizationId,
      userId: context.userId,
      scenarioId,
      role: context.role,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
