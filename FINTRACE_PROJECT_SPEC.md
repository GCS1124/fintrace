# FINTRACE - Shared Product, Design and Build Specification

Version: 1.0 | Prepared: 15 September 2026 | Team: exactly 2 members
Event: VENTURE 2026, 18 September 2026, as described in the supplied announcement.
Status: implementation specification, not an implemented or tested application.

**This is the source of truth for both teammates and Codex.** It replaces earlier Python/Streamlit variants and inconsistent project names. Product name: **FINTRACE**. Required interface: **React + Vite + TypeScript**. Do not change the stack, product name, scoring rules or scope without recording an explicit team decision.

## 1. Product decision

**Tagline:** Follow the money. Explain the risk.

Build a local-first investigation workspace that converts supplied transaction records into a prioritised, explainable account review. The analyst can load synthetic data or a compatible CSV, inspect a time-ordered transaction graph, move through the observed timeline, read the actual evidence, add a session note, and export the selected investigation snapshot.

The intended prototype user is a fraud analyst with authorised transaction records. The objective is to organise potentially suspicious activity for review, not to prove wrongdoing, identify criminals, recover money, or replace an institution's production detection system.

The demonstration focuses on one pattern family: **many incoming senders followed by rapid outward payments and two branches reaching a common recipient**. This is deliberately not a universal fraud detector.

**Successful demo:** load the split-and-reconverge example; see its collector's score change from 30 to 70 to 100 as evidence becomes available; inspect the supporting transfers; compare a merchant example; export the exact current snapshot.

All thresholds are prototype choices. All bundled examples are synthetic. Scores are review-priority points, not probabilities of fraud. All app UI copy is in English.

### Scope contract

| Required P0 | Optional P1, only after P0 passes | Explicitly excluded |
|---|---|---|
| Three synthetic examples; validated CSV import | Automatic playback of timeline steps | Backend, database, authentication |
| Three deterministic behavioural signals | Standalone printable HTML report | Bank/UPI integration, account blocking |
| One representative episode per focal account | Keyboard shortcuts beyond standard controls | Chatbot, LLM calls, trained ML model |
| Focused graph and transaction evidence | Additional independent synthetic scenarios | Next.js, Streamlit, mobile app |
| Manual timestamp slider + Previous/Next/Reset | Optional static hosting after the local demo works | Blockchain, payments, wallets, KYC |
| Session note and JSON snapshot export | Small observed benchmark table in README | Cloud uploads, analytics, large charts |
| Automated engine tests and manual UI checks | Dark mode only after every core task is finished | Landing page, separate admin/settings pages |

Do not build a second product inside this one. A complete investigation flow is the deliverable.

## 2. Technical architecture and dependencies

Use React + Vite's `react-ts` template, TypeScript strict mode, CSS Modules, and one global CSS token file. The official Vite guide supports this template and lists its current Node requirements [S1]. Use a compatible installed Node version; check the actual package engine requirements rather than ignoring warnings. Do not upgrade dependencies during the final demo-preparation period.

Runtime additions: `cytoscape`, `papaparse`, `lucide-react`. Development additions: `@types/cytoscape`, `@types/papaparse`, `vitest`. Use the ordinary React state hooks; use a reducer if shared state becomes cumbersome. React documents reducers as a way to centralise state transitions [S2]. Do not add Redux, a router, a query library, Tailwind, a component framework or a layout plugin for this MVP.

Cytoscape provides graph interaction and a preset layout that accepts supplied positions [S3]. Papa Parse handles local CSV parsing [S4]. Vitest is the engine-test runner [S5]. These are supporting tools, not substitutes for application validation and detection logic.

```text
Local demo CSV / user-selected CSV
                |
         parse + validate
                |
       normalised transactions
                |
       filter to replay cutoff
                |
      deterministic pure detector
                |
          analysis snapshot
           /           \
 account queue     selected investigation
                    /       |       \
                  graph   evidence   export
```

**No app API key, external inference call, telemetry or backend is required.** Import examples into the bundle. Bundle icons and use system fonts. Keep uploaded data and notes in memory only. Refreshing clears the working session. Warn about this honestly in the notes section.

The offline requirement applies to the finished local demo, not to package installation or the team's access to a coding assistant. Dependencies must already be installed. A local server must still be running; do not promise that double-clicking `dist/index.html` works.

### Initial commands

Run scaffolding only in a new/empty intended project directory. In an existing repository, inspect and preserve its contents first.

```bash
npm create vite@latest fintrace -- --template react-ts
cd fintrace
npm install
npm install cytoscape papaparse lucide-react
npm install -D @types/cytoscape @types/papaparse vitest
```

Commit the dependency lockfile. Add these scripts alongside the template scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc -b --pretty false"
}
```

The final checks are `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Vite's static deployment documentation distinguishes building the app from using its local preview server [S6]. Preview is for checking the local build, not a production banking server.

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

## 3. Visual design: quiet, precise, uncluttered

Use a **light, blue-accented analyst workspace**, not a neon finance dashboard. No decorative gradients, glass panels, animated backgrounds, oversized KPI cards, donut charts, permanent navigation rail, or marketing hero section.

### Tokens

```css
:root {
  --canvas: #F6F8FC;
  --surface: #FFFFFF;
  --surface-subtle: #F0F4FA;
  --text: #172033;
  --text-muted: #5F6B7A;
  --border: #DCE3EE;
  --accent: #2563EB;
  --accent-soft: #EFF6FF;
  --monitor: #526174;
  --review: #8A5700;
  --review-soft: #FFF7E6;
  --high: #B42318;
  --high-soft: #FEF3F2;
  --radius: 12px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
}
```

Use `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Base body text: 14px with comfortable line height. Main title: 22px/600. Panel headings: 14-16px/600. Metadata: 12px minimum. Use tabular numerals for amounts and scores. Account/transaction IDs may use a system monospace font.

Keep borders subtle and spacing consistent. Use icons only where they clarify an action; icon-only buttons need accessible names. Keep visible focus indicators. Convey priority with text as well as colour. Test the finished contrasts rather than assuming tokens alone guarantee accessibility.

### Primary desktop layout

Target 1440x900 and 1366x768 first. Outer padding: 20-24px; panel gaps: 16px. Header: approximately 64px. Compact dataset context strip below it. Three columns at widths of 1280px or greater:

```text
260px queue | minmax(420px, 1fr) graph | 320px evidence
```

Use `min-width: 0` on grid children. At 1024-1279px, show queue + graph with evidence below the graph. Below 1024px, stack queue, graph and evidence; provide a minimum useful graph height. Do not develop a separate mobile application.

```text
+-----------------------------------------------------------------------+
| FINTRACE     Investigation workspace     [Load example v] [Import CSV] |
| Synthetic data | 412 loaded | 28 visible at 10:04:30 IST | 3 reviews    |
+----------------+----------------------------------+-------------------+
| Accounts       | Account A101         [Fit view]  | Evidence          |
| [Search ID]    | Observed transaction trail       | Review: 70 / 100  |
| [All priorities|                                  |                   |
|            v]  | incoming -> collector -> branches| Collection   +30  |
|                |                                  | Forwarding   +40  |
| A101  Review 70|                                  | Common target ... |
| 8 senders      |                                  |                   |
| INR 40,000 in  |                                  | [Evidence rows v] |
|                |                                  | [Session note v]  |
| A501 Monitor30|                                  | [Export JSON]     |
+----------------+----------------------------------+-------------------+
| [Reset] [Previous] [Next] ------- timeline ------ 10:04:30 IST           |
+-----------------------------------------------------------------------+
```

The numbers above illustrate layout only. All displayed counts, scores, amounts and timestamps in the actual application must come from the current snapshot. Do not copy decorative placeholder metrics into production components.

## 4. Screens and interactions

### Empty state

Start with no dataset loaded. Show the product title, one sentence describing the tool, primary action **Load demo**, secondary action **Import CSV**, and a small **Download template** link. Do not fill the empty state with fake charts.

Use copy: `Trace connected payments and review the evidence behind suspicious patterns.` A compact note states: `Demonstration tool. Use synthetic or appropriately authorised data.`

### Example picker

Offer exactly three clearly labelled synthetic examples: `Split and reconverge`, `Merchant collection`, and `Ambiguous settlement`. Selection replaces, never merges, the current dataset. Clearing/replacing a loaded dataset with a nonempty note requires a small confirmation because notes are session-only.

The example name is presentation metadata. It must never enter the detection function. The ambiguous example's benign ground truth is for documented evaluation, not an input the detector can inspect.

### CSV import dialog

Use one accessible modal with a file input/drop zone, required-column description, template download and concise limits. After selecting a file, show validation results and five preview rows. Import only after validation succeeds. An invalid upload does not replace the current working dataset.

Show at most five detailed errors with row numbers and the total error count. Close on Escape, manage focus correctly, return focus to the opener. Keep the dialog content scrollable. Do not use blocking browser alert boxes for routine validation.

### Account queue

Display **one current representative episode per focal account**, not all overlapping windows. Default sort: score descending, then latest anchor time, then account ID. Rows show account ID, priority label/score, distinct incoming senders, and observed incoming value. One search field filters account IDs; one select filters priority.

Search/filter only changes the queue, not the underlying analysis. Keep the selected account visible in the investigation panel even if a filter hides its row; show a small `Selected account is outside the current filter` notice. Provide a route to clear filters.

Default selection after loading is the highest-ranked account. Clicking a row updates graph and evidence together. Do not automatically jump selection when replay reorders the queue. At a cutoff before the selected account has any observed activity, show `No activity for this account at the selected time`, not future nodes.

An empty queue says: `No collection-led episodes meet the configured threshold in the observed data.` It must not say `All accounts are safe`.

### Graph interaction

Nodes represent account IDs; arrows represent observed transfers. The focal account has a strong blue border. Other nodes are neutral by default. Being connected to a review case must not automatically colour someone red or call them fraudulent.

Click a node to highlight its currently visible related transfers inside the selected investigation. This does not silently switch the focal case. Click an edge to expose its transfer details in the evidence section. Keep the queue and explicit focal-account selector as the accessible route for changing cases. The same information is available in a normal table; the graph is not the only interface.

Use one edge per transaction ID. Repeated transfers are preserved; parallel edges must not overwrite one another. Labels show account IDs. Edge amounts/time appear on selection rather than covering every edge with text.

Use a deterministic preset column layout for incoming sources, collector, first-hop recipients and shared recipient. Cache positions when a node first becomes visible. On replay, update data without rerunning a force layout or fitting on every step. Never pre-render nodes or positions from transactions later than the cutoff. `Fit view` is explicit; initial fitting happens once per selected case.

Limit the displayed subgraph to 24 nodes and 60 edges. These are display limits, not detection limits. Prefer the focal account and rule-supporting paths. Disclose truncation: `Showing a subset; all evidence remains in the table and export.` Do not hide a missing witness while visually claiming the entire path is displayed.

Dispose of the Cytoscape instance/listeners when appropriate; prevent duplicate graph instances during React development re-mounts. Restrict scrolling/zoom so accidental wheel movements do not make the graph unusable.

### Evidence panel

Show the selected score as `Review priority: 70/100`, with `Not a fraud probability` nearby. Show only three compact rule rows. A row opens to reveal observed values, configured threshold, applicable time window and linked transactions.

Below the rules, use collapsed sections for the detailed transaction table and analyst note. No permanently expanded second dashboard. Table columns: time (IST), transaction ID, sender, receiver, INR amount. Keep full IDs available with wrapping or copy action; do not truncate away the only identifying information.

Session note: plain text, maximum 1,000 characters. State `Not saved after refresh`. Notes belong to the selected account within the current loaded dataset; they are contextual notes, not historical audit records. Changing the representative episode does not silently pretend the note was written for a different immutable case. Exports clearly identify the current episode/cutoff and the note's account scope.

### Replay

Required controls: Previous, Next, Reset and a labelled range slider. One step means one **unique transaction timestamp**; all transfers sharing a timestamp appear together. Use an initial position before the first transfer, then the unique timestamp positions. Load examples at the last timestamp for an immediate overview; Reset moves before the first timestamp.

At cutoff T, detection, counts, graph, evidence and export use only transfers with `timestampMs <= T`. A readout explicitly distinguishes total loaded rows from visible rows. The file's total size is metadata, not future analysis.

Rewind recomputes the snapshot. Do not cache earlier scores computed from the complete dataset. Scores can decrease or the representative episode can change as the visible evidence changes; do not force artificial monotonicity. Optional autoplay uses the same steps, cleans up its timer, and stops at the end or dataset replacement.

## 5. Transaction input contract

CSV header:

```csv
transaction_id,timestamp,from_account,to_account,amount,currency
T001,2026-09-18T10:00:00+05:30,A001,A101,5000.00,INR
```

The amount column is a decimal **rupee string**, not paise. Internally convert exactly to integer paise by splitting the validated decimal string. Do not use `parseFloat(value) * 100` as the normalisation contract.

Proposed hard limits: 2 MiB input, 2,000 nonblank rows, and at most 10,000,000,000 paise per transaction. The latter is INR 100,000,000.00 per row. Check safe-integer arithmetic for values and totals. These limits keep the first version bounded; they are not measured performance promises.

Validation rules:

- Require the six named columns; accept any column order. Strip a UTF-8 BOM and trim header whitespace. Reject duplicated normalised headers. Extra columns may be ignored with an explicit warning; they never enter the engine, graph or evidence.
- Use Papa Parse with headers, no automatic numeric typing, and blank-line handling [S4]. Preserve leading zeros in IDs. Do not split CSV with `string.split(',')`.
- Trim IDs, then require 1-40 characters from letters, digits, `_` and `-`. Treat IDs as case-sensitive opaque strings. Never infer risk from an ID's spelling.
- Require a valid ISO 8601 timestamp with an explicit `Z` or numeric offset. Reject ambiguous local dates and impossible calendar dates. Normalise to epoch milliseconds; display with the explicit `Asia/Kolkata` time zone.
- Amount accepts digits with zero, one or two decimal places, strictly greater than zero, within the stated limit. Reject signs, scientific notation, thousands separators, currency symbols, NaN and Infinity. Reject excess fractional digits; do not silently round them.
- Require currency `INR` after trimming and uppercasing. Reject other currencies rather than mixing them.
- Reject duplicate transaction IDs and self-transfers in this scoped prototype, with an explanatory row error. Do not drop different transaction IDs just because their amounts/times match.
- Any row-level error rejects the entire attempted import. Do not analyse a silently incomplete subset. Header-only/empty files are invalid. Sorting unsorted valid input is allowed and disclosed as normalisation.

Store only whitelisted, normalised fields. Test labels are never uploaded as application state. Render IDs and notes as text, not HTML. Prefer JSON export in P0 to avoid extra HTML/CSV handling. Optional HTML must escape user strings; optional CSV export must use formula-injection protection such as Papa Parse's documented `escapeFormulae` [S4].

## 6. Detector: exact, bounded semantics

Put the settings in one immutable configuration module:

```text
COLLECTION_WINDOW_MS = 10 * 60 * 1000
MIN_DISTINCT_SENDERS = 6
FORWARD_WINDOW_MS = 5 * 60 * 1000
MIN_OUTFLOW_PERCENT = 80
RECONVERGE_HOP_WINDOW_MS = 10 * 60 * 1000
POINTS = { collection: 30, forwarding: 40, reconvergence: 30 }
DETECTOR_VERSION = "fintrace-rules-v1"
```

Settings are visible read-only in an evidence disclosure and export. Do not build a threshold-settings screen.

### 6.1 Visible snapshot

Given normalised transactions and cutoff T, first derive `visible = transactions.filter(tx => tx.timestampMs <= T)`. Sort deterministically by timestamp and transaction ID. Build incoming/outgoing indexes from **visible only**. Detector functions must not receive example names, account role labels or ground truth.

### 6.2 Candidate collection episodes

For each account A, consider each unique visible incoming timestamp `tau` as a possible anchor. Define B as incoming transfers to A in the inclusive interval `[tau - 10 minutes, tau]`.

A candidate exists only when B contains at least six distinct senders. Its collection signal is triggered and contributes 30 points. Its incoming total I is the sum of all B amounts, not one transfer per sender. All B transaction IDs support the collection evidence.

**Scope consequence:** activity without a qualifying collection burst will not create a case, even if some other fraud pattern exists. State this limitation. This is how the two-person build avoids becoming a general-purpose detection engine.

### 6.3 Rapid outward-payment signal

For a candidate at tau, O is the set of outgoing transfers from A with:

```text
tau < outgoing.timestampMs <= min(tau + 5 minutes, T)
```

Let V be the sum of O. Trigger the signal if `V * 100 >= I * 80`. Use safe integer arithmetic; I is positive by validation. Contribute 40 points when triggered. Evidence includes the relevant incoming/outgoing transaction IDs and both totals. If the threshold has not been reached and the observation window is still open, mark the signal `pending`; otherwise use `not_observed`.

Call the value **observed outward/inward volume ratio**. Values above 100% are allowed and must not be clamped or described as a fraction of the same funds. Existing balances and other money sources are unknown. **V1 does not implement FIFO or exact fund attribution.** This is an intentional simplification from earlier brainstorming, not a missing hidden feature.

### 6.4 Split-and-reconverge signal

Evaluate this only after the forwarding signal has triggered. Find two distinct immediate beneficiaries B and C among O. Find an observed common recipient D through transfers B->D and C->D, with these requirements for each branch:

```text
A->B occurs in O
A->B.time < B->D.time <= min(A->B.time + 10 minutes, T)
A->C occurs in O
A->C.time < C->D.time <= min(A->C.time + 10 minutes, T)
```

A, B, C and D must be distinct. Equal-time onward transfers do not prove temporal ordering and do not qualify. Search only these two-hop paths, not arbitrary-depth traversal. Amounts are displayed but not assumed to be conserved along the path. There is no validated downstream-value threshold in V1; acknowledge the possibility of small, unrelated onward transfers producing an alert.

When two qualifying branches reach the same D, contribute 30 points and record a deterministic witness: destination ID, both upstream transaction IDs and both onward IDs. When alternatives exist, sort destinations by ID, then prefer earliest onward time and transaction ID for each branch. Do not use labels to choose the example's expected answer.

Use an explicit conservative pending deadline: when no witness exists, the signal is `pending` while T is earlier than `tau + 15 minutes`, unless the forwarding window has already closed without meeting its prerequisite. It becomes `not_observed` at or after that deadline if no witness exists. A detected witness remains `triggered`. This display convention does not relax any strict branch-time test above. Pending contributes zero points and never means safe.

### 6.5 Score, priority and deduplication

Only these scores are possible for a candidate in V1:

| Signals | Score | Label |
|---|---:|---|
| Collection only | 30 | Monitor |
| Collection + forwarding | 70 | Review |
| Collection + forwarding + reconvergence | 100 | High priority |

No score exists for an account with no candidate; do not invent a zero-risk certificate.

Evaluate candidate anchors, then keep one representative per focal account: highest score, then latest anchor, then anchor ID for deterministic ties. Store the representative's actual anchor and evidence. This is a deduplicated current account queue, **not a complete historical case-management system**. Do not add up overlapping episodes to report a total loss or prevented fraud.

Queue ordering is score descending, latest representative anchor descending, account ID ascending. Case evidence is the union of relevant transaction IDs, deduplicated by transaction ID, sorted chronologically. Root incoming amount, root outgoing amount and downstream observed transfers are separate measures.

### 6.6 Algorithm implementation guidance

Index by sender and receiver once per visible snapshot. Use time-sorted arrays and bounded time filtering. Only run the branch/common-recipient check for collection candidates that meet the forwarding threshold. Avoid all-account all-path traversal. For the supported 2,000 rows, begin with clear synchronous pure functions; measure before adding Web Workers.

Do not silently truncate data or candidate search to hit a performance target. If a supported input proves too slow, optimise or explicitly reduce/document the supported input cap. Graph rendering limits must never change the detector's answer.

## 7. Shared TypeScript contract

Agree on `src/types.ts` first. The following is the intended shape, not a complete implementation. Member B owns changes to the analysis types; Member A reviews any changes consumed by the UI.

```ts
export interface Transaction {
  readonly id: string;
  readonly timestampMs: number;
  readonly fromAccount: string;
  readonly toAccount: string;
  readonly amountPaise: number;
  readonly currency: "INR";
}

export type SignalId = "collection" | "forwarding" | "reconvergence";
export type SignalStatus = "triggered" | "pending" | "not_observed";
export type Priority = "monitor" | "review" | "high";

export interface SignalResult {
  readonly id: SignalId;
  readonly status: SignalStatus;
  readonly points: number;
  readonly title: string;
  readonly explanation: string;
  readonly observed: Readonly<Record<string, number | string>>;
  readonly evidenceTransactionIds: readonly string[];
}

export interface AccountCase {
  readonly caseId: string; // focal account + representative anchor
  readonly focalAccountId: string;
  readonly anchorMs: number;
  readonly score: 30 | 70 | 100;
  readonly priority: Priority;
  readonly distinctSenders: number;
  readonly incomingPaise: number;
  readonly outgoingPaise: number;
  readonly signals: readonly SignalResult[];
  readonly evidenceTransactionIds: readonly string[];
  readonly warnings: readonly string[];
}

export interface AnalysisSnapshot {
  readonly asOfMs: number;
  readonly visibleTransactions: readonly Transaction[];
  readonly visibleAccountIds: readonly string[];
  readonly cases: readonly AccountCase[];
}
```

Public functions to agree on:

```ts
validateRows(rows: readonly Record<string, string>[]): ValidationResult;
analyzeSnapshot(
  transactions: readonly Transaction[],
  asOfMs: number,
  config: DetectorConfig
): AnalysisSnapshot;
buildGraphModel(
  snapshot: AnalysisSnapshot,
  focalAccountId: string
): GraphModel;
buildCaseExport(
  snapshot: AnalysisSnapshot,
  focalAccountId: string,
  metadata: ExportMetadata,
  note: string
): CaseExport;
```

Define the referenced additional types explicitly. No `any`-based substitute contracts. `analyzeSnapshot` is pure and does not mutate input, call `Date.now`, generate random numbers, write storage, or read browser APIs. Measure runtime outside it. Return warnings rather than silently inventing missing context.

Application state holds dataset metadata, normalised transactions, replay index, selected focal account, selected transaction/node, filters, per-account notes and import-dialog state. Analysis, filtered queue and displayed evidence are derived from the current dataset/cutoff; do not store independently editable copies of scores and graph evidence.

Changing dataset resets replay, filters, selections and notes after any required discard confirmation. A stale asynchronous file parse must not overwrite a subsequently selected example; use a load token or equivalent cancellation guard.

## 8. Canonical synthetic fixtures and expected behaviour

Expected values here are **acceptance criteria, not results already observed from software**.

### Fixture A: split and reconverge

Eight source accounts A001-A008 each send INR 5,000.00 to A101. Their timestamps are 10:00:00, 10:00:20, 10:00:40, 10:01:00, 10:01:20, 10:01:40, 10:01:50 and 10:02:00 IST on 18 September 2026.

A101 sends INR 19,000.00 to A201 at 10:04:00 and INR 19,000.00 to A202 at 10:04:30. A201 sends INR 18,500.00 to A301 at 10:06:00. A202 sends INR 18,500.00 to A301 at 10:06:30.

Use separate transaction IDs for all 12 transfers. No ground-truth labels appear in the CSV or normalised transactions.

| Cutoff | Expected A101 score | What must be visible |
|---|---:|---|
| Before 10:01:40 | No candidate | Fewer than six senders observed |
| 10:02:00 | 30 | Eight senders; INR 40,000 incoming |
| 10:04:00 | 30 | One INR 19,000 outward transfer; ratio 47.5% |
| 10:04:30 | 70 | INR 38,000 outward; ratio 95%; no common-recipient witness yet |
| 10:06:00 | 70 | Only one observed onward branch |
| 10:06:30 | 100 | Both branches reach A301; full witness available |

At final cutoff, the representative anchor must be 10:02:00 because equal-scored candidates prefer the latest anchor. Report INR 40,000 root incoming and INR 38,000 root outgoing separately. INR 37,000 is the two observed onward payments, not additional unique fraud loss. Renaming accounts or changing the example's display name must not change the mapped calculation.

### Fixture B: merchant collection

Eight distinct sources send INR 2,000.00 each to A501 between 12:00:00 and 12:02:00. A501 pays a supplier at 12:30:00. It has a collection-led episode and should remain **Monitor 30**, because the outward payment is outside the defined five-minute windows. The explanation says other signals were not observed; it does not certify the merchant as safe.

### Fixture C: ambiguous settlement

Create a distinct-ID, distinct-time version of Fixture A whose evaluation label describes a legitimate pooled settlement. The engine must still produce **100** when the observed pattern is equivalent. This is an intentional documented false positive and demonstrates the need for additional context/human review. Never whitelist this fixture because of its name.

### Additional test fixture

Create a normal dataset with no qualifying six-sender burst. Expect an empty queue and a valid empty state. Create further scenario variations independently of the exact demo, with different IDs, timing and values. Keep evaluation labels under tests, not in production detector inputs. Optional background data must not accidentally alter the acceptance fixtures' focal accounts; test the final combined example again.

Begin with the 12-transfer canonical fixture. A larger 300-500 transfer visual demo is optional after the core works; do not let synthetic-data generation consume the first build hour.

## 9. Export contract and session integrity

P0 export is a real downloadable `.json` file using a Blob and a sanitised filename. Revoke the object URL after use. Export only on a user's explicit click.

Include: schema version, detector version, generation timestamp, source label and synthetic/uploaded designation, selected cutoff in ISO format, display timezone, rule configuration, focal account and representative anchor, score/priority, signals and observations, de-duplicated evidence records, warnings, and the account-scoped session note.

Export the **current cutoff**, never quietly the final dataset result. Disable export when no candidate is available at the current cutoff. Do not include unseen future transactions. Add these limitations in the export: pattern evidence is not guilt; heuristic points are not calibrated probability; unknown balances prevent exact fund attribution; only supplied records are visible; no bank integration/enforcement is performed; synthetic tests do not establish production accuracy.

The JSON is an evidence snapshot, not a cryptographically certified or tamper-proof audit record. Do not add fake seals, bank logos, compliance certifications, signatures or timestamps claiming an official authority.

P1 printable HTML must remain readable without remote fonts/scripts. Escape every user-supplied string. Skip this feature before compromising a correct JSON export.

## 10. Repository structure and ownership

```text
fintrace/
  FINTRACE_PROJECT_SPEC.md
  AGENTS.md
  README.md
  package.json
  package-lock.json
  src/
    App.tsx
    main.tsx
    types.ts
    config/detector.ts
    styles/tokens.css
    styles/global.css
    components/
      AppHeader.tsx
      EmptyState.tsx
      ImportDialog.tsx
      AccountQueue.tsx
      InvestigationGraph.tsx
      EvidencePanel.tsx
      ReplayControls.tsx
    engine/
      validate.ts
      money.ts
      analyze.ts
      signals.ts
    graph/buildGraphModel.ts
    export/buildCaseExport.ts
    data/examples.ts
    hooks/useInvestigation.ts
    utils/format.ts
    tests/
      validation.test.ts
      detection.test.ts
      replay.test.ts
      export.test.ts
      fixtures.ts
```

CSS Modules sit beside their components. Use this structure as a guide, not an excuse to create empty abstraction layers.

**Member A - UI, graph and integration:** owns App, components, styles, hooks, graph rendering/model presentation, keyboard behaviour and final demo operation. Member A is the sole owner of package/config changes after initial scaffolding to avoid competing lockfile edits.

**Member B - engine, data and evidence:** owns validation, money parsing, rule configuration, analysis functions, synthetic fixtures, tests, export and technical explanation. Owns shared analysis type changes after agreement with A.

Both understand the whole investigation. A can explain the score. B can operate the demo. Neither person spends the entire day only making slides.

Use separate branches/working directories for simultaneous coding. Do not let two coding sessions edit the same files at once. Shared types are agreed first. Integrate small changes frequently; avoid a final-hour merge. Preserve the teammate's work; no destructive resets or unrequested pushes/deployments. A tiny temporary mocked `AnalysisSnapshot` is allowed during UI construction only; remove it from the production path at the first integration gate.

## 11. Build milestones and handoff gates

These are proposed team timeboxes, not a promise or the organiser's confirmed agenda. The supplied 9:30-15:50 event window includes unknown briefing/judging time. Shift earlier if the actual submission deadline requires it. Confirm advance-code, dataset and AI-tool permissions; this brief is not permission to violate them.

| Phase / tentative time | Member A | Member B | Exit gate |
|---|---|---|---|
| M0, 09:30-09:50 | Scaffold + base tokens | Types + canonical fixture | Schema/types agreed; app starts |
| M1, 09:50-10:35 | Queue + evidence shell | Collection check + normalisation | One real end-to-end score, no hardcoded UI number |
| M2, 10:35-11:35 | Graph + account selection | Forwarding + reconvergence + tests | Canonical final fixture shows 100 with actual witness |
| M3, 11:35-12:20 | Import dialog + manual replay | Validation edge cases + snapshot tests | Rewind shows 30/70/100 correctly; invalid import safe |
| M4, 12:20-13:00 | Session note + responsive cleanup | JSON export + merchant/ambiguous tests | Full load-to-export workflow |
| M5, 13:00-13:45 | Integration and offline checks | Remaining regressions + README | P0 feature freeze; actual checks pass |
| M6, 13:45-14:15 | Demo rehearsal + minimal polish | Explain metrics/limits + backup evidence | Repeatable demo and honest status |
| Remaining window | Submission/judging buffer | Submission/judging buffer | Follow real organiser deadline |

Each merge needs the relevant tests and a usable app. Do not make the workflow wait for all components to be individually 'perfect'.

### Cut order under pressure

First remove autoplay, printable HTML, extra background data, elaborate tooltips, decorative motion and optional charts. Keep manual Next/Previous. Keep JSON export instead of fancy reports.

If graph interaction is unstable, preserve a simpler fixed graph plus the evidence table. If the graph fails entirely, show an explicit graph-unavailable message and a chronological trail/table; do not fake the graph or detection. If a core rule is incomplete, disclose it and score only implemented checks. Never display a reconvergence contribution backed by a TODO.

If the complete core is not integrated by approximately 12:20, stop all P1 work. After feature freeze, changes must fix a bug, remove risk or improve immediate readability.

## 12. Codex work instructions

Read this file and `AGENTS.md` before implementing. The team should first ask for a plan mapped to these milestones, then approve scoped implementation. Do not silently scaffold a second app, switch to Next.js, add a backend or replace the graph with a decorative image.

At every milestone, state files changed, behaviours completed, commands actually run, results actually observed and remaining limitations. Do not claim tests passed without running them. If browser verification is unavailable, explicitly state which flows remain unverified; do not invent screenshots or click results.

Use `AGENTS.md` for durable repository instructions; current OpenAI documentation describes this convention [S7]. Follow the existing repository's higher-level instructions too. Never place credentials, bank data or secrets in the prompts, source or demo fixtures.

### Kickoff prompt: planning only

```text
Read FINTRACE_PROJECT_SPEC.md and AGENTS.md completely. Treat the specification
as the source of truth. We are exactly two developers. The required stack is
React + Vite + TypeScript, browser-only, with a minimal-clutter light UI.

First inspect the current repository without deleting or overwriting existing
work. Return an implementation plan mapped to M0-M6, file ownership for Member A
and Member B, the shared type/function contracts, dependency commands, acceptance
tests, and the earliest end-to-end integration gate. Identify contradictions or
missing semantics explicitly; do not silently choose different scoring rules.

Do not implement the full application in this planning step. Do not add Next.js,
a server, authentication, cloud uploads, LLM calls, payments or real banking
integrations. Keep the canonical 30 -> 70 -> 100 replay test exact. Explain how
future-data leakage and duplicate transaction counting will be prevented.
```

### Member A implementation prompt

```text
Implement the approved Member A tasks from FINTRACE_PROJECT_SPEC.md in the
current assigned milestone only. Own the React interface, CSS tokens/modules,
graph presentation, selection, replay controls and integration. Consume the
shared analysis contracts; do not independently calculate or hardcode risk
scores. Preserve Member B's engine/types unless an agreed contract change is
recorded. Use the specified light, three-panel, minimal-clutter layout. Keep
all controls functional. Run relevant checks and report actual results.
```

### Member B implementation prompt

```text
Implement the approved Member B tasks from FINTRACE_PROJECT_SPEC.md in the
current assigned milestone only. Own validation, exact paise parsing, pure
snapshot detection, config, canonical fixtures, tests and JSON export. Follow
Sections 5-9 exactly; no FIFO attribution, ML, label leakage, extra risk rules
or new backend. Test the 30 -> 70 -> 100 fixture at the specified cutoffs,
merchant Monitor 30, the intentionally ambiguous High 100 case, temporal
boundaries and future-data exclusion. Preserve Member A's UI work. Report
actual test commands, results and any unresolved limitations.
```

### Final audit prompt

```text
Audit the implemented FINTRACE against the specification. Do not add features.
Run typecheck, lint, unit tests and a production build. Inspect the app at
1440x900 and 1366x768 when browser tools are available. Verify CSV errors do not
replace the active dataset, repeat loads do not duplicate data, manual replay
changes all evidence consistently, future transfers are absent after rewind,
notes do not cross datasets, graph witnesses match rule evidence, and JSON
exports only the selected cutoff. Check that external networking is unnecessary
for the local built app. Fix demonstrated defects, rerun relevant checks, and
report any tests or browser flows you could not run. Never report an untested
feature as complete.
```

## 13. Acceptance tests

Implement automated tests for the pure core. Use manual or available browser testing for the UI; do not pull in a second test framework just to claim coverage.

| ID | Test | Expected result |
|---|---|---|
| T01 | Canonical cutoff 10:02:00 | A101 score 30; 8 senders; INR 40,000 incoming |
| T02 | Canonical cutoff 10:04:00 | Score 30; INR 19,000 outward; 47.5% |
| T03 | Canonical cutoff 10:04:30 | Score 70; 95%; no common-recipient witness |
| T04 | Canonical cutoff 10:06:30 | Score 100; correct four-edge witness |
| T05 | Rewind final fixture to 10:04:00 | Later branch/recipient/amounts absent from evidence and export |
| T06 | Merchant fixture | Monitor 30, no fabricated safe verdict |
| T07 | Ambiguous legitimate equivalent pattern | High 100, documented false positive, no whitelist |
| T08 | Normal dataset without 6-sender burst | Empty queue, no crash or fabricated score |
| T09 | 5 senders / 6 senders | Collection boundary respected |
| T10 | 79.99% / 80% outward volume | Forwarding boundary respected using integer values |
| T11 | Outgoing exactly +5 minutes / +5 minutes +1ms | First included, second excluded for that anchor |
| T12 | Onward exactly +10 minutes / +10 minutes +1ms | First included, second excluded for that upstream edge |
| T13 | Outward before or equal to incoming anchor | Not counted as subsequent outward movement |
| T14 | Onward before/equal to upstream transfer | No chronological reconvergence witness |
| T15 | Two onward transfers from the same intermediary | Not two distinct branches |
| T16 | Outward volume > incoming volume | Ratio >100 is shown honestly; no fund-ownership claim |
| T17 | Reordered rows / renamed accounts | Corresponding scores unchanged; deterministic results |
| T18 | Same ID duplicated / distinct IDs with equal amounts | Duplicate import rejected; legitimate repeated transfers preserved |
| T19 | Invalid amount, date, currency, columns or oversize file | Whole import rejected with meaningful error |
| T20 | Notes containing HTML-like text | Rendered as inert text; JSON contains string, no execution |
| T21 | Export at mid-replay | Current config, cutoff, exact evidence and limitations included |
| T22 | Different final future transaction appended | Earlier snapshot unchanged |
| T23 | Case with >24 nodes or >60 display edges | Graph discloses truncation; analysis/export retain all evidence |
| T24 | Multiple events sharing one timestamp | Replay includes/excludes the complete timestamp group |

For boundary tests, isolate a single relevant anchor or assert its candidate result; do not let a different overlapping anchor mask the intended boundary. Test immutability of detector input and sums as well.

Manual flows: load each example twice; import a valid file; reject an invalid file without losing the active case; filter/search; select cases; select graph/table evidence; scrub forward and backward; enter a note; replace dataset with discard confirmation; export and inspect JSON; use keyboard focus/Escape; refresh and verify the documented session reset; resize to both desktop targets; disable internet and cold-start the locally served production build.

A graph-canvas feature must be tested in a real browser, not marked verified solely by a unit-test environment. Engine-test counts are engineering evidence, not real-world fraud-detection accuracy.

## 14. Performance, limitations and honest evaluation

Performance goal, not a measured claim: load and analyse the 500-row example in under one second on the demo laptop; aim for interactive manual replay within roughly 200ms for the small canonical example. Record actual dataset size, hardware/browser and observed timings. Do not show invented counters or performance numbers in the UI.

This synthetic prototype does not establish real banking accuracy. The ambiguous fixture intentionally illustrates a false positive. A small test summary may report scenario outcomes and observed runtime, but do not advertise a precision/recall percentage without a separately defined labelled evaluation set, unit of evaluation and actually measured results. Unit tests passing are not '100% fraud accuracy'.

Other limits: the detector only finds collection-led episodes with at least six distinct senders; uses simple temporal volume comparisons; does not know opening balances or business context; analyses only supplied records; searches two-hop convergence; may miss slow movement and unrelated patterns; may flag legitimate rapid settlements. Future additions require separate validation, not just more UI labels.

## 15. Demonstration and submission

Rehearse a 2-3 minute core demonstration. Start with the app, not a long market lecture.

1. Load the synthetic split-and-reconverge example and identify A101.
2. Reset or move to 10:02. Show the collection evidence and score 30.
3. Move to 10:04:30. Show INR 38,000 outward versus INR 40,000 incoming and score 70.
4. Move to 10:06:30. Show both pathways to A301, the supporting transaction IDs and score 100.
5. Open the merchant example: volume alone stays Monitor 30. Mention that the ambiguous example can still flag a legitimate settlement and that a human review is necessary.
6. Return to the investigation, add a note and export JSON. Explain that it is a local snapshot, not a bank enforcement action.

Suggested closing: `FINTRACE turns supplied transaction records into a time-ordered, explainable investigation. Every displayed signal is tied to evidence. The prototype supports human review and does not claim proof of fraud.`

Prepare source code with lockfile, README, this specification, a reproducible synthetic dataset, actual test output, and a short backup recording made from the working app. Do not fabricate a live demo using the recording; label a recording when used. Follow the organiser's actual submission format and deadline.

Final definition of done: both teammates can run the project and explain all three rules; the canonical timestamps behave as specified; every visible control works; scores/graph/export share the same snapshot; typecheck/lint/tests/build succeed or remaining failures are explicitly disclosed; the local demo starts without external network dependencies; no private banking data or unimplemented claims are present.

## 16. Official technical references

Technical sources were checked for this specification on 15 September 2026. The product scope, thresholds, visual design, timeboxes and acceptance criteria are proposed design decisions, not facts asserted by these sources.

[S1] Vite - Getting Started: React TypeScript template and runtime compatibility.
[S2] React - Extracting State Logic into a Reducer: state-transition organisation.
[S3] Cytoscape.js documentation: directed graph interaction and preset positions.
[S4] Papa Parse documentation: local-file parsing, validation-related parser results and export escaping.
[S5] Vitest - Getting Started: test setup and one-shot test execution.
[S6] Vite - Deploying a Static Site: production build and local preview workflow.
[S7] OpenAI - Custom instructions with AGENTS.md: repository-level agent instructions.

```text
S1 https://vite.dev/guide/
S2 https://react.dev/learn/extracting-state-logic-into-a-reducer
S3 https://js.cytoscape.org/
S4 https://www.papaparse.com/docs
S5 https://vitest.dev/guide/
S6 https://vite.dev/guide/static-deploy
S7 https://developers.openai.com/codex/guides/agents-md/
```
