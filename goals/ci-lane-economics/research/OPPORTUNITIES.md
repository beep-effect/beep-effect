# ci-lane-economics — friction and opportunity ledger

Record receipts at the moment friction happens (what you were doing, the
evidence, what would have prevented it). Redact for the public repo.

## Seed context (2026-08-13, from the split)

- Pre-cache hosted p50s: Lint ~43.6m, Test Unit ~23m, Property Laws ~22.4m.
- The ~9-minute type-graph import inside vitest re-pays per heavy-import
  suite; caching cannot fix it — per-slice sharding is the lever.
- Fleet Docgen/Lint hangs from the runMain success-exit class are FIXED
  (#673); do not let historical hang data pollute the census.

## 2026-08-13 — the lane-timings collector stops before the census boundary

- **Doing:** building the P0 cache-warm census from the Check workflow after
  the #673/#674 rollout boundary.
- **Evidence:** `bun run beep ci lane-timings --help` can select only the most
  recent 1-100 runs. It cannot select a workflow, event, time/SHA boundary, or
  required contexts, and its rows omit run event/SHA plus Turbo task hit counts.
  The census therefore required separate Actions run/job/log API joins; one
  unquoted `?filter=all` endpoint also triggered zsh glob expansion before the
  call reached `gh`.
- **Would have prevented it:** make `ci lane-timings` accept workflow,
  since/until, event, and job-name filters; carry run metadata into every row;
  and parse the final Turbo `Cached: X cached, Y total` line for lanes declared
  `uses_turbo: "true"`. The collector should emit the percentile and flake
  populations separately so later packets do not rebuild this join ad hoc.

## 2026-08-13 — required-context metadata drifted from the live ruleset

- **Doing:** reconciling the P0 lane table with the repo-local CI lane registry.
- **Evidence:** live ruleset `10240248` returns 16 required contexts and omits
  `JSDoc Ratchet`, while `CiLane.ts` marked that visible lane `required: true`
  and its test described a frozen 17-context set.
- **Would have prevented it:** generate or periodically verify the descriptor's
  `required` flags against the live ruleset, with an explicit offline snapshot
  and provenance date rather than hand-maintained metadata.

## 2026-08-13 — raw phase edits accept invalid status tokens until schema proof

- **Doing:** advancing the packet from P1 into P2 after signing the placement
  decision.
- **Evidence:** `jq` accepted `"in_progress"`, but the canonical
  `GoalPhaseStatus` is `"in-progress"`. The mistake surfaced as two failures
  only after the five-minute repo-CLI test lane reached the tracked-manifest
  census.
- **Would have prevented it:** a schema-aware goal phase-transition command, or
  running `bun run beep goals doctor` immediately after every raw manifest
  status edit and before any broad test lane.
