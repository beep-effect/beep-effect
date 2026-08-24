## Instance

- id: `runners-bake-freshness`
- file:line: `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:313`
- symbol: `BakeCheckReport`
- members: `lockfileMatches`, `bunArchiveMatches`, `bunVersionMatches`, `fresh`
- evidence classes:
  - E4 — `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:754`: fresh is a stored conjunction of its three sibling probes: `fresh: lockfileMatches && bunArchiveMatches && bunVersionMatches`.

## Current shape

Live declaration at `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:304` (the affected fields are lines 313–316):

```ts
export class BakeCheckReport extends S.Class<BakeCheckReport>($I`BakeCheckReport`)(
  {
    amiId: S.NonEmptyString,
    expectedLockfileSha256: Sha256Hex,
    actualLockfileSha256: S.OptionFromOptionalKey(Sha256Hex),
    expectedBunArchiveSha256: Sha256Hex,
    actualBunArchiveSha256: S.OptionFromOptionalKey(Sha256Hex),
    expectedBunVersion: S.NonEmptyString,
    actualBunVersion: S.OptionFromOptionalKey(S.NonEmptyString),
    lockfileMatches: S.Boolean,
    bunArchiveMatches: S.Boolean,
    bunVersionMatches: S.Boolean,
    fresh: S.Boolean,
  },
  $I.annote("BakeCheckReport", {
    description: "Lockfile, Bun release archive, and Bun version freshness result for the live runner AMI pin.",
  })
) {}
```

## Cardinality gap

The four booleans represent 16 combinations. Only eight are legal: the three probes vary independently, while `fresh` must equal their conjunction. Name each probe state `fresh | stale`; the overall result is derived as `fresh` only for `(fresh, fresh, fresh)`, otherwise `stale`.

## Target schema

Add the reusable payload-free domain beside `BakeMode`, using the file's existing `LiteralKit`, `S`, and `$I` imports. Do not duplicate `BakeMode`; it describes command execution, not probe freshness.

```ts
export const BakeFreshness = LiteralKit(["fresh", "stale"]).pipe(
  $I.annoteSchema("BakeFreshness", {
    description: "Whether one runner-image input agrees with the active AMI tag.",
  })
)

export type BakeFreshness = typeof BakeFreshness.Type

export class BakeCheckReport extends S.Class<BakeCheckReport>($I`BakeCheckReport`)(
  {
    amiId: S.NonEmptyString,
    expectedLockfileSha256: Sha256Hex,
    actualLockfileSha256: S.OptionFromOptionalKey(Sha256Hex),
    expectedBunArchiveSha256: Sha256Hex,
    actualBunArchiveSha256: S.OptionFromOptionalKey(Sha256Hex),
    expectedBunVersion: S.NonEmptyString,
    actualBunVersion: S.OptionFromOptionalKey(S.NonEmptyString),
    lockfileFreshness: BakeFreshness,
    bunArchiveFreshness: BakeFreshness,
    bunVersionFreshness: BakeFreshness,
  },
  $I.annote("BakeCheckReport", {
    description: "Lockfile, Bun release archive, and Bun version freshness result for the live runner AMI pin.",
  })
) {}

export const bakeCheckReportFreshness = (report: BakeCheckReport): BakeFreshness =>
  BakeFreshness.is.fresh(report.lockfileFreshness) &&
  BakeFreshness.is.fresh(report.bunArchiveFreshness) &&
  BakeFreshness.is.fresh(report.bunVersionFreshness)
    ? BakeFreshness.Enum.fresh
    : BakeFreshness.Enum.stale
```

The report stores exactly three independent literal states. `bakeCheckReportFreshness` is the only overall projection; no fourth field is stored.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:285` — update the JSDoc construction example to the three `*Freshness` literals and derive the overall value with `bakeCheckReportFreshness`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:313` — replace the four boolean fields with the three literal fields shown above.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:337` — `BakeCheckReportJson` continues to derive from `BakeCheckReport`; its presentation shape follows the honest model.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:731` — map the lockfile comparison directly to `BakeFreshness.Enum.fresh` or `.stale` and name it `lockfileFreshness`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:735` — do the same for `bunArchiveFreshness`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:739` — do the same for `bunVersionFreshness`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:743` — construct `BakeCheckReport` with the three literals; remove the stored `fresh` write at line 754.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:63` — render `report.lockfileFreshness` directly.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:64` — render `report.bunVersionFreshness` directly; also add the currently omitted Bun-archive line from `report.bunArchiveFreshness` so all modeled probes are visible.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:65` — derive the yes/no summary from `BakeFreshness.is.fresh(bakeCheckReportFreshness(report))`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:129` — derive the check command's success/failure decision from `bakeCheckReportFreshness(result)` instead of reading the removed field.
- `packages/tooling/tool/cli/src/commands/Runners/index.ts:35` — export `BakeFreshness`, its type, and `bakeCheckReportFreshness` with `BakeCheckReport`.

Whole-repo searches found no other production read or write of these members.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:754` — delete the stored conjunction that manually keeps `fresh` coherent with three probes.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:63` — delete the boolean-to-literal ternary for the lockfile.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:64` — delete the boolean-to-literal ternary for the Bun version.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:65` — delete the direct read of the redundant `fresh` boolean; the summary uses the one schema-derived literal projection.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:129` — delete the second direct `fresh` read at the command exit boundary.

## Encoded-side impact

none (internal). `BakeCheckReportJson` is an ephemeral `runners bake --check --json` presentation codec rather than a persisted campaign boundary; its keys change to the three `*Freshness` literal fields and the redundant `fresh` key disappears. The whole-repo search found no repository consumer of that JSON.

## Test impact

- `packages/tooling/tool/cli/test/runners-bake.test.ts:91` — change `checkReport` to construct the three literal fields; remove the redundant `fresh` constructor property at line 103.
- `packages/tooling/tool/cli/test/runners-bake.test.ts:277` — update the fresh and stale render snapshots at lines 284 and 295 to include Bun-archive freshness and preserve the derived yes/no summary.
- `packages/tooling/tool/cli/test/runners-bake.test.ts:406` — replace `check.fresh` with `BakeFreshness.is.fresh(bakeCheckReportFreshness(check))`.
- Add a mixed-probe case in `packages/tooling/tool/cli/test/runners-bake.test.ts` proving eight schema-representable probe combinations and proving every non-all-fresh combination derives `stale`.

## Risk & sequencing

Land the schema, service writer, renderer, barrel, and runner tests together. The only cross-file risk is the exported command JSON presentation: although inventory classifies it as internal and no repository consumer exists, release notes should call out the renamed keys for human script users. No other tooling design depends on these symbols.
