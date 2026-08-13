# Lint Policy Single Digit Plan

## Status

Status: `completed-retained` — all phases resolved 2026-08-13 (P3 superseded by P2 NO-GO).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Baseline & Packet Bootstrap | complete | Capture the hosted timing profile and lock the lever combination. | Baseline block in `ops/manifest.json`; five exploration reports under `research/`; grill decisions recorded as `keyDecisions`. |
| P1 Phase-1 CLI speedup PR | complete | Inner 4-way deprecated-apis shards + per-shard caches, LPT step ordering, empty-set step omission; outer concurrency stays 2. | SHIPPED (PR #678): deprecated-apis 975s -> 435s; hosted Lint Policy 10m39s / 10m32s (jobs 94454948670, 94464070199) vs ~20 min baseline. The <= 9 min acceptance was MISSED — the lane became sum-bound at outer 2 — and was resolved by the closeout outer 2->3 unlock, not by this phase. |
| P2 Spike: oxlint-tsgolint behind gates | complete | Prove or refute the engine swap on a branch without touching main's gate. | NO-GO by early stop (`history/p2-spike-2026-08-13.md`): engagement, focused parity, and workstation timing (58.7s) passed, but program coverage FAILED (all 23 allowDefaultProject files unmatched) and existing-source parity FAILED (13 oxlint-only findings). The shadow-week workflow was intentionally never created; the hosted <=150s gate was never measured. |
| P3 Cutover PR (conditional) | superseded | Swap to one `oxlint --type-aware` invocation, raise outer concurrency to 4, delete shard runner + shadow workflow. | Only on all-gates-pass: hosted lane <= 5 min observed. On gate failure: flip to `superseded`, shards stay endgame. |
| P4 Close | complete | Flip lifecycle and record the closeout reflection in the same PR as the final work. | Reflection at `history/reflections/2026-08-13-claude.md`; backlog levers recorded. Hosted admission for the outer 2->3 raise OBSERVED on this PR: Lint Policy job 94503214889 SUCCESS, 9m24s wall, no OOM — single digits at full scope. |

## Execution notes

- P1 implementation sketches live in `research/02-inplace-optimization.md` §3 (shards,
  caches, tests) and `research/03-lane-orchestration.md` §3 (ordering). The empty-set fix
  design is `research/04-pr-scoping-deferred.md` §3 "Empty-set bug: confirmed fix" —
  only that fix is in P1 scope; the rest of research/04 is deferred.
- P2 gates and canary-fixture inventory: `research/01-engine-swap.md` §3–§5.
- Stop conditions in `ops/manifest.json` bind every phase; the check.yml stop condition
  has one exception: the P2 temporary standalone shadow workflow file.

## P4 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`;
   `bun run beep lint reflection-artifacts` must pass.
2. Flip `ops/manifest.json` lifecycle/status and land it in the same PR as the final
   work (same-PR packet-state flip law).
3. Record final hosted wall-time evidence (run ids) in the manifest or `history/`.
4. Confirm the backlog levers are written down where the next operator will find them:
   docgen ownership move and PR changed-scope revisit both point at this packet's
   `research/` designs.
