# FINTRACE repository instructions

## Product contract

FINTRACE is a local-first transaction investigation workspace with a stateless
Vercel-compatible analysis API. The original browser-only MVP contract remains
the UI fallback and canonical demo baseline. `FINTRACE_BACKEND_DESIGN.md` is the
addendum for the requested graph-intelligence upgrade. Preserve the product
name, React + Vite + TypeScript stack, light minimal-clutter analyst UI, and
exact collection-led scoring semantics.

## Engineering rules

- Keep the UI, pure analysis engine, and browser adapters separated.
- Use functional React components, hooks, TypeScript strict mode, and CSS Modules.
- Keep all scores, graph evidence, and exports derived from one current snapshot.
- Use integer paise for money; never use floating-point parsing for normalisation.
- Never read future transactions while analysing a replay cutoff.
- Keep imports all-or-nothing: an invalid CSV must not replace the active dataset.
- Preserve repeated transaction IDs only when IDs are distinct; reject duplicate IDs.
- Re-validate normalised records at `/api/analyze`; keep the API stateless and
  return explicit engine/version metadata, cutoff data, linked paths, and
  truncation notices.
- Keep the backend deterministic and explainable. Do not add a database,
  authentication, LLM calls, payments, Redux, Next.js, Tailwind, or real
  banking integration to this prototype.
- Do not place credentials, private banking data, or unimplemented claims in the repo.

## Checks

Before declaring work complete, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

When a local server is available, verify the app in a real browser at the two
target desktop sizes and exercise the canonical 30 -> 70 -> 100 replay, CSV
import safety, evidence selection, note isolation, and current-cutoff export.

Vercel is the intended frontend and serverless-function hosting target. A
deployment is not considered verified until its resulting URL is opened and
checked in a real browser, including a real `/api/analyze` response.
