# Stage 5 acceptance evidence

## Storage

Source wave: `4decfe96d35fdd2802db7d7567449af2408da99b`, followed by independent
review corrections. Commands run through `beep-heavy` with the assigned 24 GiB
caller budget and the operator-installed admission memory floor. The first
package-relative retention suite ran 39 tests: 36 passed and three fixture
errors were corrected. The expanded suite and package rerun remain queued;
no final passing crash-recovery result is claimed yet.

The fleet v3 dry census is published in
[storage cleanup](./stage-5-storage-cleanup.md). Actual fleet cleanup is deferred:
no owner-verified eligible rows, no orchestrator apply acknowledgement, and
live clone owner notices remain required. Applied rows: zero. Reclaimed
apparent/exclusive filesystem bytes: zero/zero. Archive moves in synthetic
fixtures, when verified, demonstrate recovery and preserve payload; they do
not establish physical reclamation from real checkouts.

Research, corpus and runtime material remains owner-ruling-required. Existing
archive reports remain durable proof until a separate owner retention ruling.
