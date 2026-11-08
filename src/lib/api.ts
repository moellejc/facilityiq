import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, isAppError } from "@/lib/errors";

export function jsonError(code: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export function toErrorResponse(error: unknown) {
  if (isAppError(error)) {
    const headers = error.code === "RATE_LIMITED" ? { "Retry-After": "60" } : undefined;
    return jsonError(error.code, error.message, error.status, headers);
  }
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", "The request is invalid.", 400);
  }
  console.error(error);
  return jsonError("INTERNAL", "Something went wrong.", 500);
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "The request body must be JSON.", 400);
  }
}
