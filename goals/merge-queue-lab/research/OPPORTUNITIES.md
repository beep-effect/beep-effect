# Merge Queue Lab — Opportunities

Friction receipts, recorded when they happen.

## 2026-11-09 — planned paths in a new goal SPEC reached main unchecked

- **Doing:** graduating `explorations/github-merge-queue` into this packet as
  a docs-only pull request (#3047).
- **Evidence:** `SPEC.md` named two files that do not exist yet as
  repo-root-relative paths (the lab workflow and the findings ledger).
  `bun run beep knowledge semantic-delta` reports each as an introduced
  `broken-tracked-path`. The cheap tier that gates a push does not run that
  gate, hosted Heavy / Lint Policy passes without work on a docs-only diff, and
  `yeet final-check` reported it 20 minutes after the push, by which time the
  pull request had merged. A second local red in the same run, coverage on
  `PrivateHomePaths.ts`, was inherited from #3039 and fixed on `main` by
  #3048.
- **What would have prevented it:** running the knowledge semantic-delta gate
  in the cheap tier whenever the diff touches a packet, or the hosted
  docs-policy job that `explorations/ten-minute-certainty` decision D8 already
  plans (ROUT-02). Until then: after committing a new packet, run
  `bun run beep knowledge semantic-delta` before pushing.

## 2026-11-10 — the SPEC's synthetic branch prefix cannot exist beside the lab branch

- **Doing:** opening the first synthetic pull request (P1).
- **Evidence:** `git switch -c queue-lab/s1` failed with "cannot lock ref
  'refs/heads/queue-lab/s1': 'refs/heads/queue-lab' exists". A branch name is
  a file under `refs/heads/`, so `queue-lab` and `queue-lab/<x>` cannot both
  exist.
- **What would have prevented it:** a packet lint (or the explore graduation
  step) that checks planned branch names against planned base branches.
  Synthetic branches use `queue-lab-<slug>` (decision file of 2026-11-10).

## 2026-11-10 — the ghapp.sh merge-reservation guard refuses any GraphQL file input

- **Doing:** enqueueing a `queue-lab` pull request as the orchestrator App.
- **Evidence:** `ghapp.sh api graphql -F query=@<file>` exited with
  "merge-reservations: owner holds exist: GraphQL merge/ready or opaque input
  refused; use explicit PR route". The guard models `main` merges only; the
  pull request targeted `queue-lab`.
- **What would have prevented it:** the guard reading the target base of the
  pull request before refusing, or an explicit enqueue route. The lab mints the
  same App token through `gh-app-token.sh` (decision file of 2026-11-10).

## 2026-11-10 — workflow_dispatch probes need the workflow on the default branch

- **Doing:** observing whether an enqueue made with `GITHUB_TOKEN` starts a
  merge-group run (10c).
- **Evidence:** `gh workflow run queue-lab-enqueue.yml --ref queue-lab`
  returned "HTTP 404: workflow queue-lab-enqueue.yml not found on the default
  branch". The packet forbids workflow edits on `main`, so the probe moved into
  a job of the lab's `pull_request` run, enqueueing its own pull request.
- **What would have prevented it:** naming in the SPEC that a lab on a
  non-default branch cannot use `workflow_dispatch`, `issue_comment` or
  `schedule` triggers.

## 2026-11-10 — gh pull-request commands outside a checkout loop silently

- **Doing:** running a lab batch script from the session scratchpad.
- **Evidence:** `gh pr checks <n>` printed "failed to determine base repo:
  ... not a git repository" to stderr inside an `until ... grep` loop, which
  therefore never ended; ten minutes passed before the stall was noticed.
- **What would have prevented it:** `ops/queue-lab.sh` now exports `GH_REPO`
  for every `gh` call it makes; scripts that loop on `gh` output should fail
  on a non-zero `gh` exit instead of treating it as "not yet".
