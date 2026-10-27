# Run the typecheck and build gates on the Effect-patched tsrs Spec

## Objective

Replace tsc-rs with the Effect-patched tsrs that @effect/tsgo 0.59.0 ships, so one compiler gates TypeScript errors and every Effect rule, and the standalone Effect Diagnostics lane can fold into Check.

## Non-Goals

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
- [x] P2: local `turbo run check` green on tsrs (337/337, 1m07s); hosted
      `Heavy / Check` 3m36s and `Heavy / Build` 2m23s green on the swap PR
      (#2260, head a36dfffa74).
- [ ] PR 2: the eleven profile rules live in `tsconfig.base.json` and every
      copied compiler profile; the three `ignoreEffect*InTscExitCode` flags are
      false everywhere; `standards/effect-diagnostics.profile.json`, the
      `quality effect-diagnostics` command, the `effect-diagnostics` CI lane, the
      final-check gate and the `Heavy / Effect Diagnostics` matrix job are gone;
      the policy test proves an Effect-only finding fails `tsrs`; the full check
      graph is green with the rules gating; the ruleset no longer requires the
      retired context when PR 2 merges.
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
| 2026-10-26 | Keep the standalone Effect Diagnostics lane and the three ignore flags in PR 1. | The swap and the lane fold are separate risks; hosted evidence for the swap lands first. | None needed; PR 2 of this packet folds the lane. |
| 2026-10-27 | PR 2: fold the eleven profile rules into `tsconfig.base.json` and the copied profiles, set the three `ignoreEffect*InTscExitCode` flags to false, delete the profile, the `quality effect-diagnostics` command, the CI lane, the final-check gate and the hosted matrix job. | The Effect-patched tsrs knows every rule, so `Heavy / Check` gates them in about four minutes where the standalone lane needed 20 to 25 minutes on an 8-vCPU runner under a 19 GiB cgroup; the full check graph passed 336/337 locally with the rules gating (the one red was PR 2's own in-progress test file). This is the reversal the 2026-10-14 decoupling ruling named. | Restore the profile and its loader from PR 1's head, set the flags back to true, re-add the matrix entry, the CI lane, the gate and the command from git history. |
| 2026-10-27 | Remove `Heavy / Effect Diagnostics` from ruleset 10240248's required contexts when PR 2 merges, not before. | A required context with no job would hold every later PR; removing it early would let PRs merge without the lane while it still exists. | Re-add the context to the ruleset with `gh api`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
