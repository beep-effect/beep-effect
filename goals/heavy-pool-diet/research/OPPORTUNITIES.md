# Heavy-pool diet: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: the readiness monitor cannot read the check census

- **Doing:** driving #3301 to ready with `bun run beep yeet monitor --until-ready`.
- **Evidence:** the monitor failed three times with "Failed to read the
  complete pull request check census", while direct REST reads of the same
  PR's check runs worked and the GitHub rate limit had headroom. Worked
  around by acknowledging the inbox rows as observed and following the
  checks through REST.
- **Would have prevented it:** the monitor naming the read that failed and
  retrying it, or accepting a census it can complete through REST.

## 2026-11-13: local final-check under sibling load

- **Doing:** `bun run beep yeet final-check` for #3301 while three sibling
  lanes ran on the same 12-core worker.
- **Evidence:** cheap-gates ran for over 21 minutes at a load average near 30
  and was stopped. The receipt passed with 8 recorded skips (cheap-gates,
  lint, repo-sanity, fallow, coverage, lint-policy, check, docgen) that the
  hosted run on the same head covered.
- **Would have prevented it:** final-check reading the head's green hosted
  gates as evidence instead of replaying them when local compute is
  constrained.

## 2026-11-13: the secret-route doctor fails without a failing line

- **Doing:** a `gh` read from the orchestrating session (about 23:40Z).
- **Evidence:** "GitHub credential delivery failed; no credential was
  printed". `op-doctor` printed three PASS lines and then "FAIL diagnostic
  completed" with no failing check named. A fresh `gh` read worked a few
  minutes later.
- **Would have prevented it:** `op-doctor` naming the check that failed, so a
  transient delivery failure can be told from a broken route.

## 2026-11-14: full package verify of repo-cli exceeds a 10 GiB cap

- **Doing:** `bun run beep quality package-verify @beep/repo-cli` (not
  `--quick`) on the slice 8 branch, under
  `systemd-run --user --scope -p MemoryMax=10G` on the 31 GiB worker.
- **Evidence:** the scope ended after 8 min 18 s with result `oom-kill` at a
  10 GiB memory peak and 1 h 12 min of CPU time; the command printed only
  "script \"beep\" exited with code 130". The `--quick` subset (lint and
  check) passes in about 65 s on the same head.
- **Would have prevented it:** package-verify bounding its own fan-out by
  available memory, or naming the step that was running when it was killed.

## 2026-11-14: the pin-bump PR restarts on every release

- **Doing:** watching #3326, the first pin-bump PR that #3299's automation
  opened.
- **Evidence:** opened at 05:34Z for `beep-ci-ae70a0c0a3f8`; force-updated
  and retitled at 05:38Z for `beep-ci-00e2e35dbaee`, which restarted its
  Check and review window. `gh release list` counts 21 `beep-ci-*` releases
  on 2026-11-13 and 27 on 2026-11-09, so at that cadence the PR restarts
  about hourly, each restart is a heavy-admitted Check run, and every merge
  is an operator hand merge of a `.github` edit.
- **Would have prevented it:** a rule for when a pending bump is replaced
  (for example only once the open pull request's Check has finished), decided
  before the automation went live.

## 2026-11-14: a pull request labelled at creation runs its heavy lanes twice

- **Doing:** reading the bot's second pin-bump pull request, #3334, after it merged.
- **Evidence:** on head `53642ee055` the five heavy lanes ran in both `Check` run 43577694802 and
  `Heavy Admit` run 43577695303, created in the same second: ten heavy jobs for one head, on a day
  when heavy lanes waited 20 to 60 minutes for a runner. The App labels the pull request
  `ready-for-heavy` two seconds after opening it. Heads labelled later (`yeet open`) ran the lanes
  once. Tables: `history/2026-11-14-perih-11-slice-2-after-the-bump.md`.
- **Would have prevented it:** one of the two admission paths standing down when the other has
  admitted the same head.
