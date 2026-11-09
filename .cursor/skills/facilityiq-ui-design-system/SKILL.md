---
name: facilityiq-ui-design-system
description: FacilityIQ visual design and styling standards — Tailwind v4 theme tokens, shadcn/ui primitives, app shell and sidebar, color palette and status colors, typography, data-dense layout, en-US/USD formatting helpers, and accessibility. Use when styling components, adding shadcn components, building page layouts, choosing colors, or formatting numbers, dates, and currency in the UI.
---

# UI Design System (FacilityIQ)

Source: Notion Coding Conventions §9 (brief). Most detail below is **derived from current code** and not yet documented in Notion — flag gaps rather than inventing new conventions.

## Stack

- Tailwind CSS v4 (CSS-first config in `src/app/globals.css` via `@theme inline`; there is no `tailwind.config`).
- shadcn/ui primitives in `src/components/ui` (Radix-based, `lucide` icons, `cn()` from `src/lib/utils`). Add new primitives with the shadcn CLI so they match `components.json`.
- `sonner` for toasts (`src/components/ui/sonner.tsx`).

> **Known discrepancy:** Notion says shadcn "New York" style; `components.json` declares `"style": "radix-nova"`. Don't change either silently — follow `components.json` for generated components and flag the mismatch for a standards decision.

## Visual language

- **Shell:** collapsible dark-navy sidebar (`bg-[#0B1220]`, `text-slate-200/300/400`, active item `bg-indigo-500/20 text-white`); see `src/components/layout/app-shell.tsx` and `navigation.ts`.
- **Content:** light analytics panels — `Card` with subtle borders/shadows on `bg-background`.
- **Accent:** blue/indigo (`--primary` is indigo in oklch; `text-indigo-700` for eyebrow labels).
- **Text:** headings `text-slate-950`, secondary `text-slate-600`, page titles via `PageIntro` (`src/components/dashboard/coming-next.tsx`).
- **Status colors:** green = healthy, amber = warning, red = critical. Errors use `rose` surfaces (`border-rose-200 bg-rose-50 text-rose-800`).
- **Numbers:** `tabular-nums` for KPI values and table figures.
- Prefer theme tokens (`bg-card`, `text-muted-foreground`, `border-border`) for new primitives; match existing slate/indigo usage in feature components for consistency.
- Chart color tokens (`--chart-1..5`) are currently grayscale; don't hardcode new chart palettes without a design decision.

## Layout

- Desktop-first, usable on tablet. Compact, data-dense layouts.
- Typography: Geist or Inter (`--font-sans`).
- Unbuilt pages render `ComingNext` — a routed, protected shell that states which phase lights it up. **Never** stock screenshots, lorem ipsum, or hardcoded KPI numbers.

## Formatting

Always use shared helpers; never ad-hoc `toFixed` or `toLocaleString` in components:

- `src/lib/format.ts` — `formatCount`, `formatSquareFeet`, `formatUtcDate`, `ASSET_TYPE_LABELS` (en-US, UTC).
- `src/lib/analytics/display.ts` — `formatKpiValue`, `formatMeasure`, `formatComparison`, `unavailableLabel`.
- Missing values render as `—` or an explicit "unavailable" label, never `0`.
- Currency displays USD; formatting must not change stored decimal precision.

## Accessibility

- Use shadcn/Radix primitives for dialogs, menus, selects, tooltips — don't hand-roll focus management.
- Every input has a `Label`; icon-only buttons have `aria-label`.
- Don't rely on color alone for status — pair with text or icon.
- Error and empty states use readable text, not just color.

## Component placement

`ui` primitives contain no FacilityIQ queries or KPI rules. Feature components go in the domain folder (`dashboard`, `charts`, `3d`, `facilities`, `scenarios`, `insights`, `settings`, `auth`, `layout`). See `facilityiq-ui-states-and-forms` for state handling.
