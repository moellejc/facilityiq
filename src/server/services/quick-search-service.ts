import "server-only";

import { parseQuickSearchQuery } from "@/lib/quick-search";

import { searchFacilitiesByName } from "../repositories/quick-search";

type LastSearch = {
  q: string;
  organizationId: string;
  at: string;
};

const lastSearchedLog: LastSearch[] = [];

export async function quickSearchFacilities(input: { q: string; organizationId: string }) {
  const parsed = parseQuickSearchQuery(input);
  const at = new Date().toISOString();
  lastSearchedLog.push({ q: parsed.q, organizationId: parsed.organizationId, at });
  const result = await searchFacilitiesByName(parsed.organizationId, parsed.q, at);
  return {
    ok: true as const,
    query: parsed.q,
    organizationId: parsed.organizationId,
    hits: result.hits,
    lastSearchedLog,
    auditLogId: result.auditLogId,
  };
}
