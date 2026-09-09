# Run-3 lane brief — PR #1040 review fixes, round 2 (Codex review of 2026-09-09 07:06Z)

Lane: Codex (`gpt-6-astra`, xhigh); Fable judged the findings, reviews, and pushes.
Steward: Benjamin. Work ONLY in `~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes`
(branch `ontology-run3-stage-b-fixes`, PR #1040) on top of the reconciliation commits
(`reconcile-1037-report.md`). Commit (stage by path; never `git add -A`); never push, never
touch the PR, never edit DECISIONS.md, `run2-fleet/`, `run3-checkout-identity/`, or their
generators. Both Stage A and Stage B generators change identically where a rule is shared.

Every generator edit changes the self-pinned digest, so finish with ONE re-capture of the
three refreshed pins under the final generators (fleet, synthetic from
`~/.cache/beep/ciops-synthetic-root`, Stage A `--refresh`) and the full verification set
(five verifiers, corruption/restore, residue scans, `failedStepId` counts, detached-worktree
verify, packet validator, CQ suite, `knowledge refs --check`).

## Findings and verdicts

- **C1 (P1, file URIs)** — already fixed by the reconciliation lane's Step 0; only confirm the
  tests exist in both suites.
- **C4 (P1, variants inside serialized payload strings)** — after the #1037 merge, check whether
  its escaped-key rules already redact `{"ownerPid":1234,"ownerProcStart":"…","attachedPid":5678}`
  inside a message string (quoted and escaped forms). If yes, add the regression test and cite
  the rule; if not, extend `PID_IN_TEXT`/`redact_pid_match` and the scan to the full
  process-member domain (same rule as the structural matcher) and test both.
- **C5 (P2, `rapid`/`cupid`/`lipid`)** — HELD. Replace "normalized key ends with `pid`" with an
  identifier-token rule: the key is exactly `pid`/`ppid`, or ends in `Pid` at a camelCase
  boundary (`[a-z0-9]Pid$`), or ends in `_pid`/`-pid`; same for `ProcStart`/`procStart` at a
  boundary. Keep the explicit deployed-name list as a test oracle (grep the schemas). Tests:
  `rapid`, `cupid`, `lipid`, `stepId`, `failedStepId` untouched; `ownerPid`, `attachedPid`,
  `legacyLockOwnerPid`, `claudePid`, `ownerProcStart` dropped.
- **C6 (P2, malformed contender journal)** — HELD. In the synthetic import, a journal whose
  rows are all undecodable is not evidence: require `retained_rows == observed_rows` for every
  synthetic file (zero `excluded_undecodable`), fail the pin otherwise; test with `{bad json`.
- **C7 (P2, custody-variant tally not bound to bytes)** — HELD. Persist the variant beside the
  surrogate in each redacted object (`ownerRefVariant: pid_pair | ownerpid | attachedpid |
  weak`), so verify mode recomputes `owner_refs_by_variant` and the aggregate from pinned
  payloads instead of trusting receipts; keep the receipts and compare. The variant name leaks
  nothing.
- **C2 (P2, legacy receipts on `--source-ref` replay)** — HELD. When a replayed source receipt
  predates `owner_refs_by_variant`, treat the census as `legacy: true` (skip the equality
  check, record the migration) instead of aborting; test with a receipt lacking the field.
- **C3 (P2, `corpus_commit` reachability after squash-merge)** — HELD as a design gap that
  predates this PR (every pin since run 2 cites a branch commit that squash-merge erases).
  Record BOTH `corpus_commit` (capture HEAD) and `corpus_tree` (`git rev-parse HEAD^{tree}`)
  plus `corpus_base` (merge-base with `origin/main`) in the three refreshed manifests, and
  make verify mode check that every `source:{file,line}` citation resolves in the CURRENT
  tree (so a merged main commit reproduces citations even though the branch commit is gone).
  Do not change the older pins' manifests. Note the convention change in the report and in
  one OPPORTUNITIES receipt so S6 POLICY can adopt it.

## Report and commit

Append `## Review fixes, round 2 (2026-09-09)` to `research/run3-lanes/reconcile-1037-report.md`
with per-finding verdict, change, test, new digests, counts, hashes. Commit:
`fix(explorations): harden process-identity detection and bind custody tallies to pinned bytes`,
body lines under 100 characters.

## Clarifications from Fable (2026-09-09 02:20 CT)

- Ruling 23 is NOT on this branch (it lives on the run-2 repair branch); ignore any reference
  to it here. DECISIONS.md on this branch ends at the amended Ruling 22.
- Live-count deltas between captures are organic fleet traffic and are accepted; report them,
  never try to hold them constant.
- The lineage-preservation patch to the security repair script is applied and committed.
