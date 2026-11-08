import { NextResponse, type NextRequest } from "next/server";

import { readJson, toErrorResponse } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { authenticate, establishSession } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await readJson(request));
    const rateKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const result = await authenticate({ ...body, rateKey });
    await establishSession(result);
    return NextResponse.json({
      data: { id: result.user.id, email: result.user.email, name: result.user.name },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
