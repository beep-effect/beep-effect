# Patent Drafting Episode Ledger

## Status

Stage: `capture`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Make patent drafting a schema-fixed, law-owned product record: an
append-only `DraftingEpisode` aggregate with a closed event union and pure
state-machine fold (outline, retrieval, chunk generation, limitation
support, deterministic validation, bounded retry, correction delta, attorney
disposition), whose first rung is the `ClaimLimitationSupportSet` promotion
gate — a submachine of the episode state machine sharing the same
`RuntimeApprovalGate` — refusing draft promotion while any ordered claim
limitation lacks verified current-description anchors or an append-only
attorney disposition. Deterministic retrieval resolves identity, hierarchy,
scope, and point-in-time eligibility before ranking and discloses its
policies through a machine-readable answer annex; memory engines (Cognee
first) sit behind a `MemoryProjection` port as lossy, disposable projections
rebuilt from the authoritative ledger with a recent-raw-episode fallback —
the remo2/remo3 boundaries resolved in the 2026-08-01 reconciliation grill
are binding. Third wedge of the signed-off
[`legal-patent-kg-deepening`](../legal-patent-kg-deepening/README.md)
routing matrix (2026-08-01 reconciliation grill — where the claim-limitation
cluster merged in as the first rung; opened 2026-08-06 on Benjamin's call
after the relator wedge graduated).

## Next Open Question

Run the two locked research lanes (see the research-depth decision in
[`DECISIONS.md`](./DECISIONS.md)): Lane A repo composition inventory →
`research/01-repo-surfaces.md`; Lane B bounded public-source grounding
(35 U.S.C. § 112(a)/§ 132 + MPEP § 2163/§ 608.04 never-compute frame; the
episode-memory and retrieval papers behind the six primary-cluster nuggets)
→ `research/02-drafting-episode-frame.md`. Then review gate 1, then the
align session with Benjamin — first branch: the episode set, rebuild proof,
and raw fallback (parent align question 14), with the answer annex, the
support schema/attorney gates, and routing modes behind it
(`ops/manifest.json` `openQuestions`).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): both merged cluster rows, eleven nuggets, grounding, resolved grill boundaries, cautions.
3. [`DECISIONS.md`](./DECISIONS.md) - pre-seeded wedge decisions: research lanes, dependency posture, orchestration, PR staging.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (stub until research).
5. Parent packet: [`../legal-patent-kg-deepening/ROUTING-SEED.md`](../legal-patent-kg-deepening/ROUTING-SEED.md) / [`DECISIONS.md`](../legal-patent-kg-deepening/DECISIONS.md) - the routing matrix and campaign grill log.

## Trail

- 2026-08-06: packet opened on Benjamin's call, the day the relator wedge's
  graduation PR #590 merged (the 2026-08-04 unblock milestone — candor BRIEF
  approval — was long since reached). CAPTURE seeded from the parent
  routing-seed's merged row: "Drafting episodes, deterministic retrieval,
  and rebuildable projections" plus the absorbed "Claim-limitation support
  and governed patent drafting" first rung (merged 2026-08-01;
  `ClaimLimitationSupport` is a submachine of the `DraftingEpisode` state
  machine sharing `RuntimeApprovalGate`); nuggets
  `T1-F10`/`T3-F4`/`T3-F5`/`T3-F10`/`T4-F7`/`ADHD-3` +
  `T4-F1`/`T4-F2`/`T4-F3`/`T4-F4`/`ADHD-2`; the resolved remo2/remo3
  boundaries carried verbatim as binding. Wedge-scoped decisions (research
  lanes, dependency posture, Opus 5 orchestration, two-stage PR cadence)
  pre-seeded into DECISIONS; parent align questions 11 (the `T3-F4` half),
  12, 14, 15, and 16 carried into `openQuestions`.
