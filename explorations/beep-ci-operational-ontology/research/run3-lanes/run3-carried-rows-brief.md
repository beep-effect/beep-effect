# Run-3 carried-rows docket brief (prior-index re-open; orchestration lane, not a seat)

You are the CARRIED-ROWS DOCKET lane of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for
`beep-ci-ops`, a fresh Codex context. HEAD is the frozen run pin; run no `git` command that
writes; you create only `$WORK/sittings/carried-rows-docket.md` and
`$WORK/sittings/carried-clusters.yaml`. You never edit a seat record.

Paths: `ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`,
`WORK=$ONT/work`, `ARCH=explorations/beep-ci-operational-ontology/ontology/extraction/s4/archives/beep-ci-ops`.

## The obligation (validator v14, skill step 9)

The prior index `$ONT/runs/orun-2026-09-03T02:46:18Z.index.yaml` carries 68 rows with
`outcome: unresolved`. Every one MUST get a row in this run's `work/dispositions.index.yaml`
with `carried_from_prior: true`, and the validator rejects a row re-parked with VERBATIM the
same `needed_evidence`. Legal outcomes for a carried row: `irrelevant` with a concrete reason
(supersession by a named run-3 proposal or ratified term, wrapper/transport, declaration
removed, re-identified as a named run-3 observation id), `mapped`/`proposed` only when the ref
is a run-3 proposal, or `unresolved` with NEW `needed_evidence` naming what run 3 still lacks
and `since: 2026-09-10`.

## Inputs

- The prior index (read via `git show HEAD:<path>`), the intake docket
  `explorations/beep-ci-operational-ontology/research/auditor-run3-intake.md` Queue C (every
  row is already clustered there with its discharging corpus or its park reason), and
  DECISIONS.md "run-2 sitting 2" (the precedent rulings and the three kept-open rows' named
  requirements).
- This run's surface: `$WORK/observations/`, `$WORK/prose-observations/`, `$WORK/hypotheses/`,
  `$WORK/foundational/`, `$WORK/proposals/otp-*.yaml` (26 proposals; ignore reviews, which may
  still be arriving), and the corpus manifests under `$ONT/corpus/run3*/MANIFEST.yaml` for
  evidence census facts (`rider_evidence`, event tallies).
- Precedent format: the archived run-2 docket
  `$ARCH/orun-2026-09-03T02:46:18Z.work/sittings/carried-rows-docket.md` and
  `carried-clusters.yaml` (reading these archives is permitted for this lane only).

## Output

1. `$WORK/sittings/carried-clusters.yaml`: every one of the 68 prior row ids exactly once,
   grouped into referent clusters; per cluster: `recommended_outcome`, `reason` (the concrete
   supersession/wrapper/re-identification text, or the NEW needed_evidence for a park), `ref`
   (run-3 proposal id or observation id when the outcome is `proposed`/`mapped`/re-identified),
   and `evidence` (the run-3 observation or manifest facts that ground the recommendation).
   Where a row's prior `needed_evidence` names a corpus fact that run 3 now has (a v3 event
   family, a checkout binding, a failure-signature tuple, a synthetic eviction chain), the
   recommendation must cite the observation that bears it; where run 3 still lacks it (cache-plan
   resolver result, proof-ledger issuance, package-identity policy, the thirteen Ruling-6
   families), the new `needed_evidence` must say what changed since run 2 and what is still
   missing — never the prior wording.
2. `$WORK/sittings/carried-rows-docket.md`: the steward-facing docket in the run-2 format:
   cluster table (rows, recommended outcome, one-line reason), then per-cluster detail, then
   totals by recommended outcome. Clusters few enough to rule on in one sitting (about ten to
   fifteen).
3. Final message: totals by recommended outcome, the cluster table, and any row whose prior
   `needed_evidence` you could not map to a run-3 fact or a park reason.
