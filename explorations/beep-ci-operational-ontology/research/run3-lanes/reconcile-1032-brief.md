# Run-3 lane brief — reconcile the follow-up branch with main after PR #1032

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and publishes. Steward: Benjamin.
Context: while this branch (`ontology-run3-stage-b-fixes`, based on `86990e28f9`) was being
built, main took PR #1032 `fix(security): redact quoted corpus process identifiers` (CSF-012):
it widened `PID_IN_TEXT` and added `redact_pid_match` in ALL FOUR generators, added a
`security_resanitization` block to the pin manifests, and byte-repaired 35 raw files across
`run2-fleet/`, `run3-fleet/`, and `run3b-fleet/` in place (no recapture), with `--source-ref`
replay and generator-provenance checks against Git history. This branch instead REFRESHES
`run3b-fleet/`, `run3b-synthetic/` (lane 1) and `run3-fleet/` (lane 2) under generators that
also gained rule-based process-member detection, path-boundary host roots, the termination
join, and generator lineage. Both sides are right; the merge must keep both.

Work ONLY in this worktree (`~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes`,
branch `ontology-run3-stage-b-fixes`). Commit (stage by path; never `git add -A`); never push,
never open a PR, never rebase, never force.

## Read first

- `git log --oneline 86990e28f9..origin/main` and `git show origin/main` for
  `goals/codex-security-findings-2026-09-08/` (the CSF-012 packet) and the #1032 diff of the
  four generators, both test files, and one repaired manifest (`run3b-fleet/MANIFEST.yaml`
  `security_resanitization`, `integrity`, `verification`, `totals`).
- This branch's `research/run3-lanes/stage-b-review-fixes-report.md`,
  `stage-a-residue-report.md`, and DECISIONS.md Ruling 22.

## Required

1. `git merge origin/main` (a merge commit; never rebase). Resolve:
   - generators (`etl_run3b_fleet_corpus.py`, `etl_run3_fleet_corpus.py`): BOTH sides — keep
     #1032's widened `PID_IN_TEXT` + `redact_pid_match` + any repair/`--source-ref`/
     provenance machinery, and this branch's rule-based `process_member`, per-object custody,
     path-boundary host roots, termination join, generator lineage. `etl_fleet_corpus.py` and
     `etl_run3_checkout_identity.py`: take main's version (theirs) untouched.
   - tests (`test_run3b_generator.py`, `test_run3_generators.py`): union of both suites; all
     green.
   - pins: `run2-fleet/`, `run3-checkout-identity/`: theirs (main). `run3b-fleet/`,
     `run3b-synthetic/`, `run3-fleet/`: resolve to OURS to complete the merge, then REFRESH each
     under the merged generator (`--refresh fleet`, `--refresh synthetic --synthetic-root
     ~/.cache/beep/ciops-synthetic-root`, and the Stage A `--refresh`) so the widened text
     redaction applies at capture. Decide from the merged code what a fresh capture records
     in the `security_resanitization`/`integrity`/`verification`/`totals` blocks so main's
     verifiers and provenance checks accept the refreshed manifests; record the decision in the
     report with the code cite.
2. Verify all five pins with their own generators in verify mode (run2-fleet and identity with
   main's untouched generators), the corruption/restore cycle on the three refreshed pins,
   residue scans (this branch's variant patterns AND #1032's quoted/escaped key forms) empty,
   detached-worktree verify at the committed HEAD, packet validator + CQ suite green,
   `bun run beep knowledge refs --check` after commit.
3. Bookkeeping: append `## Reconciliation with #1032 (2026-09-09)` to
   `stage-b-review-fixes-report.md` and `stage-a-residue-report.md` (what merged, new digests,
   counts, whole-tree hashes, the manifest-block decision); refresh README Trail and
   `ops/manifest.json` run-3 line counts; OPPORTUNITIES receipt for the collision (two lanes
   fixing the same public-residue class in parallel; prevention: one owner per pin family per
   day, or a repo-level residue gate that runs the built-in scanners in CI). Do not edit
   DECISIONS.md (Fable amends Ruling 22).

## Report and commit

Report: `explorations/beep-ci-operational-ontology/research/run3-lanes/reconcile-1032-report.md`
(commit it). Merge commit message: `chore(explorations): merge main into the run-3 residue
follow-up after #1032`; refresh commit: `fix(explorations): re-pin the refreshed corpora under
the merged generators`; body lines under 100 characters.

## Additional required item (found by the Stage A lane)

The rule "normalized key ends with `pid`" also matches `stepId` and `failedStepId`
(`…stepid`). The Stage A generator now carries source-cited non-identity exceptions for
them; `etl_run3b_fleet_corpus.py` has an EMPTY exception list, so the lane-1 refresh of
`run3b-fleet/` may have dropped the failure-signature rider fields (Ruling 6:
`pa-failure-signature` needs `failureKind` + `failedStepId` in the same object). Port the
same exceptions (and any other execution-join key that ends in `id`/`pid` after
normalization — enumerate from the deployed verdict/attempt schemas and cite each) into the
Stage B generator with tests, and confirm after the re-refresh that `failedStepId`
occurrences are back to the Stage A/B report counts.
