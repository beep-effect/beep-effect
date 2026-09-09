# Run-3 lane brief — Stage A residue remediation (Ruling 22)

Lane: Codex (`gpt-6-astra`, xhigh) implementing; Fable reviews and publishes. Steward:
Benjamin. Ruling implemented: **22** (DECISIONS.md "post-merge residue ruling"): residue
law outranks pin immutability until ratification. Rulings still in force: **11** (custody
surrogate), **3** (the run-2 generator `etl_fleet_corpus.py` and `run2-fleet/` stay
byte-frozen), **5/12** (checkout-identity pin unchanged).

Work happens ONLY in this worktree (`~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes`,
branch `ontology-run3-stage-b-fixes`), on top of the Stage B review-fix commit already on the
branch. Commit (stage by path; never `git add -A`); never push, never open a PR.

## Read first

- `research/run3-lanes/stage-b-review-fixes-{brief,report}.md` — the Stage B fix you mirror:
  rule-based process-member detection (normalized key ends with `pid` or contains
  `procstart`/`processstart`), per-object custody minting with variant precedence and
  tallies, left-boundary host-root matching in redaction and scan, `.properties` coverage.
- `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3_fleet_corpus.py` (the generator you amend;
  its current sha `7d711673d80791ce2aa1c9a1d1d8da6e1ff1867a55962806355fdf44ffd378e3` is the
  "frozen" digest Ruling 22 records) and `test_run3_generators.py`.
- `run3-fleet/MANIFEST.yaml` head (custody section, source facts) and the Stage A report.

## Required

1. Amend `etl_run3_fleet_corpus.py` with exactly the Stage B fix semantics for F1 and F3
   (copy the implementation; do not import across generators). Keep every other behaviour
   and output shape identical so the Stage A report's descriptions stay true apart from the
   custody section.
2. Manifest additions: `generator_lineage: {frozen_sha256: 7d711673…, amended_sha256: <new>,
   ruling: 22, reason: "process-identity variants (ownerProcStart, ownerPid, attachedPid)
   survived the name allowlist"}`; the custody section describes the rule and the per-variant
   tallies.
3. `--refresh` the pin (new salt, new capture instant). Do NOT touch `run3-checkout-identity/`
   or its generator. Post-refresh: `grep -rlE 'attachedPid|ownerProcStart|ownerPid|"pid"'`
   over `run3-fleet/` must be empty; residue scans zero; verify → corrupt → restore cycle
   passes; detached-worktree verify at the committed HEAD.
4. Tests: extend `test_run3_generators.py` with the same variant/boundary cases the Stage B
   suite gained (positives and negatives); all green.
5. Bookkeeping: append `## Residue remediation (Ruling 22, 2026-09-09)` to
   `research/run3-lanes/stage-a-report.md` (counts, hashes, digests, scan proof);
   `README.md` Trail entry; `ops/manifest.json` run-3 line notes the refresh; one
   `OPPORTUNITIES.md` receipt is already owed by the Stage B lane — add only what is new.
   `DECISIONS.md` already carries Ruling 22 (Fable wrote it); do not edit it.
6. Packet validator + CQ suite green; `bun run beep knowledge refs --check` after commit.

## Report and commit

Report: `research/run3-lanes/stage-a-residue-report.md` (in this worktree; commit it).
Commit message: `fix(explorations): refresh the Stage A fleet pin under the amended generator`,
body lines under 100 characters, citing Ruling 22 and both generator digests.
