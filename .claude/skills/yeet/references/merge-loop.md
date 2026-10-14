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
