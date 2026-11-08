import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { signOut } from "@/lib/auth";
import { FACILITY_COOKIE, ORG_COOKIE } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const jar = await cookies();
    jar.delete(ORG_COOKIE);
    jar.delete(FACILITY_COOKIE);
    await signOut({ redirect: false });
    return NextResponse.json({ data: { signedOut: true } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
