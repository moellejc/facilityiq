/**
 * Insight generation is Phase 4. The interface is here so a rules provider and
 * an optional LLM provider can be added without changing persistence.
 * Model output must be validated and cannot call repositories directly.
 */
export type InsightDraft = {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  estimatedFinancialImpact: number | null;
  evidence: Record<string, unknown>;
};

export interface InsightsProvider {
  readonly id: string;
  generate(): Promise<InsightDraft[]>;
}
