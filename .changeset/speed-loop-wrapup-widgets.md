---
{}
---

No release: land the speed-loop wrap-up widgets in `@beep/repo-cli` (private), closing four
ledger items about proofs that were green for the wrong reasons.

**Tree parity — `yeet verify --merged` (#84).** Hosted `check.yml` is `on: pull_request` with
no `ref:` override, so every hosted lane runs `refs/pull/N/merge` while `yeet verify` proves
the worktree's HEAD. The stale-base guard cannot close that gap: it fires on textual path
overlap, so a semantic conflict merges cleanly and passes every local gate. The new tier
materializes the merge — `merge-tree --write-tree`, `commit-tree`, a detached worktree under
the ignored packet dir — installs the *merged* lockfile with `--frozen-lockfile`, and runs the
ordinary full proof there. Artifacts stay in the primary worktree because the preview is
removed on every exit path. A conflicting merge is refused by name, with a remediation that
says `git merge` rather than `git rebase`: hosted CI merges, and the preview models hosted CI.

**Gate staleness (#88).** A gate run *before* the change it gates is a vacuous proof that reads
identically to a real one. `yeet status` now judges each catalogued gate artifact — the
coverage, jsdoc-totals, knip, test-typecheck-blindspot, and goals-doctor baselines plus the
jsdoc inventory — against the newest file the branch changed, and reports any artifact that
predates it with the command that regenerates it. Equal timestamps count as fresh, an absent
artifact is `unproven` rather than stale, and a clean pass renders a line rather than nothing
so "found nothing" cannot be mistaken for "never ran".

**Flake fingerprints (#89).** The merge loop knew two signatures, both requiring a log
download. Three shape fingerprints join them, decidable from the job record the loop already
fetched: `setup-5xx` (the implicit setup step itself concluded failure — GitHub could not
resolve action download info), `runner-loss` (the job failed while not one step ever reached a
conclusion), and `install-failure` (dependency install failed with nothing but skipped steps
and runner cleanup after it). Shape is consulted before the log, because a job the control
plane killed often has no fetchable log at all — so a log-first loop misclassified exactly the
failures it is safest to rerun. The rules live in `internal/github/JobShape`, shared with the
lane-timings collector, so the two surfaces cannot disagree about what infrastructure failure
means.

`install-failure` is admitted on population grounds rather than proof, and its docs say so: a
genuinely broken lockfile matches it and no rerun will fix that. The observed population is
network flakes — the live instance on PR 626's Codegen Drift lane was keytar's prebuild
download timing out, falling back to a node-gyp source build, and dying on absent
`libsecret-1-dev` headers — and the per-job-per-SHA budget caps a wrong guess at exactly one
rerun before it reports `rerun-spent`. Because the class name alone cannot tell an operator
whether to investigate or wait, each shape match now renders its observed mechanism alongside
the class.

Two refusals carry the precision: a cancelled job is rejected because fail-fast cancellation
leaves the same all-null step shape and only the job-level conclusion separates them; and an
install failure followed by a lane that actually concluded is rejected, because the job got
past install and the red belongs to that lane. Classes are tried in the order a job hits them,
so a setup failure — which leaves install `null` — never reports as the vaguer class.

**Lane-timings collector (#90).** New `bun run beep ci lane-timings [--runs n] [--tsv]`, with
`run_attempt`, setup/install seconds, per-job duration, runner class, and a managed-runner
infra-success rate. Pickup latency is measured at job level and defined *only* on attempt 1,
with the filter applied in the collector: `run_started_at` is rewritten on re-dispatch, and a
run-level reading of the same incident window said 18–21 minutes where audited job-level
pickup was 19–67 seconds. Absent measurements render as empty TSV cells rather than zeros so
the filter survives to the last consumer, and a negative span reads as missing data rather
than as a fast job — job records with a `created_at` postdating their own `completed_at` were
observed live.

Follow-ups, tracked rather than assumed closed: per-lane peak RSS is carried as an optional
column and stays `None` until a runner-side step emits one (no Actions API reports it, and
`.github/workflows/**` is out of scope for this PR); and the per-lane fingerprint arm of #88 —
rendering a recorded lane result from an earlier worktree hash as STALE in `yeet status` —
still needs `ProofState`'s `laneProofs` exported.
