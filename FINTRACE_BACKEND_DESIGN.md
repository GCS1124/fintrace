# FINTRACE backend design

This addendum records the backend upgrade requested after the original browser-only MVP specification. The original UI, canonical fixture, and 30→70→100 replay contract remain intact; the new endpoint adds a richer, stateless graph pass.

## Endpoint

`POST /api/analyze`

Request body:

```json
{
  "transactions": [
    {
      "id": "T001",
      "timestampMs": 1789705800000,
      "fromAccount": "A001",
      "toAccount": "A101",
      "amountPaise": 500000,
      "currency": "INR"
    }
  ],
  "asOfMs": 1789705800000,
  "focalAccountId": "A101"
}
```

`asOfMs: null` means before the first transfer. The endpoint re-validates the payload instead of trusting the browser: IDs, INR currency, positive safe-integer paise, finite timestamps, duplicate IDs, self-transfers, and the 2,000-row limit are enforced again.

The success response includes:

- the cutoff-aware canonical `snapshot` used by the base rules;
- `engineVersion: "fintrace-graph-v2"`;
- `intelligenceByAccount`, containing the advanced graph result for the requested focal account; and
- a processing timestamp for operator visibility.

Responses are marked `Cache-Control: no-store`; the function has no database write and no model provider dependency.

## Gemini analyst endpoint

`POST /api/ai-analyze` is an optional server-only copilot layer. The browser sends a compact cutoff-scoped context rather than a whole dataset: selected account, deterministic case signals, graph summaries, relevant transaction rows, evidence IDs, and the local session note. The endpoint calls Gemini `generateContent` with a JSON response schema, then normalises the response and keeps only evidence IDs already present in the supplied context.

The endpoint requires the server environment variable `GEMINI_API_KEY` and accepts `GEMINI_MODEL` with `gemini-2.5-flash` as the default. The key must never be prefixed with `VITE_` or sent to the browser. Missing configuration returns an explicit setup response while the deterministic workspace remains usable. Gemini output is a reviewer brief, not a fraud verdict or a replacement for the versioned analysis engine.

## Analysis pipeline

1. Re-validate the normalised records at the API boundary.
2. Apply the same `timestampMs <= asOfMs` snapshot boundary as the client.
3. Run the versioned collection, forwarding, and reconvergence rules. These preserve the canonical 30, 70, and 100 checkpoints.
4. Build a time-sorted outgoing adjacency index.
5. Seed paths from the selected focal account after its representative collection anchor.
6. Traverse only strictly later transfers. Each hop is limited to the configured 10-minute hop window and the total path to 30 minutes; the traversal stops at five hops, avoids repeated nodes, and permits a return to the focal node only as a cycle witness.
7. Bound fan-out to 24 outgoing candidates per account and retain at most 120 terminal paths. The result exposes `traceTruncated` instead of implying a complete network when the cap is reached.
8. Carry the smallest transfer amount on each path as a bottleneck observation. This is intentionally not called “funds traced” because records do not prove FIFO ownership or balance conservation.
9. Derive inspectable graph signals:
   - three or more first-hop recipients: multi-recipient fan-out;
   - a path of at least three transfers: multi-hop layering;
   - a chronological return to the focal account: circular re-entry;
   - at least ten transfers touching the traced network around the anchor: network velocity.

The UI keeps the base triage score separate from the graph `riskScore` context. Both are capped at 100 and both are labelled as review context, never as fraud probability.

## Local and Vercel execution

The Vite config mounts both handlers as development middleware, so `npm run dev` exercises `/api/analyze` and `/api/ai-analyze` without a second process. On Vercel, both files under `api/` are discovered as serverless functions automatically. The frontend calls the deterministic endpoint through `src/services/analysisService.ts` and the optional Gemini endpoint through `src/services/aiAnalysisService.ts`; if either provider is unavailable, the core local engine remains usable.

## Responsible boundary

The endpoint is designed for authorised transaction records and human review. It has no authentication or tenant isolation, so it is suitable for the hackathon prototype only—not for production banking data. Do not treat scores, path bottlenecks, or graph links as proof of fraud, ownership, intent, or loss. A production system would require access control, audit logging, labelled evaluation, balance-aware accounting, investigator workflows, privacy controls, rate limiting, and independent validation before any consequential use.
