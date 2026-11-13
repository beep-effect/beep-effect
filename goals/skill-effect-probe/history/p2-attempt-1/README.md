# P2 attempt 1, 2026-11-12: void

Launched under the 2026-11-12 rule and scorer profile v1, before the packet
author's design review arrived. Cells B and C ran first (120 runs requested),
then cell A (60 runs).

| Invocation | Runs | Completed | Ended on the plan limit | Harness cost USD |
| --- | ---: | ---: | ---: | ---: |
| `laws-1` (B, C) | 120 | 2 | 118 | 0.71 |
| `bare-1` (A) | 60 | 0 | 60 | 0.00 |

The 178 failed runs carry the harness error "You've hit your weekly limit"
with the seven-day window reset on 2026-11-15, 23:00 America/Chicago; their
traces end on a `rate_limit_event` with status `rejected`. Under the
exclusion rule they are never scored.

The attempt is void. The two completed runs were not scored and are not
evidence: the rule was amended (scorer drift repairs, the Insensitive
outcome, the run configuration) before any scored run record, and scoring
them would show a C minus B contrast before the pilot. No record from this
attempt is committed, and it is outside the 216-attempt cap.
