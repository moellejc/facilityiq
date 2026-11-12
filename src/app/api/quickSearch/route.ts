import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api";
import { quickSearchFacilities } from "@/server/services/quick-search-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const organizationId = request.nextUrl.searchParams.get("organizationId") ?? "";
    return NextResponse.json(await quickSearchFacilities({ q, organizationId }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
