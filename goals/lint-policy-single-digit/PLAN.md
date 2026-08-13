# Lint Policy Single Digit Plan

## Status

Status: `active` — P0 complete, P1 ready to execute.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Baseline & Packet Bootstrap | complete | Capture the hosted timing profile and lock the lever combination. | Baseline block in `ops/manifest.json`; five exploration reports under `research/`; grill decisions recorded as `keyDecisions`. |
| P1 Phase-1 CLI speedup PR | pending | Inner 4-way deprecated-apis shards + per-shard caches, LPT step ordering, empty-set step omission; outer concurrency stays 2. | SPEC P1 acceptance criteria met; PR yeeted to mergeable; hosted Lint Policy <= 9 min observed. |
| P2 Spike: oxlint-tsgolint behind gates | pending | Prove or refute the engine swap on a branch without touching main's gate. | Three gates measured (<=150s cold scan; parity corpus; shadow week via temp standalone workflow); verdict in `history/`. |
| P3 Cutover PR (conditional) | pending | Swap to one `oxlint --type-aware` invocation, raise outer concurrency to 4, delete shard runner + shadow workflow. | Only on all-gates-pass: hosted lane <= 5 min observed. On gate failure: flip to `superseded`, shards stay endgame. |
| P4 Close | pending | Flip lifecycle and record the closeout reflection in the same PR as the final work. | Reflection at `history/reflections/<date>-<agent>.md`; backlog levers (docgen move, scoping revisit) recorded as open. |

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
