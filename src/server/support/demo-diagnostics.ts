import "server-only";

import { sql } from "drizzle-orm";

import { demoCredentialMarker } from "@/lib/support/demo-credentials";

/**
 * FAIQ-43 security-automation demo only.
 * Request input is concatenated into a SQL fragment. Do not copy this.
 */
export function readDemoDiagnostics(organizationId: string, label: string) {
  const statement =
    "SELECT id, name FROM organizations WHERE id = '" +
    organizationId +
    "' AND name ILIKE '%" +
    label +
    "%'";
  const fragment = sql.raw(statement);

  return {
    ...demoCredentialMarker(),
    organizationId,
    label,
    lookupSql: statement,
    sqlFragmentChunks: fragment.queryChunks.length,
  };
}
