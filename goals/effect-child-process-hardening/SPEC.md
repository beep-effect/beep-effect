# Effect Child-Process Hardening Spec

## Objective

All in-scope `effect/unstable/process` consumers must explicitly own opened
stdio, process scope, exit semantics, and timeout cleanup. Compatible repo CLI
commands must route through the existing internal `StepExec` / `GitExec`
boundary, and aggregate platform layers must not be paired with redundant
child-process layers.

## Non-Goals

- Migrating native `Bun.spawn`, `Bun.spawnSync`, or `node:child_process` usage.
- Creating a new shared process driver, public facade, or speculative wrapper.
- Adopting unused upstream exports without a current caller requirement.
- Changing command argv, shell policy, wire formats, or redaction behavior.
- Publishing, committing, or opening a pull request without separate
  authorization.

## Source Hierarchy

1. User objective and the approved 2026-07-29 implementation plan.
2. `AGENTS.md`, package-local `AGENTS.md`, and required skills.
3. `standards/ARCHITECTURE.md` and `standards/architecture/*`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Current TypeScript consumers of `effect/unstable/process` under `apps/` and
  `packages/`.
- `packages/tooling/tool/cli/src/internal/process/StepExec.ts` and
  `internal/repo-run/GitExec.ts`.
- Aggregate platform composition roots and affected test layers.
- `packages/foundation/modeling/utils/src/Stream.ts`.
- Focused tests, changesets, and this goal packet.

## Locked Decisions

- Keep argv-array command construction; do not add production `shell: true`.
- Every output pipe is consumed concurrently or replaced with `"ignore"` /
  `"inherit"`.
- Capture helpers default stdin to `"ignore"`; exit-only helpers default stdin
  to their inherit/ignore stdio mode. Protocol and streamed-input callers opt in
  explicitly.
- Timeout-bounded Tailscale and OpenClaw commands use a named two-second
  `forceKillAfter` grace.
- Delete `collectProcessOutput` from private `@beep/utils/Stream` after
  localizing its small concurrent fold in the three driver consumers.
- Direct `ChildProcess.make` under repo CLI source remains only in `StepExec`
  and the Codex streamed-stdin command.
- `ChildProcessSpawner.string` / `lines` are not adopted because affected
  callers also need explicit exit status and, often, separated stderr.
- Pipelines, custom file descriptors, prefixing, manual kill, `unref`, and
  `isRunning` remain unused until a real caller requires them.

## Acceptance Criteria

- [x] The complete pre-change inventory and upstream reference are tracked.
- [x] No configured output pipe is left unconsumed in an in-scope caller.
- [x] Timeout-bounded Tailscale and OpenClaw commands escalate after two
      seconds when graceful termination does not finish.
- [x] Repo CLI direct command construction is limited to `StepExec` and Codex.
- [x] Git branch resolution fails on a nonzero Git exit.
- [x] `@beep/utils/Stream` no longer exposes a child-process-specific helper.
- [x] Aggregate platform layers are not paired with redundant spawner layers.
- [x] Focused mock tests plus one live large-output process test pass.
- [x] Required package checks, docgen, goal validation, and repo verification
      pass or unrelated failures are attributed with evidence.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-child-process-hardening/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-child-process-hardening/ops/manifest.json` | Passes |
| CLI boundary | `rg -n "ChildProcess\\.make" packages/tooling/tool/cli/src --glob '*.ts'` | Only `StepExec.ts` and `Codex.command.ts` |
| Removed utility | `rg -n "collectProcessOutput" packages/foundation/modeling/utils` | No matches |
| Focused tests | Affected package Vitest suites | Pass |
| Local docs | `bun run docgen:local` | Pass |
| Repo proof | `bun run beep yeet verify` | Pass or attributable unrelated failure |

## Stop Conditions

- An affected file overlaps unrelated in-flight user edits.
- A command requires stdio or exit semantics not representable by existing
  `StepExec` / `GitExec` helpers without a public API expansion.
- Verification requires credentials, cost, destructive state, or publication.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Streamed stdin | Repo CLI Codex command | `@beep/repo-cli` | `StepExec` intentionally models stdio modes, not arbitrary stdin streams. | Add only if a second real streamed-input CLI caller appears. |
| Driver-local output folds | AI provider CLI, 1Password CLI, OpenClaw | Respective driver packages | Their result/error models are package-owned, and the approved design forbids a new shared process facade. | Reconsider if a stable existing package boundary gains another compatible caller. |
