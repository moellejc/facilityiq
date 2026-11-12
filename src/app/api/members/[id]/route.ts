import { NextResponse, type NextRequest } from "next/server";

import { readJson, toErrorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { requireRequestContext } from "@/server/services/context";
import { changeMemberRole, removeOrganizationMember } from "@/server/services/organization-service";

export const dynamic = "force-dynamic";

async function memberId(route: { params: Promise<{ id: string }> }) {
  const { id } = await route.params;
  return uuidSchema.parse(id);
}

export async function PATCH(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const id = await memberId(route);
    const body = await readJson(request);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new AppError("VALIDATION_ERROR", "The request body must be a JSON object.", 400);
    }
    return NextResponse.json({
      data: await changeMemberRole(context, { ...body, memberId: id }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext();
    const id = await memberId(route);
    return NextResponse.json(await removeOrganizationMember(context, { memberId: id }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
