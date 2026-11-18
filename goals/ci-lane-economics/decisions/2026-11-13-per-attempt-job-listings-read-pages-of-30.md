---
title: "Per-attempt job listings read pages of 30 and retry"
date: 2026-11-13
lane: "fix/ci-labs-attempt-listing-502"
reversal: "Revert this PR; the listing goes back to pages of 100 and a rerun attempt of a large run fails Coverage Regression again"
---

GitHub answers 502 to `GET /actions/runs/<id>/attempts/<n>/jobs?per_page=100` for a rerun attempt (n of 2 or more) of a large Check run, every time. Reproduced on run 43518469137 on 2026-11-13: attempt 1 at 100 per page returns 200, attempts 2 to 4 return 502, and the same attempts at 50 or 30 per page return 200 with all 82 jobs. So every rerun of a Heavy run failed Coverage Regression in "Authenticate latest Labs execution" (four in a row on #3291), and only a new push could pass.

The step now lists each attempt at 30 jobs per page and retries a failed listing up to four times, waiting 10, 20 and 30 seconds. `beep ci rerun-runner-loss` read the same endpoint at 100 per page and now reads 30; the census already fell back to 30.

Not lane-affecting for window 5: one step's request size inside the Coverage Regression job. No job name, needs, runner, job-level if or reporting context changes. Reds from this episode (Coverage Regression on attempt 2 or later with HTTP 502 in that step) are inherited, not the pull request's own.
