## Instance

- id: `runners-bake-freshness`
- file:line: `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:313`
- symbol: `BakeCheckReport`
- members: `lockfileMatches`, `bunArchiveMatches`, `bunVersionMatches`, `fresh`
- evidence classes:
  - E4 — `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:780`: fresh is a stored conjunction of its three sibling probes: `fresh: lockfileMatches && bunArchiveMatches && bunVersionMatches`.

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

class BakeCheckReportValue extends S.Class<BakeCheckReportValue>($I`BakeCheckReportValue`)(
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

class BakeCheckReportEncoded extends S.Class<BakeCheckReportEncoded>($I`BakeCheckReportEncoded`)(
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
  }
) {}

export const BakeCheckReport = BakeCheckReportEncoded.pipe(
  S.decodeTo(BakeCheckReportValue, BakeCheckReportTransformation),
  $I.annoteSchema("BakeCheckReport", {
    description: "Lockfile, Bun release archive, and Bun version freshness result for the live runner AMI pin.",
  })
)
export type BakeCheckReport = typeof BakeCheckReport.Type

export const bakeCheckReportFreshness = (report: BakeCheckReport): BakeFreshness =>
  BakeFreshness.is.fresh(report.lockfileFreshness) &&
  BakeFreshness.is.fresh(report.bunArchiveFreshness) &&
  BakeFreshness.is.fresh(report.bunVersionFreshness)
    ? BakeFreshness.Enum.fresh
    : BakeFreshness.Enum.stale
```

The decoded report stores exactly three independent literal states.
`bakeCheckReportFreshness` is the only overall projection; no fourth decoded
field is stored. The named transformation maps the three old `*Matches` flags
to literals, ignores contradictory redundant `fresh` input in favor of the
three probes, and re-encodes all four original boolean keys canonically.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:285` — update the JSDoc construction example to the three `*Freshness` literals and derive the overall value with `bakeCheckReportFreshness`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:313` — replace the four boolean fields with the three literal fields shown above.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:337` — keep `BakeCheckReportJson` on the encoded side of the compatibility codec so public `runners bake --check --json` preserves all four existing keys and boolean values.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:757-768` — map the three live probe comparisons directly to `BakeFreshness.Enum.fresh` or `.stale` and name them `lockfileFreshness`, `bunArchiveFreshness`, and `bunVersionFreshness`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:772-781` — construct `BakeCheckReportValue` with the three literals and remove the stored `fresh` conjunction at line 780.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:63` — render `report.lockfileFreshness` directly.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:64` — render `report.bunVersionFreshness` directly; do not expand human CLI output with unrelated presentation changes.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:65` — derive the yes/no summary from `BakeFreshness.is.fresh(bakeCheckReportFreshness(report))`.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:129` — derive the check command's success/failure decision from `bakeCheckReportFreshness(result)` instead of reading the removed field.
- `packages/tooling/tool/cli/src/commands/Runners/index.ts:35` — export `BakeFreshness`, its type, and `bakeCheckReportFreshness` with `BakeCheckReport`.

Whole-repo searches found no other production read or write of these members.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:780` — delete the stored conjunction that manually keeps `fresh` coherent with three probes.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:63` — delete the boolean-to-literal ternary for the lockfile.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:64` — delete the boolean-to-literal ternary for the Bun version.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:65` — delete the direct read of the redundant `fresh` boolean; the summary uses the one schema-derived literal projection.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:129` — delete the second direct `fresh` read at the command exit boundary.

## Encoded-side impact

Tier 2 compatibility codec. `runners bake --check --json` is a public CLI
contract even when the repository has no internal consumer. Preserve
`lockfileMatches`, `bunArchiveMatches`, `bunVersionMatches`, and `fresh` with
the same boolean values. Decoded `*Freshness` fields and tags never appear in
JSON. A contradictory legacy `fresh` input is canonicalized from the three
authoritative probe booleans.

## Test impact

- `packages/tooling/tool/cli/test/runners-bake.test.ts:92-105` — change `checkReport` to construct the three literal fields and remove the redundant `fresh` constructor property.
- `packages/tooling/tool/cli/test/runners-bake.test.ts:277` — update the fresh and stale render snapshots at lines 284 and 295 only for the renamed lockfile/Bun-version literal reads and derived yes/no summary. Preserve the current human CLI surface exactly; it does not print a separate Bun-archive line.
- `packages/tooling/tool/cli/test/runners-bake.test.ts:407` — replace `check.fresh` with `BakeFreshness.is.fresh(bakeCheckReportFreshness(check))`.
- Add a table covering all eight probe combinations. For each row, prove the
  decoded literals, derived overall freshness, exact four-key CLI JSON, and
  canonicalization of a redundant `fresh` value that disagrees with the three
  probes.

## Risk & sequencing

This Tier 2 singleton lands after the repo-CLI Tier 1 batch, which may change
the bake command's run-mode handling. Land schema, transform, service writer,
renderer, barrel, and runner tests together. The primary risk is accidentally
serializing the honest decoded literals or trusting redundant `fresh` input;
exact CLI JSON snapshots are the release gate.
