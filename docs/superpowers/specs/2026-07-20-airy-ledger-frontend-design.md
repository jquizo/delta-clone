# Airy Ledger frontend design

**Date**: 2026-07-20
**Status**: Approved, ready for implementation planning

## Summary

Two frontend improvements, scoped to `src/ui/` (and the Tailwind build config that supports it):

1. **Airy Ledger design system** — establish a real visual identity app-wide, replacing the currently-inert Tailwind utility classes with a working Tailwind setup and a warm, minimal-fintech visual language.
2. **Enriched holdings table** — add per-row 1-month price sparklines and pill-style P/L badges to the Dashboard holdings table, built on top of the Idea 1 visual language.

No changes to `domain/`, `data/`, or `worker/` beyond what's already there — this is a UI-layer effort only, consistent with the dependency direction in [`CLAUDE.md`](../../../CLAUDE.md) (`ui → app → data → network/IndexedDB`).

## Current state (baseline)

- Tailwind is referenced throughout `src/ui/` (e.g. `className="mx-auto max-w-3xl p-6"` in `Dashboard.tsx`) but **is not actually installed or configured**: no `tailwindcss` dependency, no `tailwind.config`, no CSS entry file imported in `main.tsx`. These classes are currently inert — the app renders with browser-default styling only.
- Pages/components affected: `AppRoot.tsx` (nav), `Dashboard.tsx`, `SummaryHeader.tsx`, `Transactions.tsx`, `Settings.tsx`, `HoldingDetail.tsx`, `StaleBadge.tsx`, `MarketStatusBadge.tsx`, `Toaster.tsx`.

## Idea 1: Airy Ledger design system

### Foundational fix (prerequisite)

Install and configure Tailwind so the utility classes already in the codebase (and any new ones) actually take effect:

- Add `tailwindcss` + its Vite plugin (or `postcss`/`autoprefixer`) as dev dependencies.
- Add a `tailwind.config` with the Airy Ledger palette baked in as theme extensions (see below).
- Add a CSS entry file (e.g. `src/index.css`) with Tailwind directives, imported once in `main.tsx`.

This is plumbing to make the stack described in `CLAUDE.md` actually work, not a new dependency in spirit.

### Design tokens

Baked into `tailwind.config` as theme extensions, used via semantic utility names rather than raw hex values in components:

| Token | Value | Use |
|---|---|---|
| `paper` | `#FAFAF8` | App background |
| `ink` | `#2B2B28` | Primary text |
| `muted` | `#8A8578` | Secondary text, labels |
| `hairline` | `#F2F0EA` / `#ECEAE4` | Borders/dividers |
| `accent` | `#3D5A80` | Nav active state, links |
| `positive` / `positive-soft` | `#3D7A5C` / `#E8F3EC` | Gains (text / badge bg) |
| `negative` / `negative-soft` | `#B23A3A` / `#FBEAEA` | Losses (text / badge bg) |

Typography: system sans stack throughout (no serif). One scale for headings vs. body vs. labels; labels are 11px, uppercase, letter-spaced, `muted` colored.

Surfaces: white cards (`rounded-xl`, `shadow-sm`) floating on the `paper` background, replacing the current bare `<table>`/unstyled-div look.

### Where it applies

- **`AppRoot.tsx`**: nav gets the underline-on-active treatment (mockup reference), still driven by the existing `activeView` Zustand state — no structural nav changes.
- **`Dashboard.tsx`** / **`SummaryHeader.tsx`**: summary stats become cards; holdings table gets card treatment (see Idea 2 for the table's own content changes).
- **`Transactions.tsx`**, **`Settings.tsx`**, **`HoldingDetail.tsx`**: restyled to match the token set; no content/structure changes.
- **`StaleBadge.tsx`**, **`MarketStatusBadge.tsx`**, **`Toaster.tsx`**: restyled to match, not rebuilt.

## Idea 2: Enriched holdings table

Applies to the Dashboard holdings table only.

- **Sparkline column**: for each holding, call the existing `useHistory(instrumentId, '1M')` hook (`src/app/queries.ts`) and render a small inline SVG polyline (~70×24px). No new charting dependency — a raw SVG polyline is lighter per-row than mounting a Recharts instance for something this small. Line color: `positive` if the range's last point > first point, `muted` if flat, `negative` if down — same classification logic used for the P/L badge.
- **P/L badge**: replaces the current plain-text `+$412` / `−$210` cell (`Dashboard.tsx` unrealized P/L column) with a pill using `positive-soft`/`negative-soft` backgrounds and `positive`/`negative` text.
- **Loading state**: while a row's history is loading, the sparkline column shows a flat placeholder line (matching existing `Skeleton` component conventions), not a spinner — avoids layout jumpiness in the table.
- **Data/perf note**: this fires one `useHistory` query per visible holding. Each is independently cached in Dexie with a TTL (`src/data/repositories.ts`), so it's cheap after first load; first load means N parallel worker requests where N = holding count. Acceptable for a personal-portfolio-sized holdings list — no throttling/virtualization added, since that would be solving a problem that doesn't currently exist.

## Testing

Per `CLAUDE.md` conventions (Vitest + React Testing Library):

- Extend `Dashboard`/`SummaryHeader` component tests to assert the P/L badge renders the correct sign/color class given mock quote data, and the sparkline renders given mock history data.
- Tests target the data-driven logic (positive/negative/flat classification, badge content), not the visual design itself — no pixel/snapshot testing of styling.

## Non-goals

- Dark mode.
- Mobile-specific layout changes.
- Content or structural changes to Transactions/Settings beyond restyling.
- Any change to `domain/`, `data/`, or `worker/` beyond the existing `useHistory` hook already covering sparkline data.
- Extending `HistoryRange` with a finer-grained bucket (e.g. `7D`) for sparklines — `1M` reuses the existing cached query as-is.

## Open items for implementation planning

- Exact Tailwind installation method: `@tailwindcss/vite` plugin vs. PostCSS config (recommend the Vite plugin, given the project's already on Vite 7).
- Whether design tokens live only in `tailwind.config` or also need CSS custom properties for the one dynamic value in this scope (sparkline stroke color, which is computed in JS/TSX, not CSS) — likely just passed as a prop/inline `stroke` attribute on the SVG, no CSS variable needed.
