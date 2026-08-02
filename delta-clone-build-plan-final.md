# Delta-Style Portfolio Tracker — Final Analysis & Build Plan

*A personal investment tracker for ASX / NASDAQ / LSE / SGX, built with Claude Code by a frontend developer. Local-first, no trading, no accounts.*

*This is a merged document, synthesised from two independent build plans. Where the two agreed, that's the plan. Where they diverged, the choice made and the reasoning are called out explicitly so you know it was a decision, not an accident.*

---

## 0. Why portfolio trackers are hard (and how that shapes everything below)

Four realities drive every architectural decision in this plan:

**1. Market data is the product — and the bottleneck.** US stock data is a commodity; free ASX and SGX data is not. Most "free stock API" tiers quietly cover only US exchanges, or cap you at 25–100 calls/day — useless for refreshing 50+ tickers. The data layer is where this project lives or dies, so it's a swappable adapter from day one.

**2. Every number has three currencies attached.** A holding of DBS (SGX) has an instrument currency (SGD), possibly a different settlement currency (you might have paid from an AUD account), and a display currency (your base, probably AUD). Naive trackers convert on write and can never undo it. The rule: **store amounts in their native currency, convert only at render time.**

**3. Time zones make "today's change" ambiguous.** At 9pm Melbourne time, the ASX has been closed for hours while NASDAQ is mid-session and LSE is closing. The honest solution: show per-holding change relative to *that exchange's* previous close, display an open/closed indicator, and timestamp every price. Never pretend stale data is live.

**4. Holdings are not data — they're a calculation.** You store **transactions**; holdings (quantity, average cost, P/L) are *derived* by replaying them. This is what makes the core independently testable and lets you answer "what's my realised gain?" correctly.

---

## Part 1 — Delta by eToro: Feature Analysis

Delta's core loop: *add your transactions once → open the app any time → instantly see what you're worth, what moved, and why.* A tracker, not a broker — it never touches money, only mirrors it.

### Must-have (MVP)

| # | Feature | What it does | Complexity |
|---|---------|--------------|------------|
| 1 | Transaction entry (buy/sell/dividend) | Add, edit, delete: symbol, quantity, price, fees, date, currency | **Medium** — the form is easy; edit/delete correctness and validation is where the effort goes |
| 2 | Derived holdings view | Per-symbol quantity, average cost, current value, unrealised P/L computed from transactions | **Medium** — pure math, but partial sells and zero-quantity edge cases must be exact |
| 3 | Live-ish prices for all 4 exchanges | Fetch quotes for every held symbol, cached, with visible "as of" timestamps | **High** — the hardest MVP feature (CORS, rate limits, exchange coverage) |
| 4 | Base-currency conversion | Everything rolls up to one display currency using FX rates | **Medium** — trivial math, but touches every displayed number |
| 5 | Portfolio summary | Total value, total cost, unrealised P/L, today's change | **Low** — once 2–4 exist, this is a sum |
| 6 | Symbol search / add | "BHP" → pick BHP.AX vs BHP (NYSE), exchange + currency shown | **Medium** — needs a search endpoint and careful symbol namespacing |

### Should-have — genuinely useful day-to-day

| Feature | Why it matters | Complexity |
|---------|----------------|------------|
| Daily change per holding + market open/closed badge | The #1 thing you check daily | **Medium** |
| Allocation breakdown (by exchange / currency / sector) | Answers "am I overexposed?" | **Low** (once data exists) |
| Portfolio value history chart | Delta's signature screen | **Medium** via daily snapshots (see §3) — **High** if reconstructed from scratch |
| Per-holding price history chart | Second most-used screen; free from the same API you already have | **Low–Medium** |
| Realised P/L on sells | Without it, selling breaks your return numbers | **Medium** — average-cost method keeps it sane |
| Dividend transactions | Income-heavy ASX portfolios are misleading without them | **Low–Medium** |
| Multiple portfolios / accounts | Super vs personal vs spouse | **Low** — `portfolioId` FK from day one makes this nearly free |
| CSV import/export | Nobody hand-enters 50 holdings twice; also your backup story | **Medium** |

### Nice-to-have — later, non-blocking

| Feature | Complexity | Note |
|---------|------------|------|
| Price alerts / push notifications | **High** | Needs a server running when your browser is closed — skip until you want a backend |
| News feed per holding | **Medium** | Another API dependency, low value relative to cost |
| Benchmark comparison (vs S&P 500 / ASX 200) | **Medium** | Needs the history chart first |
| Crypto support | **Medium** | Easier data providers; model already accommodates it |
| Cloud sync across devices | **High** | Turns a local app into a product with auth, conflict resolution, hosting |
| Tax-lot / FIFO cost basis, CGT reports | **High** | Country-specific rules; average cost is fine for a tracker |

**Ruthless prioritisation takeaway:** MVP = features 1–6 only. The trap to avoid is starting with the history chart — it depends on everything else and on historical data you won't have on day one. Snapshots (see §3) let you start accumulating history from week one even though the chart ships later.

---

## Part 2 — Build Plan for Claude Code

### 1. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **React + TypeScript, Vite** | Shallowest ramp from your HTML/CSS/JS background, and the app is fundamentally *derived, frequently-updating state* (50+ holdings × live prices × currency toggling) — React's rendering model solves exactly that problem. TypeScript is non-negotiable: this app is all data modelling, and typed shapes catch currency mix-ups and unit errors at compile time. Vite over Next.js — no SSR, no SEO, no routes worth pre-rendering. |
| Styling | **Tailwind CSS** | You already know it. Zero decision cost. |
| Server-data layer | **TanStack Query** | Purpose-built for the hardest part of this app: caching, `staleTime`, background refetch, retry with backoff, request deduplication. Hand-rolling this is where solo projects stall. |
| Client state | **Zustand** | UI state only (active portfolio, display currency, filters). Transactions live in the DB, prices live in Query's cache. |
| Storage | **IndexedDB via Dexie.js** | Local-first: no backend, no auth, no hosting bill, your financial data never leaves your machine. Typed tables, indexes, `useLiveQuery` hooks over raw IndexedDB's miserable API. localStorage is wrong (string-only, ~5MB cap, synchronous). |
| Charting | **Recharts** for allocation donuts and the snapshot area chart; **TradingView Lightweight Charts** for the per-holding price-history screen | Recharts is declarative and plays well with Tailwind for simple charts; Lightweight Charts is purpose-built for financial time series (proper time axes, 45KB) — don't force Recharts to do candlesticks. |
| Price + FX data | **Yahoo Finance's unofficial v8 chart endpoint, behind your own Cloudflare Worker proxy**, with **Frankfurter.dev as an independent FX fallback** | Yahoo is the only free source with genuinely good ASX+SGX+LSE+NASDAQ coverage, quotes, previous close, and market state in one response. It's unofficial and can break — hence the adapter seam (§4) and a paid escape hatch identified in advance. FX rides Yahoo's `=X` symbols for convenience, but a Yahoo outage shouldn't take down currency conversion too — Frankfurter (free, keyless, ECB rates, ~daily granularity) is the independent second leg. |
| Proxy | **Cloudflare Worker** (free tier: 100k req/day) | Unavoidable for two reasons: browsers can't call Yahoo directly (CORS), and if you ever switch to a keyed API, the key must live server-side. ~50 lines, free, and it's where response caching lives. |
| Testing | **Vitest** + React Testing Library for a handful of components | Native to Vite. The domain layer is pure functions — the highest-value tests you'll ever write per line. |

### 2. Architecture

```
delta-clone/
├── CLAUDE.md                     # Project conventions for Claude Code (see prompt 0)
├── worker/                       # Cloudflare Worker proxy (own tiny sub-project)
│   └── src/index.ts              # /quote  /history  /search  /fx  + edge cache
├── src/
│   ├── domain/                   # ★ Pure TypeScript. No React, no fetch, no Dexie.
│   │   ├── types.ts              # Instrument, Transaction, Holding, PriceQuote, FxRate...
│   │   ├── holdings.ts           # deriveHoldings(transactions): Holding[]
│   │   ├── portfolio.ts          # summarise(holdings, quotes, fxRates, baseCurrency)
│   │   ├── money.ts              # convert(), formatMoney() — ALL currency math lives here
│   │   ├── marketHours.ts        # isMarketOpen(exchange, date) — 4 exchanges, 4 schedules
│   │   └── __tests__/            # The bulk of your unit tests, incl. the golden fixture
│   ├── data/                     # Talks to the outside world. Nothing else does.
│   │   ├── priceProvider.ts      # PriceProvider interface — the seam that saves you
│   │   ├── yahooProvider.ts      # Implementation hitting your Worker
│   │   ├── fxProvider.ts         # Frankfurter fallback, same interface shape
│   │   ├── db.ts                 # Dexie schema + migrations
│   │   └── repositories.ts       # transactionRepo, portfolioRepo (validated CRUD)
│   ├── app/                      # Wiring
│   │   ├── queries.ts            # TanStack Query hooks: useQuotes(), useFxRates(), useHistory()
│   │   ├── store.ts              # Zustand: displayCurrency, activePortfolioId, filters
│   │   └── selectors.ts          # Composes db + quotes + fx → view models for the UI
│   ├── ui/
│   │   ├── components/           # HoldingsTable, SummaryHeader, AllocationDonut,
│   │   │                         #   TransactionForm, SymbolSearch, StaleBadge, PriceChart...
│   │   └── pages/                # Dashboard, HoldingDetail, Transactions, Settings
│   └── main.tsx
└── .env.example                  # VITE_WORKER_URL=...
```

**Dependency rule (enforce it):**

```
        UI  →  app (queries / store / selectors)  →  data  →  network / IndexedDB
         \___________________↘        ↙___________________/
                           domain (pure)
                    depends on NOTHING above it
```

- **`domain/`** — pure functions, plain data in, plain data out. `deriveHoldings()` never knows prices exist. Independently testable, no mocks.
- **`data/`** — the only layer allowed to `fetch` or touch Dexie. The `PriceProvider` interface means Yahoo can be ripped out for EODHD in one file.
- **`app/`** — glues live data to domain functions: `useLiveQuery` streams transactions from Dexie, `useQuotes` streams prices from the Worker, selectors run domain math over both.
- **`ui/`** — renders view models, fires callbacks. A component computing an average cost inline is a code review failure.

Main-screen data flow: Dexie transactions → `deriveHoldings()` → symbol list → `useQuotes(symbols)` → Worker → Yahoo → `summarise(holdings, quotes, fx, 'AUD')` → `<HoldingsTable/>`.

### 3. Data modelling

```typescript
// domain/types.ts

type Currency = 'AUD' | 'USD' | 'GBP' | 'SGD' | string;   // ISO 4217
type Exchange = 'ASX' | 'NASDAQ' | 'LSE' | 'SGX';

/**
 * Identity decision: instrument IDs are PROVIDER-NEUTRAL, not the raw
 * Yahoo symbol. Yahoo is the documented single point of failure in this
 * plan (§4) — if it ever needs replacing, provider-neutral IDs mean your
 * STORED DATA (transactions, instruments, snapshots) never needs
 * migrating, only the adapter that maps id → provider symbol changes.
 * The one-time cost is a suffix-map lookup inside each adapter; the
 * payoff is that a provider swap is a one-file change, full stop.
 */
interface Instrument {
  id: string;             // 'ASX:BHP', 'NASDAQ:AAPL', 'LSE:VOD', 'SGX:D05'  ← primary key
  exchange: Exchange;
  currency: Currency;     // the currency the instrument TRADES in
  name: string;            // 'BHP Group Ltd'
}

/** The only financial facts you store. Everything else is derived. */
interface Transaction {
  id: string;              // crypto.randomUUID()
  portfolioId: string;
  instrumentId: string;    // FK → Instrument.id
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  quantity: number;        // shares (0 allowed for DIVIDEND cash amounts)
  price: number;           // per share, in `currency`
  fees: number;            // in `currency`
  currency: Currency;      // settlement currency (usually = instrument currency, not always)
  tradeDate: string;       // 'YYYY-MM-DD' — a calendar date, deliberately NOT a timestamp
  fxRateToBase?: number;   // rate from `currency` to the portfolio's baseCurrency AT ENTRY TIME
  note?: string;
}

interface Portfolio {
  id: string;
  name: string;             // 'Personal', 'SMSF'
  baseCurrency: Currency;
}

/** DERIVED — never persisted. Recomputed from transactions on every read. */
interface Holding {
  instrumentId: string;
  quantity: number;
  avgCostPerShare: number;    // average-cost method, in instrument currency
  totalCost: number;          // remaining cost basis after sells
  realizedPnl: number;        // in instrument currency
}

/** Cached market data — always timestamped, never trusted blindly. */
interface PriceQuote {
  instrumentId: string;
  price: number;
  currency: Currency;
  previousClose: number;      // basis for "today's change", per that exchange's session
  marketState: 'OPEN' | 'CLOSED' | 'PRE' | 'POST';
  asOf: number;                // epoch ms — drives the staleness UI
}

interface FxRate { pair: string; /* 'USDAUD' */ rate: number; asOf: number; source: 'yahoo' | 'frankfurter'; }

/** Persisted once per day — makes the history chart possible later, cheaply. */
interface DailySnapshot {
  id: string;                 // `${portfolioId}:${date}`
  portfolioId: string;
  date: string;                // 'YYYY-MM-DD'
  valueInBase: number;
  costInBase: number;
}
```

**Multi-currency without the overcomplication:**
- Transactions store native (settlement) currency amounts. Nothing is converted on write.
- One function — `convert(amount, from, to, rates)` in `money.ts` — does all conversion, always at render time, pivoting through the portfolio's base currency. Every number on screen passes through this one choke point; a currency bug has exactly one place to hide.
- **`fxRateToBase` captured on the transaction at entry time.** This is the one field that separates "a display tracker" from "a display tracker whose realised P/L in base currency is still correct in five years." Live conversion (current-rate) is what you display today; the stored entry-time rate is what lets you later decompose returns into *price gain* vs *FX gain* without needing a full historical-FX time series. Cheap now, valuable later — don't skip it even though it does nothing visible on day one.
- FX rates: Yahoo's `=X` symbols (`AUDUSD=X`) ride the same provider, cache, and staleness machinery as stock quotes — the pragmatic default. Frankfurter.dev is wired in behind the same `getFxRates()` interface as a fallback, so a Yahoo outage degrades prices but conversion keeps working.

**Multi-exchange without the overcomplication:** the provider-neutral `Instrument.id` is the identity everywhere — DB, cache keys, UI. Each adapter owns its own symbol-suffix map (Yahoo: ASX→`.AX`, LSE→`.L`, SGX→`.SI`, NASDAQ→none; EODHD: `.AU`/`.LSE`/`.SG`/`.US`) and translates at its own boundary only. LSE's one real quirk: most stocks quote in **pence (GBp), not pounds** — a classic 100× bug. **Decision: normalise GBp→GBP inside the adapter (`data/yahooProvider.ts`), not the Worker.** This keeps the Worker a dumb, provider-agnostic pass-through you can debug against raw Yahoo JSON, and keeps all provider-specific quirks (units, suffixes, field names) in exactly one layer designed to absorb them. Whichever side you pick, do it in exactly one place — the only fatal option is doing it in both and dividing by 100 twice.

**Why snapshots instead of reconstructing history:** rebuilding a portfolio-value chart from historical prices × historical FX × transaction replay is the single most complex feature in Delta-like apps. A nightly `DailySnapshot`, written opportunistically on app open, costs ~15 lines and gives you a real chart within weeks. Ship the cheap version; only upgrade to full reconstruction if you ever need history predating first use.

### 4. API strategy

**The honest landscape:** for hobby-scale coverage of ASX + SGX simultaneously, free options are thin. Alpha Vantage's free tier is throttled to ~25 requests/day. Marketstack's free tier is ~100/month, EOD only. Finnhub's free tier is effectively US-only for equities. Twelve Data's free tier is credible in volume but gates non-US exchanges behind paid plans. **Yahoo Finance's unofficial v8 chart endpoint remains the pragmatic free choice**: all four exchanges, previous close, market state, and historical series in one consistent shape — with the known cost that it's unofficial and can change without notice. Primary + adapter seam + pre-identified paid fallback (EODHD's all-world plan or Twelve Data Grow, ~US$20–30/mo) if it ever hard-breaks.

**The adapter seam (your insurance policy):**

```typescript
// data/priceProvider.ts
export interface PriceProvider {
  getQuotes(ids: string[]): Promise<PriceQuote[]>;
  getHistory(id: string, range: '1M'|'6M'|'1Y'|'5Y'): Promise<{ date: string; close: number }[]>;
  searchInstruments(query: string): Promise<Instrument[]>;
}
export interface FxProvider {
  getFxRates(pairs: string[]): Promise<FxRate[]>;
}
```

**Concrete fetches — ASX and SGX**, via your Worker (forwards to Yahoo with a browser User-Agent, adds CORS headers):

```typescript
// BHP on the ASX
const r = await fetch(`${WORKER_URL}/quote?symbols=BHP.AX`);
// Worker forwards to: https://query1.finance.yahoo.com/v8/finance/chart/BHP.AX?range=1d&interval=1d
const j = await r.json();
const meta = j.chart.result[0].meta;
// meta.regularMarketPrice → 45.12   meta.currency → 'AUD'
// meta.chartPreviousClose → 44.80   meta.regularMarketTime → epoch secs (your `asOf`)

// DBS Group on the SGX — identical shape, different suffix
await fetch(`${WORKER_URL}/quote?symbols=D05.SI`);
// meta.regularMarketPrice → 39.85   meta.currency → 'SGD'

// Suffix map (Yahoo adapter only): ASX → .AX | SGX → .SI | LSE → .L | NASDAQ → no suffix
// FX rides the same endpoint: symbols=AUDUSD=X,GBPAUD=X,SGDAUD=X
// Fallback FX: https://api.frankfurter.dev/v1/latest?from=USD&to=AUD,GBP,SGD (no key required)
```

Why the v8 chart endpoint rather than a batch quote endpoint: it has historically stayed reachable unauthenticated more reliably than Yahoo's older batch-quote endpoints, which have been more prone to cookie/crumb gating. The trade-off — one upstream request per symbol instead of one batched call — is invisible to you because the fan-out happens inside your Worker with edge caching, not in the browser.

The Worker itself is ~50 lines: read `symbols`, fan out to Yahoo, set a `User-Agent`, cache at the edge (`Cache-Control: max-age=300`), return JSON with CORS headers scoped to your app's origin. Add `/history` (same endpoint, wider `range`) and `/search` (Yahoo's search endpoint) alongside `/quote`.

**Rate limits, caching, staleness — the three-layer defence:**

1. **Edge cache (Worker):** 5-minute TTL per symbol batch. Opening the app on phone and laptop still hits Yahoo once. Keeps a personal app far below any plausible throttling threshold.
2. **Client cache (TanStack Query):** `staleTime: 5 min`, `refetchInterval` gated by market state — no reason to poll BHP.AX at midnight Sydney time. `isMarketOpen(exchange, now)` (four exchanges, four schedules, `Intl` timezone handling) cuts request volume by ~70% and is exactly the kind of pure, testable function that belongs in `domain/`.
3. **Graceful staleness (UI contract):** persist the last-good quote per instrument in Dexie. On fetch failure, render from the persisted quote with an amber "as of Tue 16:00 AEST" badge — never blank the portfolio, never show ghost zeros. One symbol failing greys one row; it never fails the whole screen.

### 5. Claude Code workflow — the exact prompt sequence

Walking-skeleton principle: **the accounting core comes first and is proven with tests before any network call exists**; **prompt 2 completes the walking skeleton with a real live price for a real transaction, end to end.** Every prompt after that widens the pipe; none of them changes its shape. Verify and commit after each one.

> **Prompt 0 — Conventions file (before any code):**
> "Create a CLAUDE.md for a local-first portfolio tracker web app. Stack: Vite + React + TypeScript (strict), Tailwind, Dexie (IndexedDB), TanStack Query, Zustand, Recharts + TradingView Lightweight Charts, Vitest. Architecture rules: `src/domain` is pure TypeScript with no imports from React, fetch, or Dexie — all portfolio/currency math lives there and must be unit tested; `src/data` is the only layer that performs I/O; UI components never compute financial values inline. Instrument identity is a provider-neutral id (`ASX:BHP`, not the raw Yahoo symbol `BHP.AX`) — each price-provider adapter owns its own symbol-suffix mapping and translates only at its own boundary. All money amounts are stored in native currency and converted only at render time via a single `convert()` function; each transaction also stores `fxRateToBase` captured at entry time. GBp→GBP normalisation happens inside the Yahoo adapter only, never in the Worker. Conventions: named exports, no `any`, zod validation at all I/O boundaries, conventional commits. Include the folder structure from this plan."

> **Prompt 1 — Domain core, tested first:**
> "Define the domain types (Instrument, Transaction, Portfolio, Holding, PriceQuote, FxRate, DailySnapshot) per CLAUDE.md, using provider-neutral instrument ids. Implement `deriveHoldings(transactions)` in `src/domain/holdings.ts` using the average-cost method, handling: multiple buys, partial sells (reduce quantity, keep avg cost, accrue realizedPnl), sells to zero, dividends (cash only, no quantity change), and a sell that would exceed quantity held as of that date (should be flaggable, not silently allowed). Write Vitest tests for every case first, including one realistic multi-currency, multi-exchange 'golden fixture' transaction history with hand-calculated expected outputs — this fixture gets reused in later prompts. Then render a Dashboard page showing a holdings table computed from a hardcoded array of 3 transactions (BHP buy, AAPL buy, AAPL partial sell). No fetching, no storage yet. Verify: `npm test` passes and the table shows correct derived quantities and average costs."

> **Prompt 2 — Walking skeleton complete (live price, end to end):**
> "Create a Cloudflare Worker in `worker/` exposing GET `/quote?symbols=A,B,C`, forwarding each to Yahoo's v8 chart endpoint (`https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=1d`) with a browser User-Agent, returning normalised JSON `{symbol, price, currency, previousClose, marketState, asOf}` per symbol, with CORS headers and 5-minute edge caching. In the app, define `PriceProvider` in `src/data/priceProvider.ts`, implement `yahooProvider` against the Worker (URL from `VITE_WORKER_URL`) including the provider-neutral-id → Yahoo-symbol suffix map and GBp→GBP normalisation, validate responses with zod, and wire a `useQuotes(instrumentIds)` TanStack Query hook (staleTime 5 min). The hardcoded holdings table now shows live price, current value, and unrealised P/L per row with an 'as of' timestamp. Verify: with the worker running locally, the table shows a real, current BHP.AX price under the id `ASX:BHP`."

> **Prompt 3 — Real storage:**
> "Add Dexie with tables: portfolios, instruments, transactions, quotesCache, snapshots. Create repository modules in `src/data/repositories.ts` with zod-validated CRUD. Build the Transactions page: a form to add BUY/SELL/DIVIDEND transactions (instrument search, quantity, price, fees, currency, tradeDate) and a list with edit/delete. On save, capture `fxRateToBase` from the currently cached FX rate (fall back to 1 if unavailable and flag it for later correction). Replace the hardcoded array — Dashboard derives holdings from Dexie via `useLiveQuery`. Seed one default portfolio on first run. Validation: positive quantity/price, no future dates, SELL quantity cannot exceed currently held quantity as of that date. Verify: add a transaction, refresh the browser, it persists and the dashboard updates."

> **Prompt 4 — Symbol search:**
> "Add GET `/search?q=` to the Worker, proxying Yahoo's symbol search, returning `{id, name, exchange, currency}` (id already in provider-neutral form) filtered to ASX/NASDAQ/LSE/SGX equities and ETFs. Build a debounced (300ms), keyboard-navigable, ARIA-compliant SymbolSearch combobox used in the transaction form. Selecting a result upserts the Instrument into Dexie so name/exchange/currency are available offline. Verify: typing 'BHP' offers BHP labelled ASX/AUD; typing 'DBS' offers D05 labelled SGX/SGD."

> **Prompt 5 — Multi-currency rollup with FX fallback:**
> "Add `/fx?pairs=USDAUD,GBPAUD,SGDAUD` to the Worker via Yahoo's `=X` symbols. Implement `fxProvider.ts` with two backends behind the same `FxProvider` interface: Yahoo (primary, via the Worker) and Frankfurter.dev (`https://api.frankfurter.dev/v1/latest`, fallback, no key). A `useFxRates` hook tries Yahoo first and falls back to Frankfurter on failure, tagging each rate with its `source`. Implement `convert(amount, from, to, rates)` in `src/domain/money.ts`, pivoting through the base currency, with tests including round-trip and missing-rate cases (missing rate → affected values render as '—' with a warning icon, never 0). Add `summarise()` in `src/domain/portfolio.ts` producing total value, total cost, unrealised P/L, day change in base currency. Add a display-currency switcher (Zustand). Verify: kill the Worker's `/fx` route specifically and confirm the app falls back to Frankfurter without breaking; a portfolio holding BHP + AAPL + DBS shows one coherent AUD total."

> **Prompt 6 — Staleness & market hours:**
> "Add `isMarketOpen(exchange, date)` to domain (ASX 10:00–16:00 Sydney, NASDAQ 09:30–16:00 New York, LSE 08:00–16:30 London, SGX 09:00–17:00 Singapore; weekdays only; use Intl timezone APIs; ignore public holidays for now) with tests around session boundaries and DST. Gate `refetchInterval` so only symbols on open markets poll. Persist last-good quotes to quotesCache; on provider failure hydrate from cache and show an amber staleness badge with relative time. Add per-exchange OPEN/CLOSED badges to holdings rows. Verify: kill the worker, reload — the dashboard still renders full values from cached quotes, clearly badged stale."

> **Prompt 7 — Charts:**
> "Add GET `/history?symbol=&range=` to the Worker (same Yahoo chart endpoint, wider range param). Build a per-holding detail page with a Lightweight Charts price series (1M/6M/1Y/5Y toggle), cached in a Dexie `priceHistory` table with sensible TTLs. Add an AllocationDonut (Recharts) toggling by holding/exchange/currency. Implement daily snapshots: on app load, if no snapshot exists for today and quotes are fresh, write a DailySnapshot. Add a portfolio-value area chart over snapshots (1M/3M/1Y/All) with an empty state explaining history accumulates from first use. Verify: donut proportions match the table; a snapshot row appears after load; the BHP detail page shows a real 6-month chart."

> **Prompt 8 — CSV import/export:**
> "Add CSV export (all transactions, documented column format) and import with: header-mapping preview, per-row zod validation, a dry-run screen showing what will import plus per-row errors, duplicate detection (same instrument+date+type+quantity+price). Import is all-or-nothing per confirmed batch. Include a sample CSV and round-trip tests (export → import → identical holdings). Verify: export, wipe IndexedDB from devtools, re-import, dashboard identical."

> **Prompt 9 — Hardening pass:**
> "Add a React error boundary per page; toast-based error surface for mutations; loading skeletons for the table, header, and charts; number formatting via Intl.NumberFormat per currency; keyboard/a11y audit of forms and the search combobox (labels, focus management, `aria-live=\"polite\"` on the summary header); a Settings page (base currency, export, danger-zone wipe with confirmation). Add a 15-line GitHub Actions workflow: typecheck + lint + test on push. Run typecheck, lint, and full test suite; fix everything. Verify: `npm run build` is clean and Lighthouse accessibility ≥ 95."

> **Prompt 10 — Should-haves, one at a time:** realised-P/L column → multiple portfolios (switcher + per-portfolio summary) → dividends summary card. One prompt each, same pattern: domain function + tests first, then UI.

Two Claude Code habits that matter more than prompt wording: (1) after each prompt, ask *"review what you just wrote against CLAUDE.md's architecture rules and list any violations before we continue"* — it's good at catching its own layer leaks when asked; (2) never let it combine two prompts "for efficiency" — one-slice-one-commit is what keeps every step testable and revertable.

### 6. Best-practices checklist

**Correctness & safety**
- [ ] TypeScript `strict: true`; `any` banned via ESLint
- [ ] zod at every I/O boundary — API responses, form inputs, CSV rows, Dexie reads after migrations — domain only ever sees already-valid data
- [ ] All financial math in `domain/`, unit tested; target near-100% coverage there (cheap — pure functions), don't chase coverage in UI
- [ ] Golden test fixture: one realistic multi-currency, multi-exchange history with hand-calculated outputs, reused across holdings/summary/CSV tests
- [ ] Never mutate: derive. If you're writing a holding to the DB, stop.
- [ ] Money displayed via `Intl.NumberFormat`; document your float-precision decision once in CLAUDE.md rather than re-deciding per feature

**Errors & resilience**
- [ ] Every fetch has a defined failure state: stale badge, greyed row, or retry — never a blank screen, never a silent zero
- [ ] Error boundaries per page; provider failures degrade to cached data
- [ ] One symbol failing never fails the batch; Yahoo FX failing falls back to Frankfurter, not to silence

**Config & secrets**
- [ ] Only non-secret config in the frontend (`VITE_WORKER_URL`); any future API key lives in Worker secrets (`wrangler secret put`), never in client code
- [ ] `.env` gitignored; `.env.example` committed and current

**Git hygiene**
- [ ] One prompt = one vertical slice = one (or few) conventional commits; commit *before* each new prompt so any step is trivially revertable
- [ ] CI: typecheck + lint + test on push (15 lines, catches regressions from later prompts silently breaking earlier slices)

**Accessibility & UX basics**
- [ ] Semantic `<table>` with proper headers for holdings
- [ ] Full keyboard support for forms and combobox; visible focus rings; `aria-live="polite"` on live-updating totals
- [ ] Colour is never the only signal for gain/loss (always pair with +/− signs)
- [ ] `prefers-reduced-motion` respected on chart animations

---

## The honest assessment

**The hardest part of this build is the market-data layer — not the UI, not the math.** Portfolio arithmetic is textbook pure-function work Claude Code will produce, with tests, almost flawlessly. The genuinely hard engineering is everything around prices: CORS forcing a proxy into an otherwise-frontend project, four exchanges with four sessions and time zones, pence-vs-pounds normalisation, FX as a second (now doubly-sourced) live data stream, and keeping the app useful when any of it fails. Roughly half the prompt sequence exists to service this one concern — that ratio is correct, not accidental.

**The single most likely point of failure: the Yahoo Finance unofficial endpoints changing or blocking you.** It's unofficial; it has broken before and will again — possibly mid-build, more likely six months in once you've stopped thinking about it. You cannot prevent this, so the plan prices it in from the start: provider-neutral instrument IDs mean a provider swap never touches stored data; the `PriceProvider`/`FxProvider` interfaces confine Yahoo's entire blast radius to two adapter files and one Worker; the persisted quote cache means an outage degrades you to "yesterday's labelled prices," not a dead app; FX has an independent fallback already wired in; and the paid escape hatch (EODHD all-world or Twelve Data, ~US$20–30/month) is pre-chosen, not something you'll research in a panic. Budget one contingency evening for that swap and the failure mode becomes an inconvenience instead of a rewrite.

**Secondary risk worth naming: scope creep toward the history chart.** It's Delta's most seductive screen and the most expensive to do properly from scratch. The snapshot approach gets you 90% of the value for a fraction of the cost — resist reconstructing pre-app history until everything else is done and you actually miss it.
