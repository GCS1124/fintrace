# FINTRACE

**Follow the money. Explain the risk.**

FINTRACE is a local-first transaction investigation workspace for fraud analysts. It turns authorised transaction records into a time-bounded, explainable review: prioritised accounts, an observed relationship graph, deterministic signals, evidence rows, timeline replay, multi-hop flow paths, and a portable JSON case snapshot. The same graph engine runs in a stateless Vercel Function when available, with the local engine as a resilient fallback.

The project is intentionally an explainable investigation prototype. It is not a fraud verdict, a calibrated probability model, a bank integration, or an enforcement system. “Intelligent” means bounded, chronological graph reasoning with inspectable evidence—not an unlabelled model pretending to know ground truth.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, then choose **Load demo**. The default **Split and reconverge** scenario is the presentation path.

The local preview intentionally works without credentials: when Supabase is not configured, development shows a **Continue with local demo** path. For real signup, sign-in, and private case saves, copy `.env.example` to `.env.local`, add the Supabase project URL and publishable key, and run the SQL in [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL Editor.

Useful checks:

```bash
npm run typecheck  # TypeScript project references
npm run lint       # ESLint
npm test           # Vitest pure-engine suite
npm run build      # Production build in dist/
npm run preview    # Serve the production build locally
```

The focused backend accuracy suite is a 25-case synthetic matrix covering
threshold edges, replay cutoffs, future-record exclusion, reconvergence,
layering, fan-out, cycles, network velocity, over-attribution warnings, and
bounded deep tracing. Run it directly with:

```bash
npm test -- --run src/tests/accuracy.test.ts
```

The scenario data and expected outcomes live in
[`src/tests/accuracyScenarios.ts`](src/tests/accuracyScenarios.ts). The matrix
calls the same validating `POST /api/analyze` handler used by the local UI and
Vercel, so a passing run checks the endpoint contract as well as the detector.

## Recommended demonstration path

1. Load **Split and reconverge**. The queue should prioritise `A101` at `100/100 High priority`.
2. Expand **Evidence rows** and one or more signal rows. Show that every point has linked transaction IDs and readable evidence.
3. Press **Reset**, then advance with **Next**. At `10:04:00 IST` the case is `30/100`; at `10:04:30 IST` it is `70/100`; at `10:06:30 IST` it reaches `100/100`.
4. Point out that future transactions stay hidden during replay. The graph, queue, evidence, and export are all derived from the same cutoff.
5. Open **Ambiguous settlement** to demonstrate the responsible false-positive message: the same pattern can be legitimate, so the result supports human review rather than an accusation.
6. Optionally show invalid CSV rejection, the compatible template, and the JSON export.

## Detection contract

Every analysis is a snapshot at `asOfMs`; transactions after that cutoff are excluded before any rule runs.

- **Collection burst — 30 points:** at least 6 distinct senders pay the focal account inside the inclusive 10-minute window ending at an incoming transaction timestamp.
- **Rapid forwarding — 40 points:** after the collection anchor and within the next 5 minutes, outward volume reaches at least 80% of the observed collection volume. The interval is strict after the anchor and inclusive at the upper bound.
- **Split and reconverge — 30 points:** after forwarding is triggered, two distinct first-hop recipients each send onward to one common destination. Each onward transfer must be strictly after its first hop and within the conservative 10-minute hop window and current cutoff.

The server-side graph engine additionally traces chronological paths up to five hops and a 30-minute total trace window. It reports bottleneck amounts (the smallest observed edge on a path), direct counterparties, path depth, network velocity, multi-recipient fan-out, multi-hop layering, and circular re-entry. These are review signals with linked transaction IDs; they are not ownership or loss claims.

Scores are deliberately only `30`, `70`, or `100`. FINTRACE keeps one representative case per focal account, preferring the highest score, then the latest anchor, then the account ID for deterministic ordering. Evidence IDs are deduplicated and presented chronologically.

The canonical split fixture contains 12 rows and should produce these checkpoints for `A101`:

| Cutoff | Score | Interpretation |
| --- | ---: | --- |
| 10:02:00 IST | 30 | Collection observed |
| 10:04:00 IST | 30 | Forwarding window has just started |
| 10:04:30 IST | 70 | 95% outward volume observed |
| 10:06:00 IST | 70 | One reconvergence branch visible |
| 10:06:30 IST | 100 | Two-branch common recipient witnessed |

## CSV intake contract

The importer accepts exactly these six logical columns:

```text
transaction_id,timestamp,from_account,to_account,amount,currency
```

Validation is all-or-nothing: an invalid file cannot replace the active dataset.

- Maximum 2 MiB and 2,000 data rows.
- `currency` must be `INR`.
- Account IDs and transaction IDs remain strings.
- Amounts are parsed exactly into integer paise; negative, zero, malformed, and over-limit values are rejected.
- Timestamps must be explicit ISO-8601 values with a timezone offset.
- Duplicate transaction IDs, missing fields, self-transfers, and missing/extra headers are rejected.
- Unknown CSV columns are ignored only when they are extra fields after the six supported headers; a warning is surfaced.

## Architecture

The code follows three small layers so the UI cannot silently become the detector:

```text
src/
├── components/       React presentation and interaction components
├── auth/              Auth context, signup/sign-in screen, and session mapping
├── config/            Versioned detector configuration and limits
├── data/              Synthetic examples and CSV template
├── engine/            CSV validation, rules, and bounded graph intelligence
├── export/            Versioned JSON case snapshot builder
├── graph/             Cutoff-aware Cytoscape graph model builder
├── hooks/             Investigation state and replay orchestration
├── lib/               Browser-safe Supabase client configuration
├── services/          API and persistence adapters
├── styles/            Global tokens plus reset/base styles
├── tests/             Boundary and fixture tests for the pure engine
├── types.ts           Shared contracts
└── utils/             Display formatting helpers
api/
└── analyze.ts         Stateless Vercel Function with a re-validating API boundary
supabase/
└── schema.sql         Profiles, private investigations, triggers, grants, and RLS policies
```

React + Vite + TypeScript are the runtime foundation. Styling uses CSS Modules and shared CSS tokens, Cytoscape renders the relationship graph, Papa Parse handles CSV tokenisation, Lucide supplies interface icons, and Vitest covers the pure logic. The app keeps loaded records and notes in session memory; refresh intentionally clears the session. `npm run dev` mounts both analysis handlers (`/api/analyze` and `/api/ai-analyze`), so local UI work exercises the backend contracts.

## Authentication and private investigations

FINTRACE uses Supabase Auth for production account access and stores saved investigation snapshots in `public.investigations`. The browser client only reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; never expose a `service_role` key in Vite or Vercel client environment variables. The schema enables Row Level Security and scopes every profile and investigation read/write to the authenticated owner.

```bash
cp .env.example .env.local
```

After adding the two project values, restart Vite so the environment is reloaded. The SQL artifact is intentionally not executed by the repository build: it must be applied to the intended Supabase project by an authorised project owner. Until that happens, local demo sessions remain available in development, while the **Save case** action explains that demo sessions are local-only.

## Vercel hosting

This repository is configured for Vercel with a Vite frontend and stateless Node-compatible Functions at `/api/analyze` and `/api/ai-analyze`. The deterministic analysis route does not require a database. The Gemini copilot keeps the provider key server-only: add `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (`gemini-2.5-flash` is the default) to Vercel Preview/Production environment variables. Never prefix the Gemini key with `VITE_` or expose it to the browser. If production authentication and private saves are enabled, also add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; never add a service-role secret to client-visible variables.

For a Vercel dashboard deployment:

1. Import this repository and keep the project root at `fintrace`.
2. Select the Vite preset if Vercel does not detect it automatically.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Add the two `VITE_SUPABASE_*` variables for the environments that should support real account access.
5. Deploy. Vercel discovers `api/analyze.ts` and `api/ai-analyze.ts` as serverless endpoints; the checked-in `vercel.json` keeps the frontend build settings explicit.

Before a public demo, run `npm run build` and serve the result with `npm run preview`. Confirm the same demo path and the browser download flow against the preview URL; local dev-server verification is not a substitute for a deployed readback.

## Responsible-use boundary

FINTRACE only analyses the records supplied in the current session. When the same-origin API is available, the normalised records are sent to the stateless `/api/analyze` function for the richer graph pass; the app does not provide persistence or a database, and it falls back to local analysis if that function is unavailable. The system does not know account balances, beneficial ownership, off-platform activity, reversals, or whether a transaction is authorised. Rule points and graph context are heuristic review signals, not probabilities. Synthetic examples do not establish production accuracy, and the prototype never blocks, freezes, reports, or takes action on an account.

The optional Gemini copilot receives a compact, cutoff-scoped context containing the selected case, deterministic signals, graph summaries, relevant transaction rows, and the local session note. Its structured response is normalised on the server and transaction citations are restricted to IDs supplied in that context. Gemini suggestions are review aids only; they do not replace the deterministic engine, investigator judgment, or required verification.
