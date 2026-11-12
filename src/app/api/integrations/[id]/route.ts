import { NextResponse, type NextRequest } from "next/server";

import { readJson, toErrorResponse } from "@/lib/api";
import { uuidSchema } from "@/lib/validation";
import { requireRequestContext } from "@/server/services/context";
import {
  removeIntegrationRecord,
  updateIntegrationRecord,
} from "@/server/services/integration-service";

export const dynamic = "force-dynamic";

async function integrationId(route: { params: Promise<{ id: string }> }) {
  const { id } = await route.params;
  return uuidSchema.parse(id);
}

export async function PATCH(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const id = await integrationId(route);
    return NextResponse.json(await updateIntegrationRecord(context, id, await readJson(request)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const id = await integrationId(route);
    return NextResponse.json(await removeIntegrationRecord(context, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
