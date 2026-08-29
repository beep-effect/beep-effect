# One-Round Loop Plan

Execution plan for [SPEC.md](./SPEC.md). Run phases in order — P0 gates
everything because the dogfood rule (SPEC §DoD.2) requires
`beep ci local` to exist before any other packet PR ships. Track
resumable state in [ops/progress.json](./ops/progress.json).

## Status

Status: `docs-closeout-complete` — P0 started 2026-07-07. Packet-authoring PR
[#319](https://github.com/beep-effect/beep-effect/pull/319) green in one
CI round. P0 ships as two PRs: PR A (lane CLI `beep ci lane`/`beep ci
local` + temporary D9 shadow workflow, check.yml untouched) proves
same-SHA parity; PR B (check.yml thinning, orl-003) lands only after
the recorded proof in `history/p0-parity-evidence.md`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 CI-lane inversion | complete | The beep CLI owns every CI lane; local replay is faithful. | Shipped evidence: `history/p0-parity-evidence.md`. |
| P1 Property-law lane | complete | Seed-dependent law failures die on the PR that introduces them. | Shipped evidence: `history/p1-property-lane-evidence.md`; the lane remains non-required. |
| P2 Medium tier | wont_fix | Coverage baseline v2, cwd-independence, regen-generated, and `withNormalizedCheck`. | Recorded deferrals in `ops/progress.json`; reconsider only when median PR CI round-trips exceed one. |
| P3 Stretch | wont_fix | Long-tail CI and agent-lane improvements. | Every item has a recorded `wont_fix` rationale in `ops/progress.json` under the same trigger. |
| P4 Close | complete | Close the retained P0/P1 deliverable on the docs side. | `history/p4-closeout.md` points to shipped matrix evidence; reflection recorded; required-check non-flip recorded as deferred. |

## Dogfood rule (D4/D8 — no bootstrap exemption)

Every packet PR — including P0's own — runs `bun run beep ci local`
built from that PR's branch, green before push; docs-only /
packet-file-only PRs may use `--fast --affected`. A packet PR needing
>1 CI round is a FAILED dogfood proof: root-cause note in `history/`
AND demonstrated local catch of the exposed class before close.

## Execution notes (carried from the crispening)

- Ship small per-phase PRs via `bun run beep yeet publish --pr` +
  `monitor`; sweep ALL review comments + failing jobs before each push.
- One writer per file-set per wave; codex lanes for the mechanical
  sweeps (the numRuns codemod), concurrency ≤ 4.
- Never run manual turbo/docgen/vitest while a background yeet verify is
  in flight; `bun install` after any bun.lock-changing merge.
- Ledger flows: run the `--write` mode of a gate to author entries, then
  flip status to exception with a reason — never hand-author entry keys.
- The P0 parity proof follows D9: a temporary workflow_dispatch shadow
  workflow on the same head SHA as the unmodified check.yml run, run
  IDs recorded, BEFORE the thinning commit lands.

## Verification Commands

```sh
test "$(wc -m < goals/one-round-loop/GOAL.md)" -le 4000
jq . goals/one-round-loop/ops/manifest.json
git diff --check -- goals/one-round-loop

# Phase gate — run at the close of every phase
bun run beep ci local        # once P0 lands
bun run beep yeet verify
```
