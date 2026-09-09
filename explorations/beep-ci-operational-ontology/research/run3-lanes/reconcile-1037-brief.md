# Run-3 lane brief — reconcile PR #1040 with main after PR #1037, and land the file-URI fix

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and pushes. Steward: Benjamin.
Steward ruling (2026-09-09): #1037 (CSF-013, `fix(security): remove schema process metadata
from corpora`, merged as `22063e7b6d`) lands first; #1040 reconciles. #1037 removed
`attachedPid`/`ownerProcStart` (with case and separator variants) across all four
generators, added escaped-key and `.properties` checks, required explicit finding
attribution before replay, and byte-repaired 58 raw files in `run3-fleet/` and
`run3b-fleet/` under the CSF-012 repair mechanics. This branch re-captures those two pins
plus `run3b-synthetic/` under rule-based generators (see `reconcile-1032-report.md`); a
refresh supersedes a byte repair, but #1037's rules, tests, receipts, and packet
bookkeeping must survive.

Work ONLY in `~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes` (branch
`ontology-run3-stage-b-fixes`, PR #1040). Commit (stage by path; never `git add -A`); never
push, never touch the PR, never rebase or force, never edit DECISIONS.md.

## Step 0 — land the file-URI boundary fix already in the tree

The previous lane left UNCOMMITTED edits (see `git status`: both generators and both test
files) implementing `research/run3-lanes/file-uri-boundary-brief.md`: host roots preceded by
a URI authority separator (`file:///home/…`, `file:///proc/123/…`) are now redacted and
rejected while `packages/workspace/…` stays a relative path. Its new tests passed against the
fix. Review those edits, complete anything unfinished, run both test suites, and commit them
FIRST as `fix(explorations): bound host-root redaction at URI authority separators`. Do not
repair or refresh any pin in this step.

## Step 1 — merge main

`git merge origin/main` (merge commit). Resolve:
- `etl_run3_fleet_corpus.py`, `etl_run3b_fleet_corpus.py`, `test_run3_generators.py`,
  `test_run3b_generator.py`: BOTH sides — #1037's variant removal, escaped-key/properties
  checks, finding-attribution-before-replay, and its tests, together with this branch's
  rule-based detection, custody, path boundaries (now URI-aware), termination join, lineage,
  and tests. `etl_fleet_corpus.py`, `etl_run3_checkout_identity.py`: theirs.
- `goals/codex-security-findings-2026-09-08/**`: theirs.
- `run2-fleet/`, `run3-checkout-identity/`: theirs.
- `run3-fleet/`, `run3b-fleet/`, `run3b-synthetic/`: ours to complete the merge, then
  RE-CAPTURE all three under the merged generators (`--refresh`; synthetic from
  `~/.cache/beep/ciops-synthetic-root`, READY present, producer sha `0ee8d157…`). Decide from
  the merged code how a fresh capture records the CSF-012/CSF-013 `security_resanitization`
  history (#1037 says "all five manifest pins retain … original CSF-012 repair receipts, with
  separate CSF-013 updates") so main's verifiers, finding-attribution rule, and provenance
  checks accept refreshed manifests; cite the code in the report.
- packet `README.md`, `ops/manifest.json`, `OPPORTUNITIES.md`: merge both texts.

## Step 2 — verify

All five pins pass their own verifiers; corruption/restore cycle on the three refreshed pins;
residue scans empty (variants, quoted/escaped keys, `file://` URIs, host/uid/hostname);
`failedStepId`/`failureKind` pair counts unchanged from `reconcile-1032-report.md`; detached
worktree verify at the committed HEAD; packet validator + CQ suite; `bun run beep knowledge
refs --check` after commit.

## Report and commits

Append `## Reconciliation with #1037 and file-URI boundary (2026-09-09)` to
`reconcile-1032-report.md`; write `research/run3-lanes/reconcile-1037-report.md`.
Commits: the Step 0 fix; `chore(explorations): merge main into the run-3 residue follow-up
after #1037`; `fix(explorations): re-pin the refreshed corpora after the CSF-013 merge`.
