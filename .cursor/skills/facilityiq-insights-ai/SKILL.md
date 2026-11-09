---
name: facilityiq-insights-ai
description: FacilityIQ insights and AI standards — InsightsProvider interface, DeterministicRulesProvider default, insight draft and evidence Zod schemas, optional LLM language enrichment behind AI_API_KEY, no LLM numbers or mutations, and the no-API-key requirement. Use when working in src/lib/ai, insight rules, insight-service, insight UI, or anything involving an LLM.
---

# Insights and AI (FacilityIQ)

Source: Notion Coding Conventions §12, SDLC §4–5, Unit Test Standards §2.

## Non-negotiables

- **The app must work with `AI_API_KEY` empty.** Deterministic rules are always the default and the fallback.
- An LLM may only **rephrase language** of already-validated insights. It never computes, changes, or invents financial figures, KPIs, severities, or references.
- All model output is Zod-validated; invalid output is rejected and the deterministic text kept.
- Model output cannot trigger mutations. Persistence only through `insight-service`.
- Estimated impact is labeled as an estimate (`impactLabel: "estimate" | "not_calculable"`).

## Code map (`src/lib/ai`)

| File                     | Role                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `provider.ts`            | `InsightsProvider { id; generate(): Promise<InsightDraft[]> }`. Providers must not import repositories or run SQL                |
| `deterministic-rules.ts` | `DeterministicRulesProvider` + `detectInsightRules(facts)`; thresholds as named constants                                        |
| `insight-schema.ts`      | `insightDraftSchema`, `insightEvidenceSchema` (strict), insight types and severities                                             |
| `llm-language.ts`        | `enrichInsightLanguage(drafts, { apiKey, fetchImpl })` — returns drafts unchanged without a key; never replaces financial fields |
| `match.ts`               | Matching insights to twin objects                                                                                                |

Orchestration and persistence: `src/server/services/insight-service.ts`; storage in `insights` with JSONB `evidence`.

## Adding a rule

1. Pure function over `InsightRuleInput` (metrics, costs, period) — no DB, no network.
2. Thresholds as named constants; stable `ruleId` (e.g. `excessive-utilization:${areaId}`).
3. Evidence references real stored metrics (`operational_metrics` / `financial_metrics`) with units; `estimatedFinancialImpact` is deterministic or `null`.
4. Add to `detectInsightRules`; insight type to `insightTypes` if new.
5. Unit tests (`tests/unit/insights.test.ts`): fires on the seeded problem condition, does **not** fire on healthy data, confidence/severity as expected.
6. Confirm the seed story still produces the expected six insights (`facilityiq-seed-data`).

## LLM changes

- Inject `fetchImpl` for tests; tests never hit the network.
- Validate with `parseInsightLanguage`; on any mismatch, set `rejected` and keep originals.
- Don't send secrets or unnecessary tenant data in prompts.
- Never hold a DB transaction open during an LLM call.
- Verify and report a **no-AI-key run** whenever insights are touched.
