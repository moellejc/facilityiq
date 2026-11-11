# Draft Linear ticket (not created): Finance cost by category

Draft for a live demo. It was **not** filed in Linear. Create it on team FacilityIQ with the Feature label when you want a real FAIQ number. Backlog-first intake is the written rule and is not enforced by `pnpm guard`.

**Title:** Finance managers can see operating cost by category for a period

**Why:** Finance asks where the money went this period. They already have Operating Costs, Cost per Order, and Asset Costs, and not a category page.

**Acceptance criteria**

- New page `/finance/cost-by-category` under Finance, after Asset Costs. Existing nav order stays put.
- Shows total and per-category cost for the selected period (the existing From/To controls). Categories come from the `cost_category` enum.
- Requires `finance:read`. `viewer` and `operations_manager` behave as on the other Finance pages.
- Missing data shows an em dash with the unavailable reason, never 0.
- Money is deterministic TypeScript from `financial_metrics`. No LLM.
- Tenant scoped: another organization cannot see these rows.
- Tests: a unit test for the category rollup with exact seed numbers, an integration test for org isolation, and the nav-order test still green.

**Out of scope:** new schema or migrations, exports, charts beyond the existing `NamedBarChart`.

**Pointers:** `src/lib/analytics/aggregate.ts` (category costs are already computed) and `src/app/(dashboard)/finance/cost-per-order/page.tsx` (the page shape).

**Why it is a good first ticket:** page, nav, service, and tests, with a small blast radius. The wrong implementation (Pages Router data fetching, Drizzle in the page, a client component importing a service) is `demo/bad-change.patch`, which `pnpm guard` rejects.
