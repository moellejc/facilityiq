import type { InsightDraft } from "./insight-schema";

export type { InsightDraft } from "./insight-schema";

/**
 * Providers return drafts. They must not import repositories or execute SQL.
 * Persistence happens only in the insight service.
 */
export interface InsightsProvider {
  readonly id: string;
  generate(): Promise<InsightDraft[]>;
}
