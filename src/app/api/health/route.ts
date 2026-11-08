import { NextResponse } from "next/server";

import { getPool } from "@/db";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getPool().query("select 1");
    return NextResponse.json({ data: { status: "ok", database: "up" } });
  } catch {
    return jsonError("INTERNAL", "Database is unavailable.", 503);
  }
}
