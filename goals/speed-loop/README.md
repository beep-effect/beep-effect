# Speed Loop

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run the research → probe → grill → ship → harvest cycle as a standing agentic
loop over repo quality/speed/performance, until two consecutive cycles' best
probe-gated candidates each measure under ~30 seconds of full-sweep saving
(the stop rule — see `SPEC.md`).

## Read This First

1. [`SPEC.md`](./SPEC.md) — the loop protocol, guardrails, and stop rule.
2. [`PLAN.md`](./PLAN.md) — the cycle log.
3. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) — the living
   27-item opportunity ledger (the loop's working memory).
4. [`research/GRILL-DECISIONS.md`](./research/GRILL-DECISIONS.md) — every
   locked decision across the three grill sessions.
5. `research/r*.md`, `research/o*.md` — the eleven research reports;
   `research/adhd/` — the divergent-ideation pool and deepened branches.

## Current Phase

Cycle 2 shipping: PR #548 and #549 merged; this PR (PR-A "pipeline speed")
carries the gates diet, changed-scope lever, fail-fast preflight wave,
publish fix, instruments + attempt journal, integration split, and the
zero-unresolved-comments closeout gate. PR-B ("dead weight"), the D-series,
PR-C, and five ordered spikes are queued per the grill decisions. Owned-runner
pilot infrastructure is provisioned (see `research/runner-secrets.md`).

## Latest Evidence

- PR #548 (merged): tstyche removal, MimeType check-bomb fix
  (17.79s → 0.445s per barrel importer), CI concurrency caps, bounded docgen.
- PR #549 (merged): probe-proved leaf boundaries — BlockRepair 15.2M → 2.0M
  instantiations (−86.8%), Md.safe −21.8%.
- Predecessor packet: `goals/quality-speedup` (completed-retained) — census,
  quality-time inventory, tstyche inventory.
