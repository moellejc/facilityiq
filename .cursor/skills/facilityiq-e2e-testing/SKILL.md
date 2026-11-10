---
name: facilityiq-e2e-testing
description: FacilityIQ Playwright end-to-end test standards — setup (not yet installed), CI skip-if-absent behavior, required happy path, 3D/WebGL interaction coverage, UI state coverage, seeded demo accounts, and no fixed sleeps. Use when adding Playwright specs in tests/e2e, testing browser or 3D interactions, or setting up e2e infrastructure.
---

# End-to-End Testing (FacilityIQ)

Source: Notion Unit Test Standards §1–2, §6–7; CI Process §2.

## Current state

- `tests/e2e/` exists but has **no specs**, and `@playwright/test` is **not** in `package.json`.
- CI runs `pnpm exec playwright test` only if `tests/e2e/**/*.spec.ts` exists; otherwise it logs a skip.
- **Once the first spec lands, Playwright must pass in CI.** Adding the first spec therefore requires: adding `@playwright/test` (dev dependency), a `playwright.config.ts` (baseURL `http://localhost:43123`, webServer or compose-based startup, seeded DB), browser install in CI, and confirming the CI job runs it. Treat that as its own reviewed change (`facilityiq-dependency-upgrades`, `facilityiq-ci-cd`).

## Required coverage (as features land)

- **Happy path:** sign in → select facility → open 3D twin → select asset → view metrics → create scenario → save results.
- **3D/WebGL:** asset selection, layer visibility, camera reset, heatmap toggle and no-data appearance, layout persistence; mount/unmount cleanup (navigate away and back).
- **UI states:** slow, empty, unavailable, forbidden, not-found, failed; form submission failure and recovery.
- **Roles:** viewer sees no mutation affordances _and_ direct mutations fail; finance-only data hidden from non-finance roles.

## Conventions

- Use seeded demo accounts from `README.md` (`admin@`, `operations@`, `finance@`, `viewer@acme.example`).
- Seed deterministically before the suite; tests must not depend on each other's state.
- Use Playwright locators and web-first assertions (`expect(locator).toBeVisible()`); **never fixed sleeps**.
- Prefer role/label locators; add `data-testid` only where semantics don't suffice (e.g. canvas overlays).
- For WebGL, assert on DOM-side state (selection panel, toolbar, legend) rather than pixels where possible.
- Report: spec count, pass/fail, browser(s); say "skipped (no specs)" when applicable.
