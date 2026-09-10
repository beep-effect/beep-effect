## Instance

- id: `package-verify-step-outcome`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:151`
- symbol: `PackageVerifyStepResult`
- members: `skipped`, `ok`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:497`: the absent-script writer forces skipped=true with ok=true; the executed writer at line 513 sets skipped=false and derives ok from the subprocess-plan exit code.
  - E2 — `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:630-749`: inbox, skip-filter, successful-audit, renderer, and CLI failure readers name only skip, ok, and fail.

## Current shape

Live declaration at `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:151`:

```ts
export class PackageVerifyStepResult extends S.Class<PackageVerifyStepResult>($I`PackageVerifyStepResult`)(
  {
    step: PackageVerifyStepName,
    script: S.String,
    skipped: S.Boolean,
    ok: S.Boolean,
    durationMillis: S.Finite,
    exitCode: S.Option(S.Finite),
    output: S.String,
  },
  $I.annote("PackageVerifyStepResult", {
    description: "Result of one package-local verification step.",
  })
) {}
```

## Cardinality gap

Two booleans represent four combinations. Three are legal and named by the renderer already: `skip`, `ok`, and `fail`. The illegal state is `{ skipped: true, ok: false }`; an unexecuted step cannot also be a failed execution.

The schema constructor accepts the fourth pair, but no production writer,
fixture, documented input, or decoder gives it meaning. Both sole writers at
lines 498-520 produce only the three named outcomes.

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
    exitCode: S.Option(S.Finite),
    output: S.String,
  },
  $I.annote("PackageVerifyStepResult", {
    description: "Result of one package-local verification step.",
  })
) {}
```

`exitCode` remains the existing `S.Option(S.Finite)` field because it is payload
shared by the result record. Do not replace it with an optional-key encoding;
the ratified target is a literal outcome, not a payload-varying tagged union.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:133-145` — update the JSDoc example to `outcome: "ok"` and log `result.outcome`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:151-164` — replace `skipped` and `ok` with `outcome`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:497-506` — the absent-script write becomes `outcome: PackageVerifyStepOutcome.Enum.skip`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:509-521` — the executed-step write selects `.ok` or `.fail` from the completed audit-or-script plan exit code.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:623-649` — migrate the P0 inbox fallback exit code, skip-filtered shard recording, and successful full-audit lookup to match `outcome` while preserving their current meanings and the audit build-closure command receipt.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:681-700` — render mark, timing, and failure output from `outcome`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:749` — collect CLI failures from `outcome === "fail"`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:694` — migrate the renderer's failure-output filter; this is a distinct reader from the mark at line 686 and the CLI failure collection at line 749.
- Update the Quality test barrel that currently exports `PackageVerifyStepResult` to export `PackageVerifyStepOutcome` as well; the symbol is consumed from `@beep/repo-cli/test/Quality` at `packages/tooling/tool/cli/test/package-verify.test.ts:4`.

The implementation sweep must repeat the member search at its exact source
head; the inbox, shard filtering, audit-success, renderer, and failure
collection readers above are all mandatory consumers.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:630` — delete the fallback `result.ok` interpretation.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:636` — delete the skip-filter boolean read.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:642` — delete the combined `!skipped && ok` audit-success predicate.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:686-698` — delete the mark chain, duration skip read, and compound failure predicate.
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:749` — delete the duplicate CLI failure predicate.

## Encoded-side impact

none (internal). `PackageVerifyStepResult` is an in-process Quality result and has no JSON codec or persisted writer.

No compatibility transform is required. Preserve `exitCode` as the existing
`S.Option(S.Finite)` decoded field and preserve every receipt/inbox value; this
is a source-compatible in-process migration of all consumers, not a wire
normalization.

## Test impact

- `packages/tooling/tool/cli/test/package-verify.test.ts:293` — replace the direct `result.ok` array assertion with outcome assertions.
- `packages/tooling/tool/cli/test/package-verify.test.ts:315-321` — migrate the live skipped/ok `MatchObject` assertions to the outcome literal; these are mandatory readers even though they are not `PackageVerifyStepResult.make` fixtures.
- Migrate every `PackageVerifyStepResult.make` fixture in the renderer, quick,
  full-audit, inbox, and failure tests; preserve `O.some`/`O.none` exit-code
  construction exactly.
- Cover all three outcomes, skip duration suppression, failure collection,
  skip filtering, successful audit recognition, and fallback inbox exit code.
- Add a schema-construction rejection test for no fourth outcome by using the
  literal schema; do not retain a synthetic skipped-failure fixture.

## Risk & sequencing

This shares the repo-CLI Tier 1 batch. Land the kit, both writers, every inbox,
filter, audit, renderer, failure, fixture, and assertion consumer atomically.
The highest regression risk is silently treating skip as success after one of
the old `ok` readers survives, or changing the established Option encoding of
`exitCode`. Preserve the newly added upstream Turbo build-closure plan for the
audit step, its short-circuit behavior, test exports, and exact inbox command.
