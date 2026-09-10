# Run-3 ratification docket brief (sitting 3 preparation; orchestration lane, not a seat)

You are the RATIFICATION DOCKET lane of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for
`beep-ci-ops`, a fresh Codex context that authored no proposal or review. HEAD is the frozen
run pin; run no `git` command that writes; you create only
`$WORK/sittings/ratification-docket.md` and `$WORK/sittings/ratification-docket.yaml`. You
never edit a seat record and you ratify nothing: the steward authors ratifications.

Paths: `ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`,
`WORK=$ONT/work`, `ARCH=explorations/beep-ci-operational-ontology/ontology/extraction/s4/archives/beep-ci-ops`,
`SKILL=.claude/skills/ontology-foundational-auditor`, `SHARED=.claude/skills/_shared`.

## Inputs

- Every proposal `$WORK/proposals/otp-*.yaml` with ALL its reviews (round 1 `.review.yaml`,
  later `-rN.review.yaml`; the latest governs), its `ic-`/`fa-` pair, hypothesis, cited
  observations, and the blinded `-alt` pair in `$WORK/alternative/` (seat divergence is a
  FLAG, not a block).
- The gate output the orchestrator gives you in the launch message (the `VAL --gate --repo .`
  run: submittable / flagged / blocked lists as printed).
- Sitting entries `$WORK/sittings/sitting-1-decisions-entry.md`, `sitting-2-decisions-entry.md`;
  the validity report `$WORK/review-audit/validity-report-r1.md`.
- The intake docket `explorations/beep-ci-operational-ontology/research/auditor-run3-intake.md`
  Queues A (ordering cluster ratifies together or re-parks together), B (rat-047..052 flags
  and which corpus discharges each), D (hasScope/Scope ratify-if-exercised; schedulesWorkUnit
  historical carrier).
- The archived flagged ratifications `$ARCH/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-047..052.yaml`
  (verbatim flags) and the ratified taxonomy `explorations/beep-ci-operational-ontology/ontology/extraction/s5/TAXONOMY.yaml`.
- Precedent format: `$ARCH/orun-2026-09-03T02:46:18Z.work/sittings/ratification-docket.{md,yaml}`
  and DECISIONS.md "run-2 sitting 3" (reading these archives is permitted for this lane only).
- The ratification schema `$SHARED/schemas/ratification.schema.yaml` (the steward's records
  must name the proposal in `verbatim_decision`; byte-identical verbatims are rejected).

## Output

`ratification-docket.yaml` and its rendering `ratification-docket.md`, presenting EVERY
proposal individually (never only a summary table), in three sections:

1. **Ratify-candidates** (latest review PASS, no seat divergence, no open flag): per proposal,
   the term, category, warrant (CQ ids or decision terms), identity criterion in one line, the
   evidence chain ids, a suggested `verbatim_decision` sentence that names the proposal and
   the decision, and `proposal_sha256` (sha256 of the proposal file bytes).
2. **Flagged submissions** (latest review INDETERMINATE with an honest named missing
   observation, or seat divergence, or an exact-reuse mapping that discharges a rat-047..052
   flag): the same fields plus the flag text and the suggested `verbatim_decision` that
   carries the deferral (run-2 rat-047..052 style), or the rat-0NN flag it discharges and how.
3. **Withdrawals and deferrals** (latest review FAIL after the last round, or withdrawn
   during revision): proposal id, the landed rules still unanswered or the concession, and the
   named run-4 evidence; these are removed at close per the run-1/run-2 precedent.

Then the cluster rulings the steward must make jointly: the ORDERING CLUSTER (list every
`ov-` proposal with its status; the cluster ratifies together with flags, or parks whole:
state which members block a ratify-together outcome and why); the Queue B discharges
(rat-047..052: which flags a run-3 reuse mapping now discharges, which re-park to run 4 under
Ruling 17); Queue D (object-property `hasScope`/`Scope` parks with the no-punning record;
`schedulesWorkUnit` stays the historical carrier). Compute the unresolved fraction the index
will show (non-irrelevant live rows: run-3 observations whose chains end withdrawn/deferred/
null-unresolved, plus the 54 carried parks) and say whether a manifest
`unresolved_fraction_waiver` is needed (>50%). Final message: counts per section, the
ordering-cluster verdict, the Queue B table, the unresolved fraction.
