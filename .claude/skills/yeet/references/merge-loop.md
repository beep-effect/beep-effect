# Merge loop

Read when the heavy matrix holds, when a monitor triages a red job, or when a sweep skips a deletion. Part of the yeet skill.


`yeet monitor --until-merged`, `yeet sweep`, `yeet reply`, and `yeet merge` are
the merge-loop porcelain. They read the clone and the PR; none of them plan
turbo work, so they are cheap to run mid-loop.

- **Heavy admission is applied at creation.** `yeet publish` labels the draft
  PR `ready-for-heavy` when it creates it (push-first-publish D4), so the heavy
  matrix starts with tier 1. `Heavy Admission` in `check.yml` still holds any
  code PR without the label (`Heavy / *` stays "Expected", merge blocked): that
  is a PR that already existed before the publish, or one whose label edit
  failed. Only then run `bun run beep yeet gh pr label add <n> ready-for-heavy` (REST) yourself;
  the held `monitor --until-ready` loop prints that exact command and does not
  burn its settle budget. Never remove and re-add the label.
  The label triggers `heavy-admit.yml`, which runs only the admission job and
  the heavy matrix for that head; tier 1 is neither cancelled nor re-run.
  Docs-only PRs (`docs/**`, `explorations/**`, `research/**`, `.changeset/*.md`,
  any `*.md`, packet prose) need no label: every heavy lane passes without work on
  a hosted runner and satisfies the ruleset. Removing the label changes nothing already reported;
  cancel a heavy run from the Actions UI if it must stop.
- `monitor --until-merged` re-reads status every poll, so a push landing
  mid-session is picked up as the new budget scope. Job triage is job-level
  and mid-run: a completed red job is classified on the poll after it
  concludes, without waiting for the parent workflow run to finish. A failed
  job whose log matches a known flake fingerprint (`ts2589-no-location`, CI
  timeout) gets exactly one `gh run rerun --job <databaseId>` per job per head
  SHA — never `--failed`, which would re-execute coexisting genuine reds; a
  known flake inside an active parent run is deferred without spending its
  allowance. Once the run completes, the loop attempts the rerun once. A
  rejected rerun keeps that allowance spent so authentication, permission, or
  stale-job failures cannot become an unbounded polling loop. A red whose log
  has not materialized yet reports "awaiting log" and is reclassified next
  poll. Anything else is reported as "needs code fix". The loop ends on MERGED
  (after the sweep), on CLOSED, or when you interrupt it.
- **Branch-deletion contract.** `sweep` deletes with `-d` when the branch is an
  ancestor of `origin/main`. It uses `-D` only when the PR is MERGED **and** the
  local tip still equals the PR's recorded head SHA **and** no worktree holds the
  branch; remote deletion needs the same tip match. Any unmet precondition is a
  skip-and-report, not a failure — unmerged local work is never force-deleted.
- A sweep exits 0 whether every step ran or every step skipped: "merged, cleanup
  skipped: `<reason>`" is a success. Authentication or repository-policy
  failures are reported with the exact skipped cleanup step; checked-in Claude
  and Codex settings no longer block preconditioned local or remote deletion.
- `merge` never passes `--delete-branch`: it merges, confirms `MERGED` by bounded
  poll, then hands the whole cleanup sequence to the worktree-aware sweep. The
  sweep may auto-run on monitor's merged detection; the merge never auto-runs.

## Ready

`bun run beep yeet ready` flips a draft at content-final (push-first-publish
D11, which amends D10). It reads the PR with the monitor's own status read and
flips the draft when, on the current head, the PR is open, no required
check is known to be failing, every review thread is answered, and
`.beep/yeet/final-check/<head>.json` is a complete passing receipt. Pending
checks and optional lanes (`Heavy / *`) never hold it. Otherwise it refuses
with the first blocker named (`pr-open`, `no-required-red`,
`threads-resolved`, `final-check`); skipped final-check gates are printed so
the PR body can name them. There is no `--force`. Flip only when no further push is
planned: a push after the flip restarts the review window. Squash-message advice: [`gh-rest.md`](gh-rest.md).

### Refresh after a main merge

A head F with no receipt of its own may carry the receipt of an ancestor R
(operator ruling 2026-10-28, `internal/FinalCheckRefresh.ts`), so taking a main
merge after final-check does not force a second ~45 minute run. `yeet ready`
applies the rule only when F has no receipt at all; a failing or partial
receipt on F always refuses. It picks the nearest strict ancestor with a
complete passing receipt, takes MBR = merge-base(R, base) and
MBF = merge-base(F, base), and counts a path from `git diff R F` as the lane's
own change when it is absent from `git diff MBR MBF` or when its lane patch
(`MBR..R` against `MBF..F`, compared like `git patch-id`) differs. It passes
only when every own change is on the allowlist:

- regenerated standards inventories: `jsdoc-documentation.inventory.{jsonc,md}`,
  `effect-vitest.inventory.jsonc`, `schema-first.inventory.jsonc`,
  `fallow.boundaries.generated.jsonc`, `effect-laws.allowlist.jsonc`;
- goal-packet files: `goals/<slug>/SPEC.md`, `PLAN.md`, `README.md`,
  `ops/manifest.json`, and any `reuse-ledger.md` under the packet.

Code, tests and config always need a full final-check. When the effect-vitest
inventory is an own change, the lane's net count per finding status (head minus
its merge base) must also match between R and F: taking main's copy and
re-running `--write` must not reopen or drop findings. A pass prints R, the own
changes with their allowance, and R's skipped gates; report it to the
orchestrator as `final <F> #N receipt <R>`, where F is the sha after the S32
re-request push. A refusal names R and the files or statuses that broke it.

It then pushes one empty `chore: re-request beep-reviewer (S32)` commit (beep-reviewer
ignores heads pushed while draft), only from the flipped head, else it prints the manual
command; a failed push only warns. Send the sha it prints as the final. Run that printed
fallback only when `yeet ready` could not push; never push an unprompted S32 by hand.

The merge gate carries the wait instead. `merge-ready: yes` needs the
`review-window-elapsed` criterion: 20 minutes since the later of the latest
`ready_for_review` timeline event (the PR's creation when it was opened
ready) and the push of the current head (the earliest check suite on the head
commit). Both are read over REST, only once every other criterion holds, and
the current time comes from the Effect `Clock`. A failed or unparsable read
is `review window unknown`, which blocks exactly like an open window.
`BEEP_YEET_REVIEW_WINDOW` overrides the length with an Effect duration string
(`"30 minutes"`); the default is `YEET_REVIEW_WINDOW_DEFAULT` in
`internal/ReviewWindow.ts`. No reviewer has to post for the window to elapse.

The `beep-reviewer` check gates a merge only while `main`'s ruleset lists it as a
required check: `yeet merge` and `yeet merge-gate` run `enforceReviewerGate`, which
reads the ruleset and passes through when the entry is absent. When the reviewer
cannot run (model quota exhausted), drop the requirement with
`bun run beep reviewer ruleset release --apply` and restore it with
`BEEP_REVIEWER_APP_ID=5321138 bun run beep reviewer ruleset require --apply`
(both need `kriegcloud`'s gh login). Runbook: `docs/ops/beep-reviewer-app.md`.

`monitor --until-ready` still ends `ready-pending-flip` (exit 0) when the PR
is a draft and nothing but the draft flag blocks it. That now means the owner
flipped late: the window starts at the flip, so submit a new monitor after
`yeet ready` and wait for `merge-ready: yes`.
