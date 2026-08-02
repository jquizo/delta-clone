# CLAUDE.md

Conventions for **Delta-Clone**, a local-first portfolio tracker web app (ASX / NASDAQ / LSE / SGX). No trading, no accounts, no backend beyond a thin proxy.

## Stack

- **Vite + React + TypeScript** (`strict: true`)
- **Tailwind CSS**
- **Dexie.js** (IndexedDB) for local storage
- **TanStack Query** for server-data caching (prices, FX)
- **Zustand** for UI state only (active portfolio, display currency, filters)
- **Recharts** (allocation donuts, snapshot area chart) + **TradingView Lightweight Charts** (per-holding price history)
- **Vitest** + React Testing Library

## Architecture rules

Dependency direction is one-way: `ui → app → data → network/IndexedDB`, with `domain` sitting underneath everything and depending on nothing.

- **`src/domain/`** — pure TypeScript only. No imports from React, `fetch`, or Dexie. All portfolio and currency math lives here (`deriveHoldings`, `summarise`, `convert`, `isMarketOpen`, etc.) and must be unit tested.
- **`src/data/`** — the only layer allowed to perform I/O (network calls, Dexie reads/writes). Price and FX providers, repositories, the Dexie schema.
- **`src/app/`** — wiring: TanStack Query hooks, the Zustand store, selectors that compose `data` + `domain` into view models.
- **`src/ui/`** — components and pages. Never compute financial values inline — a component doing its own average-cost or currency math is a code review failure.

### Instrument identity

Instrument IDs are **provider-neutral** (`ASX:BHP`, `NASDAQ:AAPL`), never the raw Yahoo symbol (`BHP.AX`). Each price-provider adapter owns its own symbol-suffix map and translates only at its own boundary. This is what makes swapping providers a one-file change instead of a data migration.

### Money and currency

- All amounts are stored in **native currency**, never converted on write.
- Conversion happens only at render time, through a single function: `convert(amount, from, to, rates)` in `src/domain/money.ts`. Every displayed number passes through this one choke point.
- Each transaction stores `fxRateToBase`, captured at entry time, in addition to whatever the live rate is at render time.
- **GBp → GBP normalisation happens inside the Yahoo adapter (`src/data/yahooProvider.ts`) only — never in the Worker.** Do it in exactly one place.

## Folder structure

```
delta-clone/
├── CLAUDE.md
├── worker/                       # Cloudflare Worker proxy
│   └── src/index.ts              # /quote  /history  /search  /fx  + edge cache
├── src/
│   ├── domain/                   # Pure TypeScript. No React, no fetch, no Dexie.
│   │   ├── types.ts              # Instrument, Transaction, Holding, PriceQuote, FxRate...
│   │   ├── holdings.ts           # deriveHoldings(transactions): Holding[]
│   │   ├── portfolio.ts          # summarise(holdings, quotes, fxRates, baseCurrency)
│   │   ├── money.ts              # convert(), formatMoney() — all currency math lives here
│   │   ├── marketHours.ts        # isMarketOpen(exchange, date)
│   │   └── __tests__/
│   ├── data/                     # Talks to the outside world. Nothing else does.
│   │   ├── priceProvider.ts      # PriceProvider interface
│   │   ├── yahooProvider.ts
│   │   ├── fxProvider.ts
│   │   ├── db.ts                 # Dexie schema + migrations
│   │   └── repositories.ts       # transactionRepo, portfolioRepo (validated CRUD)
│   ├── app/
│   │   ├── queries.ts            # useQuotes(), useFxRates(), useHistory()
│   │   ├── store.ts              # Zustand: displayCurrency, activePortfolioId, filters
│   │   └── selectors.ts          # Composes db + quotes + fx → view models for the UI
│   ├── ui/
│   │   ├── components/           # HoldingsTable, SummaryHeader, AllocationDonut,
│   │   │                         #   TransactionForm, SymbolSearch, StaleBadge, PriceChart...
│   │   └── pages/                # Dashboard, HoldingDetail, Transactions, Settings
│   └── main.tsx
└── .env.example                  # VITE_WORKER_URL=...
```

## Conventions

- Named exports only.
- `any` is banned (enforced via ESLint).
- **zod** validates every I/O boundary: API responses, form inputs, CSV rows, Dexie reads after migrations. `domain/` only ever sees already-valid data.
- Conventional commits.
- One prompt/task = one vertical slice = one (or a few) commits. Commit before starting the next slice.
