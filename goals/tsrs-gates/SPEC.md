# Run the typecheck and build gates on the Effect-patched tsrs Spec

## Objective

Replace tsc-rs with the Effect-patched tsrs that @effect/tsgo 0.59.0 ships, so one compiler gates TypeScript errors and every Effect rule, and the standalone Effect Diagnostics lane can fold into Check.

## Non-Goals

- Retiring the standalone `Heavy / Effect Diagnostics` lane, folding
  `standards/effect-diagnostics.profile.json` into `tsconfig.base.json`, or
  flipping the three `ignoreEffect*InTscExitCode` flags: that is PR 2 of this
  packet, after the gate swap has hosted evidence.
- Moving editors, `beep quality test-tsgo`, `tsgo-smoke`, CheckCensus or the
  docgen example compile off the Go `@effect/tsgo` binary; `tsrs --lsp` is not
  qualified for editors.
- Enabling `--fast`; the tsc-rs CPU and memory measurement has not been
  repeated on tsrs.
- The `effect-tsgo tsrs` proxy as the script entry point: its Node start-up
  costs about 160 ms per invocation, so the generated scripts call the patched
  `tsrs` bin directly.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Root `package.json` (catalog `@effect/tsgo` 0.59.0 and `tsrs`
  0.20.0-ts7.1.0-beta replacing `tsc-rs`, the devDependency, `prepare --tsrs`,
  `check:configs`), `bun.lock`, `syncpack.config.ts` (both pins held together),
  `scripts/prune-tsgo-backups.mjs`.
- Every workspace manifest whose `beep:build`, `beep:check` or `beep:check:*`
  named `tsc-rs`, plus infra's `-b` build and the scratchpad manifest.
- `packages/tooling/tool/cli` scaffold defaults, the `TypeScriptChecker`
  literal domain, the typecheck-coverage and diagnostics-lane command parsers,
  the markdown-fences law compiler path, and their tests.
- `packages/tooling/policy-pack/repo-configs/test/EffectTsgoEffectFnPolicy.test.ts`.
- `standards/cache-qualification-baseline.json` (reviewed re-record),
  `standards/schema-catalog/@beep/repo-cli.generated.jsonc`.
- `docs/runbooks/typescript-toolchain.md`, `AGENTS.md` Touch row.

## Constraints

- `@effect/tsgo` and `tsrs` move together: `effect-tsgo patch --tsrs` only
  has an Effect build for the tsrs version the installed `@effect/tsgo` ships;
  both pins sit in syncpack's held-back group and the policy test pins the
  identity line.
- Generated manifests are never hand-edited beyond the compiler word:
  `bun run beep lint package-scripts` must report 0 drifting.
- Diagnostic parity is the gate: every project's diagnostics under the
  Effect-patched tsrs must equal tsc-rs 0.8.0's, and the three ignore flags stay
  true in this PR so Effect rules keep gating through the standalone lane.
- Effect v4 repo laws apply to every code change.

## Acceptance Criteria

- [x] P0: `research/measurements-2026-10-26.md` records identical diagnostics on
      every check project and infra's build under tsc-rs 0.8.0 and the Effect
      tsrs of `@effect/tsgo` 0.59.0, the floatingEffect canary, and that the
      eleven standalone-profile rules are known (zero TS377134).
- [x] P1: `tsrs` 0.20.0-ts7.1.0-beta and `@effect/tsgo` 0.59.0 pinned; `tsc-rs`
      removed; `prepare` patches tsrs; every `beep:build`, `beep:check`,
      `beep:check:*`, `check:configs` and infra `-b` script runs `tsrs`;
      `node_modules/.bin/tsrs --version` reports `+effect-tsgo.0.59.0`.
- [x] P1: `EffectTsgoEffectFnPolicy.test.ts` asserts the coupled pins and the
      tsrs identity line; the nine repo-cli compiler tests pass.
- [x] P1: the cache-qualification baseline is re-recorded through a reviewed
      request naming every drifted subject (`research/cache-baseline-*`).
- [ ] P2: local `turbo run check` green on tsrs; hosted `Heavy / Check` and
      `Heavy / Build` green on the swap PR, timings recorded against the
      tsc-rs baseline (2m15s turbo time, 2026-10-14).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Compiler identity | `node_modules/.bin/tsrs --version` | `Version 7.1.0-beta+effect-tsgo.0.59.0 (tsrs 0.20.0-ts7.1.0-beta, …)` |
| Policy test | `bunx vitest run test/EffectTsgoEffectFnPolicy.test.ts` in `packages/tooling/policy-pack/repo-configs` | Passes |
| Manifest policy | `bun run beep lint package-scripts` | 0 drifting |
| Cache policy | `bun run beep cache audit` | No blocking findings |
| Check graph | `turbo run check --continue` | All tasks pass |
| Packet launcher size | `test "$(wc -m < goals/tsrs-gates/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/tsrs-gates/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/tsrs-gates` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-26 | Replace `tsc-rs` (pingdotgg/ts-rust) with `tsrs` (oxc-project/tsrs) patched by `effect-tsgo patch --tsrs`. | Effect-TS/tsgo #901 (merged 2026-10-24) ports the whole language service to tsrs and `@effect/tsgo` 0.59.0 ships the build; one compiler then knows every Effect rule, which the 2026-10-14 decoupling ruling named as its reversal condition. Parity measured in `research/measurements-2026-10-26.md`. | Restore catalog `tsc-rs` 0.8.0, drop `tsrs`, remove `--tsrs` from `prepare`, sed `tsrs ` back to `tsc-rs ` in the manifests and scaffold defaults, restore the policy test, re-record the cache baseline. |
| 2026-10-26 | Patch the installed `tsrs` in `prepare` instead of routing scripts through the `effect-tsgo tsrs` proxy. | The proxy costs about 160 ms of Node start-up per invocation across 189 manifests; the patched bin keeps tsrs's 20 ms launcher and mirrors how the Go binary is already patched. | Switch the scaffold defaults and manifests to `effect-tsgo tsrs` and drop `--tsrs` from `prepare`. |
| 2026-10-26 | Couple the `tsrs` pin to `@effect/tsgo` in syncpack's held-back group. | `@effect/tsgo` ships one Effect tsrs build per release; an independent `deps:update` of `tsrs` would leave `prepare` without a matching build. | Remove `tsrs` from the group once `@effect/tsgo` ships builds for a version range. |
| 2026-10-26 | Keep `prepare` strict (no `--skip-missing`). | A missing Effect build must fail install loudly rather than leave a stock tsrs gating with no Effect rules; 0.59.0 ships no win32 or darwin-x64 tsrs build, so those hosts cannot install this repo until upstream adds them. | Add `--skip-missing` to `effect-tsgo patch --tsrs` and rely on the policy test to catch an unpatched gate in CI. |
| 2026-10-26 | Keep the standalone Effect Diagnostics lane and the three ignore flags in this PR. | The swap and the lane fold are separate risks; hosted evidence for the swap lands first. | None needed; PR 2 of this packet folds the lane. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
