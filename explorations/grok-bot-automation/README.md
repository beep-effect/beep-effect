# Grok Bot automation: hosted judgment, local proof

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Turn two useful hosted bots and a large unused allowance into evidence-bearing
automation without granting a shared hosted VM local credentials, publishing
authority, or merge authority.

## Next Open Question

Measure the Heavy usage and billing state, then inspect the X and GitHub plugin
surfaces before any routine is scheduled. At the shape stage, decide which of
the four recorded frictions in `research/OPPORTUNITIES.md` (lane death without
a written report, sandbox git limits for delegated lanes, staged-only commits
landing before admission, the babysit watch exiting on tolerated reds) become
tooling fixes inside the first bot PR rather than notes.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state and open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's original spark.
3. [`RESEARCH.md`](./RESEARCH.md) - product facts, prior art, and repo inventory.
4. [`DECISIONS.md`](./DECISIONS.md) - locked and deferred outcomes from the grill.
5. [`research/SOURCES.md`](./research/SOURCES.md) - lane and source provenance.
6. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction receipts
   from the research fan-out and the publish session.

## Trail

- 2026-09-03: packet opened after a five-lane research fan-out and a two-round grill; 8 decisions locked, 3 deferred.
- 2026-09-03 (b): PR #969 merged the packet, the architecture decision, and the
  nightly-research SPEC amendment. Follow-up PR #974 corrects the receipt model
  name to `EvidenceLadderState` and adds `research/OPPORTUNITIES.md` with four
  friction receipts from the research and publish session.
