# Patent Drafting Episode Ledger

## Status

Stage: `graduate`
Status: `graduated`

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
scope, language, and point-in-time eligibility before ranking and discloses
its policies through a machine-readable answer annex; memory engines sit
behind an engine-agnostic `MemoryProjection` port as lossy, disposable
projections rebuilt from the authoritative ledger with a recent-raw-episode
fallback — the remo2/remo3 boundaries resolved in the 2026-08-01
reconciliation grill are binding. Third wedge of the signed-off
[`legal-patent-kg-deepening`](../legal-patent-kg-deepening/README.md)
routing matrix (2026-08-01 reconciliation grill — where the claim-limitation
cluster merged in as the first rung; opened 2026-08-06 on Benjamin's call
after the relator wedge graduated).

## Next Open Question

No blocking question. Reopen at `decompose` only when the public-USPTO
benchmark gate in [`MAP.md`](./MAP.md) fires.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): the merged cluster row (primary + absorbed first rung), eleven nuggets, grounding, resolved grill boundaries, cautions.
3. [`DECISIONS.md`](./DECISIONS.md) - pre-seeded wedge decisions: research lanes, dependency posture, orchestration, PR staging.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
5. Parent packet: [`../legal-patent-kg-deepening/ROUTING-SEED.md`](../legal-patent-kg-deepening/ROUTING-SEED.md) / [`DECISIONS.md`](../legal-patent-kg-deepening/DECISIONS.md) - the routing matrix and campaign grill log.
6. [`BRIEF.md`](./BRIEF.md) - operator-ratified shaped contract.
7. [`MAP.md`](./MAP.md) - ratified rung 1 and deferred benchmark sequencing.

## Trail

- 2026-08-13 (final ceremony): operator signed off `BRIEF.md` and `MAP.md`;
  graduated [`patent-drafting-episode-ledger`](../../goals/patent-drafting-episode-ledger/README.md).
  The public-USPTO benchmark remains a MAP re-entry point.

- 2026-08-13 (ceremony): drafted `BRIEF.md` and `MAP.md` from the ratified
  six-question contract. Stage remains `shape`; operator BRIEF review is the
  gate before decomposition or goal scaffolding.

- 2026-08-13: align closed; all six questions resolved in `DECISIONS.md`.
  Stage advanced to `shape`; BRIEF drafting/review is next.

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
- 2026-08-06: packet-open PR #612 published (docs-only; full local proof
  green after one environment-only TS2589 build flake rerun; Greptile 5/5,
  0 issues, 0 threads on first review). Both research lanes ran as parallel
  Opus 5 agents (Workflow `wf_8f1c1557-f39`): Lane A repo surfaces
  (headline drift: PR #575 landed the full law-practice lane including a
  payload-bearing append-only migration precedent; practice-kg-mcp is live
  code with reusable row/decoder shapes but a non-total query-ordering gap
  before remo2 can claim deterministic rows; the verified-span substrate is live
  and consumed; NEW blocker — the live `RuntimeApprovalDecision` vocabulary
  is single-member `pending`, so gate refusal is unrepresentable today),
  Lane B public-source grounding (the never-compute boundary proved
  two-sided from MPEP/statute primary text; statutory N-closure for
  dependent claims; the T3-F10 projection regression verified; the
  recent-raw fallback found to be prescribed by no source; T3-F5's missing
  reification ablation confirmed at source; 4 of 7 annex fields net-new).
  `RESEARCH.md` synthesis authored; SOURCES ledger populated; review gate 1
  critique (Opus) folded. Stage capture → research; one new align branch
  added to `openQuestions`. Research artifacts stay uncommitted until PR 2.
- 2026-08-08: packet-open PR #612 had merged centrally 2026-08-07; PR
  staging amended on Benjamin's wrap-up directive (see DECISIONS) — the
  research-stage record landed as its own docs-only PR, together with the
  parent-side Lane B promotions: 15 catalog URL back-fills
  (`P005`/`P025`/`P030` honestly left null), the title-drift/one-work
  corrections and HSNKB CC BY-NC caveat in the parent `SOURCES.md`, and the
  parent HANDOFF/README/ATLAS pointer sweep to research-complete. Align
  outcomes follow in the next PR; the align session is Benjamin's.
