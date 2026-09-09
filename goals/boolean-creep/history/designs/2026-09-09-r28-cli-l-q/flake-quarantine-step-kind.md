# Instance

- id: `flake-quarantine-step-kind`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:383`
- symbol: `serialTurboRerunArgs.stepKind`
- members: `isDirectTurboRun`, `isNestedCiLane`
- evidence class: E2 at
  `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:406`
  — rerun argument construction dispatches nested CI first, then distinguishes
  direct Turbo from ordinary scripts. Because the classifiers require `bun`
  and `bunx` respectively, a combined-true state is impossible and unhandled.

# Current shape

The live classifiers and reader are:

```ts
const isDirectTurboRun = (step: QualityTaskStep): boolean =>
  step.command === "bunx" &&
  A.get(step.args, 0).pipe(O.contains("turbo")) &&
  A.get(step.args, 1).pipe(O.contains("run"));

const isNestedCiLane = (step: QualityTaskStep): boolean =>
  step.command === "bun" &&
  A.get(step.args, 0).pipe(O.contains("run")) &&
  A.get(step.args, 1).pipe(O.contains("beep")) &&
  A.get(step.args, 2).pipe(O.contains("ci")) &&
  A.get(step.args, 3).pipe(O.contains("lane"));

const serialTurboRerunArgs = (step: QualityTaskStep, trailingOptions: ReadonlyArray<string>): ReadonlyArray<string> => {
  const args = withoutTurboConcurrencyArgs(step.args);
  if (isNestedCiLane(step)) {
    return [...args, ...trailingOptions];
  }
  const options = [SERIAL_TURBO_CONCURRENCY_ARG, ...trailingOptions];
  return isDirectTurboRun(step) || A.contains(args, "--") ? [...args, ...options] : [...args, "--", ...options];
};
```

# Cardinality gap

Two predicates represent four combinations, but three step kinds are legal:
`direct-turbo`, `nested-ci-lane`, and `ordinary`. The combined-true case cannot
occur because one classifier requires `step.command === "bunx"` and the other
requires `step.command === "bun"`.

# Target schema

Add one file-local named `LiteralKit` and derive it directly from the existing
`QualityTaskStep`. Do not store a replacement state alongside the step.

```ts
const FlakeQuarantineStepKind = LiteralKit(["direct-turbo", "nested-ci-lane", "ordinary"])
type FlakeQuarantineStepKind = typeof FlakeQuarantineStepKind.Type

const flakeQuarantineStepKind = (step: QualityTaskStep): FlakeQuarantineStepKind =>
  Match.value(step).pipe(
    Match.when(
      ({ command, args }) =>
        command === "bunx" &&
        A.get(args, 0).pipe(O.contains("turbo")) &&
        A.get(args, 1).pipe(O.contains("run")),
      () => FlakeQuarantineStepKind.Enum["direct-turbo"]
    ),
    Match.when(
      ({ command, args }) =>
        command === "bun" &&
        A.get(args, 0).pipe(O.contains("run")) &&
        A.get(args, 1).pipe(O.contains("beep")) &&
        A.get(args, 2).pipe(O.contains("ci")) &&
        A.get(args, 3).pipe(O.contains("lane")),
      () => FlakeQuarantineStepKind.Enum["nested-ci-lane"]
    ),
    Match.orElse(() => FlakeQuarantineStepKind.Enum.ordinary)
  )
```

Import `LiteralKit` from `@beep/schema` and `Match` from `effect/Match`, matching
the repository's schema-first and match-helper laws. In
`serialTurboRerunArgs`, derive `stepKind` once. Match `nested-ci-lane` to the
existing outer-CLI result; for the other variants, retain the independent
`A.contains(args, "--")` syntax check and use the literal value to decide
whether Turbo options are already in the direct command's option position.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:383`
  — replace `isDirectTurboRun` and `isNestedCiLane` with the named kit and one
  `flakeQuarantineStepKind` projection.
- `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:404`
  — derive the step kind once inside `serialTurboRerunArgs`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:406`
  — replace the nested-CI predicate branch with the corresponding literal
  case while preserving its omission of `--concurrency=1` and `--`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:410`
  — replace the direct-Turbo predicate read with the literal case; retain the
  independent pre-existing `--` check for ordinary scripts.
- `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts:455`
  and `:492` — both exported rerun-step constructors continue to consume
  `serialTurboRerunArgs`; no public signature changes.
- `packages/tooling/tool/cli/test/flake-quarantine.test.ts:139`–`:232` — retain
  and extend the argument-placement assertions for ordinary scripts, direct
  Turbo, nested CI, and ordinary scripts that already contain `--`.

Whole-repo search found no consumer of either predicate outside this file and
no existing named step-kind owner to reuse.

# Guard-deletion accounting

- Delete both boolean-returning classifier helpers at
  `FlakeQuarantine.ts:383` and `:388`.
- Delete the implicit exclusive dispatch expressed by
  `if (isNestedCiLane(step))` at `:406` followed by
  `isDirectTurboRun(step) || ...` at `:410`; replace it with one derived
  literal and explicit case handling.
- Retain `A.contains(args, "--")`: it is an independent command-syntax fact,
  not part of the correlated step-kind state.

# Encoded-side impact

none (internal). The literal is derived inside argument construction and is
not added to `QualityTaskStep`, the flake-quarantine artifact, CLI JSON, or any
other encoded surface.

# Test impact

- `packages/tooling/tool/cli/test/flake-quarantine.test.ts:139` proves the
  ordinary Bun-script case.
- `packages/tooling/tool/cli/test/flake-quarantine.test.ts:148` and `:223`
  prove direct Turbo for joined and split concurrency arguments.
- `packages/tooling/tool/cli/test/flake-quarantine.test.ts:163` and `:189`
  prove nested CI for standalone and full-lane reruns.
- Add one ordinary-script case whose args already contain `--`, completing the
  independent separator branch without exposing the internal kit for testing.

# Risk & sequencing

Tier 1E. Land with the repo-CLI internal-domain batch. The main risk is changing
where `--concurrency=1` and package filters are inserted; preserve every exact
argument snapshot and keep the kit file-local. Run full `@beep/repo-cli`
package verification.
