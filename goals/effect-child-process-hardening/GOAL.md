# GOAL: Harden Effect child-process ownership

Repo root: the current working directory. Do not assume an absolute path.

Outcome: every in-scope `effect/unstable/process` consumer explicitly owns
stdio, scope, exit semantics, timeout escalation, and platform provisioning,
with compatible repo CLI calls routed through `StepExec` / `GitExec`.

Read first:

- `goals/effect-child-process-hardening/README.md`
- `goals/effect-child-process-hardening/SPEC.md`
- `goals/effect-child-process-hardening/PLAN.md`
- `goals/effect-child-process-hardening/ops/manifest.json`
- `goals/effect-child-process-hardening/research/2026-07-29-inventory.md`

Then read root/package `AGENTS.md` files and the governing architecture docs.

Scope:

- In: current TypeScript consumers of `effect/unstable/process`, canonical repo
  CLI runners, affected platform layers, tests, changesets, and this packet.
- Out: native `Bun.spawn` / `node:child_process`, new dependencies, a new
  process facade/package, speculative export adoption, and unrelated cleanup.

Workflow:

1. Preserve unrelated worktree changes.
2. Ensure every opened output pipe is consumed concurrently or configured as
   `"ignore"` / `"inherit"`.
3. Use explicit stdin ownership by command mode.
4. Pair Tailscale/OpenClaw execution timeouts with a named two-second
   `forceKillAfter` grace.
5. Migrate compatible repo CLI calls to `StepExec` / `GitExec`; retain direct
   construction only in `StepExec` and Codex streamed stdin.
6. Remove the process-specific `@beep/utils/Stream` export and localize its
   three driver uses without a new shared abstraction.
7. Remove redundant spawner layers already supplied by aggregate platform
   layers.
8. Add deterministic tests plus one real large-output regression.
9. Update evidence/status without committing or publishing unless explicitly
   authorized.

Acceptance:

- [x] `SPEC.md` criteria and static scans pass.
- [x] Focused tests/checks pass; full docgen's unrelated failure is attributed.
- [x] `bun run beep yeet verify` passes or unrelated failures are attributed.
- [x] No unrelated refactors or formatting churn.

Stop before public API expansion, dependency changes, generated migrations,
auth/infra/security changes, destructive state, commit, or publication unless
explicitly authorized.
