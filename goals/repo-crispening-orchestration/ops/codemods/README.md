# Codemods — Standing Contract & Triage Table

Codemod **source lands in P1.5** (mechanize), after the P1 discovery baseline
exists. This README is authored in P0/P1 as the standing contract those
codemods must follow and the triage table that routes each S1–S5 smell to a
mechanization tier. **No codemod code is written yet** — this file only
states the contract and the current (P1-pending) triage estimate.

## Contract

Every codemod is a thin wrapper around
`TSMorphService.updateSourceFile(filePath, (sourceFile, project) => void)`
(`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:364-368`
for the shape, `:1273-1317` for the live implementation). The service:

- Diffs `getFullText()` before/after the mutation callback and only calls
  `sourceFile.save()` when the text actually changed (`:1287-1316`) — a
  codemod that makes no change is a safe no-op, not a forced write.
- Requires `Crypto.Crypto | FileSystem.FileSystem | Path.Path` (see
  `TSMorphServiceLive`, `:1346-1347`); codemods run inside a CLI command that
  provides those layers, the same way `beep lint` / `beep laws` commands do.
- Returns typed errors from the `TSMorphServiceError` tagged union
  (`:301-308`: `TsMorphProjectLoadError` / `TsMorphScopeResolutionError` /
  `TsMorphSourceFileError` / `TsMorphSymbolNotFoundError` /
  `TsMorphUnsupportedFileError` / `TsMorphServiceUnavailableError`) — a
  codemod never throws past its own boundary.

**Existing precedent, verified 2026-07-05:** no CLI command currently calls
`.updateSourceFile(` — a repo-wide `rg -n "\.updateSourceFile\("
packages apps` returns nothing. The only current `TSMorphService` consumers
are **read-only** AST inspection via `inspectProject`:
`packages/tooling/tool/cli/src/commands/Laws/DualArity.ts:11,1278,1297` and
`packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts:10,393-394` (both
consume the service to detect law violations, not to rewrite files), plus
`packages/tooling/tool/cli/src/commands/CreatePackage/Handler.ts:21,796`.
A separate, unrelated mutation-adapter placeholder exists at
`packages/tooling/tool/cli/src/commands/CreatePackage/TsMorphIntegrationService.ts`
(its own `TsMorphMutationAdapter` port, currently wired only to
`UnsupportedTsMorphAdapter`, a stub that always returns `skipped` — it is not
built on `TSMorphService.updateSourceFile` and is not a working precedent).
**P1.5's codemods will be the first real `.updateSourceFile(` callers in the
repo.** There is no existing mutation codemod to copy structurally; each P1.5
codemod is new code against a proven read-only contract.

Every codemod ships a **golden-diff dry-run test** (a fixture file in,
an expected diff out) that passes **before** the codemod touches any wave.
No codemod runs against real package source until its golden-diff test is
green.

## Tier rules (G5 — two-tier confidence threshold)

| Confidence | Tier | What happens |
| --- | --- | --- |
| ≥ 0.9 | **Pure codemod** | Codemod applies the change unattended; agent reviews the aggregate diff, not each site. |
| 0.6 – 0.9 | **Codemod proposes + agent reviews each diff** | Codemod computes the candidate edit; a remediation agent accepts/rejects/adjusts every site before it lands. |
| < 0.6 | **Judgment-only** | No codemod. A specialist or remediation agent decides case by case; the finding stays in the inventory as `mechanization: "judgment"`. |

Confidence and mechanization class come from the §5.5 inventory record
produced by the S1–S5 discovery specialists (`ruleId`, `file`, `line`,
`symbol`, `smell`, `proposedTarget`, `confidence`, `mechanization`, `roiRank`,
`exception?`); this table assigns each smell family's *default* tier, which
discovery may override per-site.

## Triage table (measured P1 baseline, 2026-07-06)

Counts are **actionable** findings (exception-ledgered records excluded) from
the §5.5 inventories at `ops/inventory/S1..S5`, split by the G5 confidence
tiers as `pure-codemod / assisted / judgment`. Aggregate across all
specialists: 1,761 actionable (175 / 1,475 / 111) plus 1,491 audited
exceptions out of 3,252 records.

| Smell | Target | Measured tier split (≥0.9 / 0.6–0.9 / <0.6) | Sites | Golden-diff status |
| --- | --- | --- | --- | --- |
| `R.getSomes({...})` on heterogeneous Option-structs (`SFV4-getsomes-struct`, S3+S2) | `O.getSomesStruct({...})` (`packages/foundation/modeling/utils/src/Option.ts:102`) | 0 / 22 / 0 — discovery measured **assisted**, not the ≥0.9 the P0 estimate assumed; call-site heterogeneity needs per-diff review | 22 | not started |
| Schema-default absorption: `?? d` fallbacks and `...somethingDefaults` spreads (`SFV4-defaults`, S2) | `SchemaUtils.withConstantDefault` / `withKeyDefaults` / `withEncodeDefault` (`packages/foundation/modeling/schema/src/SchemaUtils/`) | 36 / 246 / 27 | 309 | not started |
| Statics colocation: guard/decode walls, statics detached from schemas, non-dual helpers (`SFV4-static-api`, S4) | `SchemaUtils.withCodecStatics` or in-body `static readonly is = S.is(Self)`; `dual`; `flow(...)` | 85 / 392 / 38 | 515 | not started |
| Manual discriminator branching: `switch`/if-chains over `_tag`-like discriminators (`SFV4-static-api`, S3) | Derived `match` / `Match.tagsExhaustive` / `Match.discriminatorsExhaustive` (`effect/Match`) | 17 / 115 / 9 | 141 | not started |
| Body-level normalization: trim/case/clamp/coerce (`SFV4-normalization`, S2) | Transformation schema (`S.decodeTo` + `SchemaTransformation.transform`/`transformOrFail`, or `SchemaGetter`) | 2 / 51 / 9 — measured mostly **assisted**, not judgment-only as estimated | 62 | not started |
| `null`/`undefined`-returning domain helpers (`SFV4-null-return`, S2) | `effect/Option` (`O.some`/`O.none`/`O.fromNullishOr`) | 4 / 29 / 1 — measured mostly **assisted**, not judgment-only as estimated | 34 | not started |
| Exported fn contracts bypassing schemas (`SFV4-fn-schema`, S1) | `Fn` / `EffectSchema()` / `PromiseSchema` (`@beep/schema`) | 0 / 54 / 8 | 62 | not started |
| Exported interface/type-alias/struct data models (`schema-first-inventory`, S1) | `S.Class` (default) / `S.Struct` + `typeof X.Type` | 9 / 72 / 9 | 90 | not started |
| Ad-hoc `JSON.parse` near schema-fit boundaries (`SFV4-boundary-codec`, S1) | Schema codec (`S.fromJsonString` / boundary decode) | 0 / 11 / 4 | 15 | not started |
| Unbranded/broad primitives on domain fields (`SFV4-precision-audit`, S5) | Brands, named checks (`S.isPattern`), range checks | 15 / 235 / 5 | 255 | not started |
| Broad numeric fields (`SFV4-numeric-domain`, S5) | `S.Int` / `S.Finite` / range refinements | 5 / 148 / 0 | 153 | not started |
| Absorptions without round-trip laws (`SFV4-arbitrary-tests`, S5) | `S.toArbitrary` round-trip property tests (`@effect/vitest`) | 0 / 93 / 1 | 94 | not started |
| Hand-written equality where derivation applies (`SFV4-equivalence`, S5) | `S.toEquivalence` | 2 / 7 / 0 | 9 | not started |

The `R.getSomes` → `O.getSomesStruct` sweep was sequenced behind the Law
20/47 doctrine amendment (D5, SPEC.md Stop Conditions). **That gate is
satisfied:** the amendment and the consolidated
`standards/architecture/DECISIONS.md` entry merged to main in the P0 PR
(#294, commit 5fd9f35220). The sweep may proceed in P2 — at the measured
**assisted** tier (agent reviews each diff), not unattended.

## What P1.5 must add here

- One `ops/codemods/<transform-name>.codemod.ts` per ≥ 0.6-confidence row,
  each built on `TSMorphService.updateSourceFile`.
- One `ops/codemods/__fixtures__/<transform-name>/{before,after}.ts` pair per
  codemod, exercised by a golden-diff dry-run test before the codemod is
  allowed to run against a real wave.
- Updated counts in the triage table above, replacing every "TBD — P1" with
  the measured P1 baseline.
