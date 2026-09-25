## R37 exact-source locator refresh (authoritative)

This section supersedes every earlier numeric source/test locator in this document. Earlier source identities describe historical review provenance; current binding is HEAD84058d6470137e35f108d13c7dba52129db9a301/main9a1bd3805574bca087d4da09ece4a628038afb27. Semantic target,4/3 relation, complete payload contract and migration obligations above remain unchanged.

Current PackageVerify.ts locations: complete direct seven-field S.Class152-165 (skipped156,ok157); absent-script writer636-644 (true,true); executed writer651-659 (false,exitCode===0). Render mark824 and timing825, failure output832, P0 inbox fallback768, shard skip-filter774, successful full-audit780, CLI failure887. Update the JSDoc example134-147 and declaration152-165. The class annotation now says “Package verification subprocess result.” Preserve that current description. There are no spreads/inherited Boolean fields. Other five fields remain step,script,durationMillis,exitCode:Option<Finite>,output.

The current implementation migration must update these exact reader/writer sites atomically. The full audit upstream plan and its execution receipts remain intact. Guard credit is limited to replacing the two result members and the listed result interpretations with one outcome; actual subprocess error handling and full-audit/quick behavior remain. Current test/package-verify.test.ts514-534 explicitly constructs executed success and failure with exitCode=None, so do not narrow Option absence or finite values from production Some writers. Existing assertions around315-324 and renderer/inbox fixtures must migrate without synthetic skipped-failure acceptance. All prior required test behaviors remain; enumerate current test symbols instead of applying stale numerical offsets.

No encoded change, added defaults or payload constraints. Retain the existing schema-first LiteralKit target and exported test barrel change. No implementation or independent P3 credit. Exact source, tests and historical design hashes accompany r37-cli-lq-audit/disposition.json.

## Instance

- id: `package-verify-step-outcome`
- source: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus source: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
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
is an atomic decoded TypeScript migration of all consumers with no wire
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


The R28 source audit confirms the complete existing Option payload contract:
test/package-verify.test.ts509–528 intentionally constructs executed success
and failure with exitCode=None. PackageVerify.ts630 supplies the existing0/1
inbox fallback. Retain those cases and every finite present exit code; the
production Some writers do not justify an 8/3 presence-state narrowing.
FlakeQuarantine's two callable predicates are withdrawn from the census and
are not an implementation prerequisite. This remains part of the ordered
Tier 1E subsystem batch, with independent P3 review still pending.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Complete source byte-identical to its authoritative R37 locator receipt. Retain 4/3 and the full Option exit-code domain, including executed success/failure with None; do not narrow from Some production writers.

### Current named test locations

- `packages/tooling/tool/cli/test/package-verify.test.ts:116` — builds quick and default step specs
- `packages/tooling/tool/cli/test/package-verify.test.ts:121` — builds upstream audit dependencies through Turbo before the package script
- `packages/tooling/tool/cli/test/package-verify.test.ts:144` — does not run the package audit when its closure build fails
- `packages/tooling/tool/cli/test/package-verify.test.ts:174` — refreshes environment-only stale upstream output before running the audit
- `packages/tooling/tool/cli/test/package-verify.test.ts:205` — runs the audit when Turbo skips fresh upstream builds from cache
- `packages/tooling/tool/cli/test/package-verify.test.ts:234` — attributes an audit failure after a successful dependency build
- `packages/tooling/tool/cli/test/package-verify.test.ts:261` — maps dependency-build spawn failures to the package-verify error surface
- `packages/tooling/tool/cli/test/package-verify.test.ts:281` — runs quick verification and records the repository head
- `packages/tooling/tool/cli/test/package-verify.test.ts:306` — skips the dependency build when the package has no audit script
- `packages/tooling/tool/cli/test/package-verify.test.ts:329` — surfaces malformed workspace manifests
- `packages/tooling/tool/cli/test/package-verify.test.ts:350` — surfaces a missing repository HEAD after verification
- `packages/tooling/tool/cli/test/package-verify.test.ts:367` — rejects more than one package argument before discovery
- `packages/tooling/tool/cli/test/package-verify.test.ts:378` — selects an explicit workspace package
- `packages/tooling/tool/cli/test/package-verify.test.ts:392` — fails when changed files span multiple packages
- `packages/tooling/tool/cli/test/package-verify.test.ts:414` — collects deleted package paths for workspace auto-detection
- `packages/tooling/tool/cli/test/package-verify.test.ts:439` — renders compact summaries and failed step output
- `packages/tooling/tool/cli/test/package-verify.test.ts:478` — writes package failures to the shared inbox and clears them on success
- `packages/tooling/tool/cli/test/package-verify.test.ts:537` — clears quick lint and check poison after a successful full audit
- `packages/tooling/tool/cli/test/package-verify.test.ts:571` — records the Turbo closure build in a genuine audit failure capsule

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.
