# Run the typecheck and build gates on tsc-rs Spec

## Objective

Move beep-effect's typecheck and build gates from the Effect-patched tsgo to tsc-rs (pingdotgg/ts-rust), keeping @effect/tsgo for editors; measured 3.7x faster at half the peak RSS with identical diagnostics on 2026-10-13.

## Non-Goals

- Removing `@effect/tsgo` or the `tsgo` shim: editors, `beep quality tsgo-rules`,
  CheckCensus, the docgen example compile and `test-tsgo-package` stay on it.
- Enabling `--fast` in hosted CI (measured +35% CPU and +4.7 GB peak on the
  test projects; a follow-up measured on the 8 vCPU runner).
- Pointing the WebStorm Effect plugin at `tsc-rs --lsp` (untested).
- The TypeScript 6 catalog exit (the parent exit plan's lanes A–F).

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

- `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts`
  (generated `beep:build`, `beep:check`, `beep:check:tests` defaults) and every
  workspace manifest it regenerates.
- Root `package.json` (catalog `tsc-rs`, `check:configs`), `syncpack.config.ts`
  held-back group, `bun.lock`.
- `packages/tooling/policy-pack/repo-configs/test/EffectTsgoEffectFnPolicy.test.ts`,
  `packages/tooling/tool/cli/test/single-project-emit.test.ts`.
- `docs/runbooks/typescript-toolchain.md`.
- P0 only: the eleven upstream TypeScript 7.1 diagnostic sites listed in
  `research/measurements-2026-10-13.md`.

## Constraints

- `@effect/tsgo` stays on the effect-tsgo version tsc-rs ports (0.51.1 for
  tsc-rs 0.6.0); the two move together (t3code's rule).
- Generated manifests are never hand-edited: change the defaults, then
  `bun run beep lint package-scripts --write`.
- Diagnostic parity is the gate: every project's diagnostics under tsc-rs must
  equal tsgo's except for documented upstream 7.1 behaviour.
- Effect v4 repo laws apply to every code change.

## Acceptance Criteria

- [x] P0: the eleven upstream 7.1 sites typecheck clean under stock
      `typescript@7.1.0-dev.20261008.1`, tsc-rs 0.6.0 and tsgo 0.51.1.
- [x] P1: `tsc-rs` 0.6.0 pinned in the catalog; generated `beep:check`,
      `beep:check:tests` and `beep:build` run `tsc-rs`; `bun run check` and
      `bun run build` green; the tsgo shim and `@effect/tsgo` untouched.
- [x] P1: `EffectTsgoEffectFnPolicy.test.ts` asserts the new version shapes.
- [x] P2: hosted cache-cold `Heavy / Check` and `Heavy / Build` times recorded
      against the 2026-10-13 baseline (7m39s turbo time, 268 tasks).
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/tsc-rs-gates/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/tsc-rs-gates/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/tsc-rs-gates` | Passes |

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
| 2026-10-13 | Adopt tsc-rs for the typecheck and build gates; keep `@effect/tsgo` for editors and the Effect-rule tools. | Measured 3.7× geomean faster at half the peak RSS with identical diagnostics (`research/measurements-2026-10-13.md`); t3code runs the same split. | Revert the generated script defaults to `tsgo -p` / `tsc -p` and regenerate manifests. |
| 2026-10-13 | Land the eleven upstream 7.1 diagnostic fixes as their own PR before the swap. | They are green under both compilers, so the swap PR carries no code changes. | Revert the annotations. |
| 2026-10-13 | Keep `--fast` off in generated scripts and CI. | Local: −7% wall but +35% CPU and +4.7 GB peak on test projects; it spawns up to 16 checkers per process, a poor fit for the 8 vCPU runner. | Add `--fast` to the `-p` invocations only, never before `-b`. |
| 2026-10-13 | Hold `@effect/tsgo` at the version tsc-rs ports; bump both together. | tsc-rs compiles the Effect rules in; mismatched versions disagree on rule names. 0.52 waits for ts-rust to port it. | Drop the coupling note from `syncpack.config.ts` and bump independently. |
| 2026-10-14 | Record this packet instead of reopening `lint-policy-single-digit`. | That packet is completed-retained and covers the ESLint lane, not the compiler. | Delete the packet directory. |
| 2026-10-14 | Do not add `tsc-rs` to bun `trustedDependencies`; run Go's JS launcher bin. | The postinstall only rewrites the bin into a sh/JS polyglot to save about 22 ms of Node start per run; trusting an install script is not worth that. | Add `tsc-rs` to `trustedDependencies` in the root manifest and reinstall. |
| 2026-10-14 | Rewrite the existing manifests' `beep:build`, `beep:check`, `beep:check:tests` (and `beep:check:scripts`, `beep:check:stories`, `beep:check:examples`, scratchpad `check:effect-ontology`) from `tsgo -p` / `tsc -p` to `tsc-rs -p`, and infra's `tsgo -b` to `tsc-rs -b`, in the same change as the scaffold defaults. | `beep lint package-scripts --write` only scaffolds impl defaults for new packages; existing impl scripts are package-owned, so a defaults-only change would leave 150 manifests on tsgo. | Reverse the substitution (`tsc-rs -p tsconfig.json` → `tsc -p tsconfig.json`, other `tsc-rs -p` → `tsgo -p`, `tsc-rs -b` → `tsgo -b`). |
| 2026-10-14 | Keep `beep quality test-tsgo`, `tsgo-smoke`, `tsgo-rules`, docgen's example compile and the editors on the Effect compiler. | They are the Effect-rule proof and the editor surface; the gate swap is about the per-package typecheck and build lanes. | Point those lanes at `tsc-rs` once it is the only compiler. |
| 2026-10-14 | Name the project files for knip's TypeScript plugin (`typescript.config` on `packages/**` and the root) and ignore `@beep/tsgo-shim` at the root. | The plugin only follows `-p` behind the `tsc` and `tsgo` binaries; behind `tsc-rs` it stopped reading `tsconfig.test.json`, reporting `bun-types` unused in 87 packages, and no root script names the `tsgo` bin any more although the quality lanes spawn it. | Drop the `typescript` blocks and the ignore entry if knip learns the `tsc-rs` binary. |
| 2026-10-14 | Re-record the cache qualification baseline for all 153 subjects (`research/cache-baseline-review-2026-10-14.md`, `-request-2026-10-14.json`). | The baseline records each subject's task commands, so the compiler word change touched every subject, and three subjects' review basis is their own manifest bytes. No qualification granted or widened. | A later reviewed request supersedes it. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
