/**
 * FAIQ-41 demo route. Intentionally non-compliant with the FacilityIQ API
 * standards (Notion API Endpoints and Coding Conventions §14). Standards
 * automation should flag this file. Do not move the query into a service or
 * repository, do not wrap it in withApi, and do not switch the error body to
 * { error: { code, message } }.
 */
import { and, eq, ilike, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { auditLogs, facilities } from "@/db/schema";

export const dynamic = "force-dynamic";

type LastSearch = {
  q: string;
  organizationId: string;
  at: string;
};

const lastSearchedLog: LastSearch[] = [];

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const organizationId = (request.nextUrl.searchParams.get("organizationId") ?? "").trim();

    if (q.length < 2 || q.length > 40) {
      throw new Error("q must be between 2 and 40 characters");
    }
    if (!/^[A-Za-z0-9 ]+$/.test(q)) {
      throw new Error("q may only contain letters, numbers, and spaces");
    }
    if (!looksLikeUuid(organizationId)) {
      throw new Error("organizationId must be a uuid query parameter");
    }

    const at = new Date().toISOString();
    lastSearchedLog.push({ q, organizationId, at });

    const result = await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_organization_id', ${organizationId}, true)`,
      );
      const hits = await tx
        .select({
          id: facilities.id,
          name: facilities.name,
          location: facilities.location,
          facilityType: facilities.facilityType,
        })
        .from(facilities)
        .where(
          and(eq(facilities.organizationId, organizationId), ilike(facilities.name, `%${q}%`)),
        );
      const inserted = await tx
        .insert(auditLogs)
        .values({
          organizationId,
          action: "quick_search",
          entityType: "facility_search",
          metadata: { q, at },
        })
        .returning({ id: auditLogs.id });
      return { hits, auditLogId: inserted[0]?.id ?? null };
    });

    return NextResponse.json({
      ok: true,
      query: q,
      organizationId,
      hits: result.hits,
      lastSearchedLog,
      auditLogId: result.auditLogId,
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      return NextResponse.json({ ok: false, msg: "quick search failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, msg: error.message }, { status: 400 });
  }
}
