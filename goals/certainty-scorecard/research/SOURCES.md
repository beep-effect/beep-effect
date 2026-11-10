# Certainty Scorecard — Sources & Provenance

- **Source exploration:** `explorations/ten-minute-certainty` — primary ledger:
  [`explorations/ten-minute-certainty/research/SOURCES.md`](../../../explorations/ten-minute-certainty/research/SOURCES.md).
  Rows below are the subset this goal uses; the exploration ledger stays authoritative. Every source is this
  repository, its hosted CI or its local receipts.

## 1. Mined source corpus

Lever rows from the ranked plan
([`explorations/ten-minute-certainty/research/phase2/PLAN.md`](../../../explorations/ten-minute-certainty/research/phase2/PLAN.md)) and the merged
area records under `explorations/ten-minute-certainty/research/phase2/merged/`. Status is from this packet's
check at 6eb2e0588e2, re-checked at c90929b1ff1.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| MEAS-01 | Nightly push-to-every-required-green scorecard per head SHA, with main verdict cohorts | this repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md` row 1; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md` | scorecard | adopt (open) |
| MEAS-04 | lane-timings per-attempt job reads, partial-row stamping, filtered recent mode | this repo | PLAN row 2; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md`; `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts:1059` | hosted reads | adopt (open) |
| MEAS-02 | Attribute lock-bounce, stale-base and closeout refusals (merges DEPS-10) | this repo | PLAN row 3; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md`; `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts:1154` | local attribution | adopt (open) |
| PERIL-11 | Journals outside the reaped residue root; T3 via `roots.json` (merges MEAS-09) | this repo | PLAN row 4; `explorations/ten-minute-certainty/research/phase2/merged/peripheral-local.md`; `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts:1776` | fleet economics | adopt (open) |
| ROUT-05 | Route corpus partition mapping, step classes, per-lane outcomes (merges ROUT-06) | this repo | PLAN row 5; `explorations/ten-minute-certainty/research/phase2/merged/routing.md`; `packages/tooling/tool/cli/src/commands/Ci/RouteCensus.ts:168` | route corpus | adopt (open) |
| MEAS-06 | Project unit-results.json into per-file and per-package timing | this repo | PLAN row 8; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md`; `.github/workflows/check.yml:924` (failure-only upload) | test timing | adopt (open) |
| MEAS-07 | Journal final-check invocations | this repo | PLAN row 9; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md`; `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` | local attribution | adopt (open) |
| MEAS-05 | Joined per-check cost ledger at (lane, partition) grain | this repo | PLAN row 10; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md` | cost ledger | adopt (open) |
| SCHE-09 | Admission history beyond the 200-row ring, with pressure fields | this repo | PLAN row 12; `explorations/ten-minute-certainty/research/phase2/merged/scheduler.md`; `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:59` | scheduler evidence | adopt (open; owned here per D23, decision `sche-09-ownership`) |
| MEAS-03 | Separate terminations and type unlocated failures | this repo | PLAN row 17; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md`; `Economics.ts:1013`, `Economics.ts:1399` | local attribution | adopt (partly landed: terminations census exists) |
| MEAS-08 | Time-join PSI samples onto attempts | this repo | PLAN row 18; `explorations/ten-minute-certainty/research/phase2/merged/measurement.md` | pressure context | adopt (open) |
| Critique | Dependency order, numbers without a primary source, missing from the plan | this repo | PLAN "Cross-area critique" | constraints | adopt |

The MEAS-01 gate's recorded corpora (the Opus head corpus and the Astra 60-run corpus) are named in
`explorations/ten-minute-certainty/research/phase2/merged/measurement.md` but are not tracked in the repository; slice 1 commits its own fixture corpus
(decision `in-repo-fixture-corpus`).

## 2. Upstream repositories & licenses

None. No lever takes code or a pattern from an external repository.

## 3. External research sources

None. The exploration ledger lists no external source for these levers.

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Hosted job and step reads | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | extend: per-attempt reads, partial stamping, recent filters |
| Required contexts | `standards/branch-protection-contexts.json` (15 contexts, ruleset 10240248), `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts` | reuse |
| REST client | `packages/tooling/tool/cli/src/internal/github/GithubRest.ts` | reuse: check runs per SHA |
| Command registration | `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts` | extend: the certainty subcommand |
| Route census and corpus | `packages/tooling/tool/cli/src/commands/Ci/RouteCensus.ts`, `packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts` | extend: partition mapping, outcome fields |
| Lane descriptors | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` (`contextName`, line 477) | reuse; MEAS-05 consolidates the lane-id maps |
| Local economics | `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts` | extend: refusal classes, terminations, seat and host |
| Final-check | `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` | extend: journal attempts |
| Residue reap | `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts` | extend: export journals before retire deletes them |
| Fleet roots | `packages/tooling/tool/cli/src/commands/Worktree/internal/FleetRoots.ts`, `docs/runbooks/fleet-roots-and-registry.md` | reuse: one T3 row |
| Admission journal | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` | extend: archive trimmed rows |
| Nightly workflow pattern | `.github/workflows/knowledge-baseline-mint.yml` | reuse: schedule, single-flight concurrency, read-only permissions |
| Rate-limit read (#3032) | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorRateLimit.ts` | reuse until `github-budget-ledger` publishes the reserve signal |
| Gate-order fixtures | `packages/tooling/tool/cli/test/gate-order-handoff.test.ts`, `goals/time-to-certainty/research/gate-order-handoff.json` | keep green; frozen (D13) |

## 5. Cross-links & provenance

- Source exploration: [`explorations/ten-minute-certainty`](../../../explorations/ten-minute-certainty/README.md) —
  [`BRIEF.md`](../../../explorations/ten-minute-certainty/BRIEF.md),
  [`MAP.md`](../../../explorations/ten-minute-certainty/MAP.md) (goal 1, capability check, gated candidates),
  [`DECISIONS.md`](../../../explorations/ten-minute-certainty/DECISIONS.md) (D2, D5, D6, D16, D18, D19, D23, D27, D28).
- Sibling goals that read this goal's numbers: `route-soundness-repair`, `main-verdict-every-commit`,
  `heavy-pool-diet`, `hosted-setup-tax`, `local-proof-under-ten`.
- Related goals: [`github-budget-ledger`](../../github-budget-ledger/README.md) (reserve signal),
  [`ci-lane-economics`](../../ci-lane-economics/README.md) (census shard layouts),
  [`verification-route`](../../verification-route/README.md) (route corpus v1, completed),
  [`time-to-certainty`](../../time-to-certainty/README.md) (paused; seams move to `local-proof-under-ten`).
- Shipped context since the plan: #3007, #3028, #3029 (20 integration partitions: 19 lps-int shards plus int-rest), #3030 (Test Plan job,
  Property Laws slices), #3032 (monitor rate-limit sleep), #3040 and #3043 (24 Test Unit jobs; the 17 repo-cli and law-practice shards on two workers, the seven unit bins on one),
  #3046 (test shards first, 20-minute shard timeouts), #3047 (`explorations/github-merge-queue`, D28).
