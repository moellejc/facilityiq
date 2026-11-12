import { NextResponse, type NextRequest } from "next/server";

import { readDemoDiagnostics } from "@/server/support/demo-diagnostics";

export const dynamic = "force-dynamic";

/**
 * FAIQ-43 security-automation demo only.
 * This handler does not use Auth.js, organization membership, or permissions.
 * It trusts organizationId from the query string. Do not copy this route.
 */
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId");
  const label = request.nextUrl.searchParams.get("label") ?? "";

  if (!organizationId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "organizationId is required." } },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: readDemoDiagnostics(organizationId, label) });
}
