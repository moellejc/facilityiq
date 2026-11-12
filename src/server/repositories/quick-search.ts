import { and, eq, ilike } from "drizzle-orm";

import { auditLogs, facilities } from "@/db/schema";
import { withTenant } from "@/db/tenant";

export async function searchFacilitiesByName(organizationId: string, q: string, at: string) {
  return withTenant({ organizationId }, async (tx) => {
    const hits = await tx
      .select({
        id: facilities.id,
        name: facilities.name,
        location: facilities.location,
        facilityType: facilities.facilityType,
      })
      .from(facilities)
      .where(and(eq(facilities.organizationId, organizationId), ilike(facilities.name, `%${q}%`)));
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
}
