## Instance

- id: `package-verify-step-outcome`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:152`
- symbol: `PackageVerifyStepResult`
- members: `skipped`, `ok`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:452`: Skip write forces skipped=true with ok=true; the run write (line 467) always sets skipped=false and lets ok follow the exit code — skipped+!ok is never constructed.
  - E2 — `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:559`: Renderer if-chains skipped then ok then fail and never handles a combined skipped+!ok case.

## Current shape

Live declaration at `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:148`:

```ts
export class PackageVerifyStepResult extends S.Class<PackageVerifyStepResult>($I`PackageVerifyStepResult`)(
  {
    step: PackageVerifyStepName,
    script: S.String,
    skipped: S.Boolean,
    ok: S.Boolean,
    durationMillis: S.Finite,
    exitCode: S.OptionFromOptionalKey(S.Finite),
    output: S.String,
  },
  $I.annote("PackageVerifyStepResult", {
    description: "Result of one package-local verification step.",
  })
) {}
```

## Cardinality gap

Two booleans represent four combinations. Three are legal and named by the renderer already: `skip`, `ok`, and `fail`. The illegal state is `{ skipped: true, ok: false }`; an unexecuted step cannot also be a failed execution.

## Target schema

Reuse the file's existing `LiteralKit` import and introduce one payload-free domain:

```ts
export const PackageVerifyStepOutcome = LiteralKit(["skip", "ok", "fail"]).pipe(
  $I.annoteSchema("PackageVerifyStepOutcome", {
    description: "Whether a package verification step was absent, passed, or failed.",
  })
)

export type PackageVerifyStepOutcome = typeof PackageVerifyStepOutcome.Type

export class PackageVerifyStepResult extends S.Class<PackageVerifyStepResult>($I`PackageVerifyStepResult`)(
  {
    step: PackageVerifyStepName,
    script: S.String,
    outcome: PackageVerifyStepOutcome,
    durationMillis: S.Finite,
    exitCode: S.OptionFromOptionalKey(S.Finite),
    output: S.String,
  },
  $I.annote("PackageVerifyStepResult", {
    description: "Result of one package-local verification step.",
  })
) {}
```

`exitCode` remains optional because it is payload shared by the existing result record; the ratified target is a literal outcome, not a payload-varying tagged union.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:133` — update the JSDoc example to `outcome: "ok"` and log `result.outcome`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:152` — replace `skipped` and `ok` with `outcome`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:449` — the absent-script write becomes `outcome: PackageVerifyStepOutcome.Enum.skip`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:464` — the executed-step write selects `.ok` or `.fail` from `result.exitCode === 0`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:559` — render the mark directly from `result.outcome`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:560` — derive timing presence with `PackageVerifyStepOutcome.is.skip(result.outcome)`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:567` — select failure output with `PackageVerifyStepOutcome.is.fail(result.outcome)`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:618` — select command failure with `PackageVerifyStepOutcome.is.fail(result.outcome)`.
- Update the Quality test barrel that currently exports `PackageVerifyStepResult` to export `PackageVerifyStepOutcome` as well; the symbol is consumed from `@beep/repo-cli/test/Quality` at `packages/tooling/tool/cli/test/package-verify.test.ts:4`.

Whole-repo searches found no other production reads or writes of the two members on `PackageVerifyStepResult`.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:559` — delete the `skipped ? ... : ok ? ... : ...` exclusivity chain.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:560` — delete the second `skipped` interpretation used to suppress duration.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:567` — delete the compound `!ok && !skipped` failure predicate.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:618` — delete the duplicate compound failure predicate at the CLI exit boundary.

## Encoded-side impact

none (internal). `PackageVerifyStepResult` is an in-process Quality result and has no JSON codec or persisted writer.

## Test impact

- `packages/tooling/tool/cli/test/package-verify.test.ts:144` — construct the passing fixture with `outcome: "ok"` instead of two booleans.
- `packages/tooling/tool/cli/test/package-verify.test.ts:153` — construct the failing fixture with `outcome: "fail"`.
- Extend `packages/tooling/tool/cli/test/package-verify.test.ts:137` with a `skip` fixture, so rendering proves all three literals and duration suppression for `skip`.
- A whole-repo test search found no other test touching these `PackageVerifyStepResult` members.

## Risk & sequencing

This is isolated to `PackageVerify.ts` and its focused test/barrel. Land the new kit, model field, both writers, all four readers, and tests atomically so no intermediate type maps `skip` to success. It shares only the broad tooling package with the other batch designs.
