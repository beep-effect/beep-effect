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

## Triage table (candidate transforms — counts are estimates pending P1)

| Smell | Target | Tier | Est. sites | Golden-diff status |
| --- | --- | --- | --- | --- |
| `R.getSomes({...})` on heterogeneous Option-structs | `O.getSomesStruct({...})` (`packages/foundation/modeling/utils/src/Option.ts:102`) | ≥ 0.9 (pure codemod) — **blocked until the Law 20/47 amendment merges (D5)** | ~113 per SPEC/prompt estimate; a directional `rg -c "R\.getSomes\(" packages apps` on 2026-07-05 sums to 124 occurrences repo-wide — P1 discovery is the authoritative count, this is only a sanity check | not started |
| `?? d` fallback where a schema constructor default belongs | `SchemaUtils.withConstantDefault` / `SchemaUtils.withKeyDefaults` (`packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts`, `withKeyDefaults.ts`) | 0.6 – 0.9 (codemod proposes + review) | TBD — P1 | not started |
| Top-of-file `const isX = S.is(X)` / `const decodeX = ...` guard/decode wall | `SchemaUtils.withCodecStatics` (`packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts`) or in-body `static readonly is = S.is(Self)` | 0.6 – 0.9 (codemod proposes + review) | TBD — P1 | not started |
| `switch` / if-chain over a `_tag`-like discriminator | Derived `match` / `Match.tagsExhaustive` / `Match.discriminatorsExhaustive` (`effect/Match`) | 0.6 – 0.9 (codemod proposes + review) | TBD — P1 | not started |
| `...somethingDefaults` spread | Schema-level defaults (`SchemaUtils.withConstantDefault` / `withKeyDefaults` / `withEncodeDefault`) | 0.6 – 0.9 (codemod proposes + review) | TBD — P1 | not started |
| `.trim()` / `.toUpperCase()` / `.toLowerCase()` / clamp/coerce normalization in a function body | Transformation schema (`S.decodeTo` + `SchemaTransformation.transform`/`transformOrFail`, or `SchemaGetter`) | Judgment (< 0.6) | TBD — P1 | not applicable (judgment-only) |
| Function returning `null` / `undefined` in domain code | `effect/Option` (`O.some`/`O.none`/`O.fromNullishOr`) | Judgment (< 0.6) | TBD — P1 | not applicable (judgment-only) |

The `R.getSomes` → `O.getSomesStruct` row is the only ≥ 0.9 candidate today
and is explicitly sequenced behind the doctrine amendment (D5, SPEC.md Stop
Conditions): do not draft that codemod, and do not run it against any wave,
until `.claude/skills/effect-first-development/SKILL.md` Law 20 (line 99) and
Law 47 (line 126) — plus the mirror at
`.claude/skills/schema-first-development/SKILL.md:96` — are amended and the
consolidated `standards/architecture/DECISIONS.md` entry (G6) is merged.

## What P1.5 must add here

- One `ops/codemods/<transform-name>.codemod.ts` per ≥ 0.6-confidence row,
  each built on `TSMorphService.updateSourceFile`.
- One `ops/codemods/__fixtures__/<transform-name>/{before,after}.ts` pair per
  codemod, exercised by a golden-diff dry-run test before the codemod is
  allowed to run against a real wave.
- Updated counts in the triage table above, replacing every "TBD — P1" with
  the measured P1 baseline.
