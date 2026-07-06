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
| `R.getSomes({...})` on heterogeneous Option-structs (`SFV4-getsomes-struct`, S3+S2) | `O.getSomesStruct({...})` (`packages/foundation/modeling/utils/src/Option.ts:102`) | 0 / 22 / 0 — discovery measured **assisted**, not the ≥0.9 the P0 estimate assumed; call-site heterogeneity needs per-diff review | 22 | **green** (`getsomes-struct.codemod.ts`) |
| Schema-default absorption: `?? d` fallbacks and `...somethingDefaults` spreads (`SFV4-defaults`, S2) | `SchemaUtils.withConstantDefault` / `withKeyDefaults` / `withEncodeDefault` (`packages/foundation/modeling/schema/src/SchemaUtils/`) | 36 / 246 / 27 | 309 | **green** (`defaults-fallback.codemod.ts`) |
| Statics colocation: guard/decode walls, statics detached from schemas, non-dual helpers (`SFV4-static-api`, S4) | `SchemaUtils.withCodecStatics` or in-body `static readonly is = S.is(Self)`; `dual`; `flow(...)` | 85 / 392 / 38 | 515 | **green** (`static-api-colocation.codemod.ts`) |
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

## P1.5 scope resolution (2026-07-06)

SPEC P1.5 scopes codemod authoring to "the mechanical, high-count
transforms". The three rows above marked **green** are those transforms
(886 of 1,783 actionable sites): `getsomes-struct` (AST-mechanical),
`defaults-fallback` and `static-api-colocation` (high-count proposers,
same-file-conservative — precision over recall; every skipped site falls
back to assisted hand-apply, see the matcher-scope sections below). The
remaining rows stay **not started** by design: they are scaffold- or
judgment-shaped (writing property tests, choosing brands, restructuring
discriminator branches into `Match`) where a mechanical transform would be
"a second bug wearing a smaller diff" — P2 remediation agents hand-apply
those per the G5 assisted/judgment procedure in
`ops/prompts/remediation.agent.md`. Each codemod ships a
`__fixtures__/<name>/{before,after}.ts.txt` pair exercised by its
golden-diff dry-run test; no codemod touches a wave before its test is
green.

## Running the codemod tests

`goals/` is **not** a workspace package, so the root `vitest.config.ts`
`projects` globs never pick it up. Rather than restructure any package, each
codemod ships a local `vitest.config.ts` here that `mergeConfig`s the repo
`vitest.shared.ts` (which is where `@beep/*` alias resolution lives) and pins
`root` to this directory so `*.test.ts` resolves. Run all codemod golden-diff
tests with:

```
npx vitest run --config goals/repo-crispening-orchestration/ops/codemods/vitest.config.ts
```

(Use `npx vitest run` — never `bun test`; the suite uses `@effect/vitest`
`layer()`/`it.effect`.) The golden-diff test copies the `before` fixture into a
throwaway in-repo temp dir alongside a minimal `tsconfig.json` (the
`TSMorphService` scope resolver walks up from the subject file to the nearest
`tsconfig.json`, and its `workspaceOnly` policy rejects files outside the repo,
so the subject **must** live inside the repo tree — not `/tmp`), runs the
codemod through the real `TSMorphService.updateSourceFile`, asserts the saved
file is byte-identical to the `after` fixture, and asserts the homogeneous-dict
negative case is a no-op (`changed: false`, text untouched). The temp dir is
always removed.

Each codemod is also runnable standalone against a file list (the shape the P2
wave drives), which is the least-surprising invocation for a repo `.ts` script:

```
bun goals/repo-crispening-orchestration/ops/codemods/getsomes-struct.codemod.ts <file...>
```

It prints `changed`/`unchanged` per file and is idempotent (a second run is a
no-op). Run it in a temp copy for dry-runs; against real source it is P2's tool.

### `getsomes-struct` matcher scope (conservative, assisted-tier)

`getsomes-struct.codemod.ts` rewrites **only** `<R>.getSomes(<inline object
literal>)` where `<R>` is the `import * as R from "effect/Record"` namespace and
the literal has fixed, non-computed keys (property/shorthand assignments, no
spreads, non-empty). It retargets the file's `effect/Option` namespace import to
`@beep/utils/Option` (a superset re-export) or reuses an existing `@beep/utils`
`O` binding, then drops the now-unused `effect/Record` import. It deliberately
skips: `R.getSomes(variable)` (homogeneous dictionary), any non-literal
argument, and files under `packages/foundation/modeling/utils/` (self-import).
Because it keys off an **existing** `R.getSomes` call, 6 of the 22 inventory
findings (`chalk` SupportsColor:464, `ffmpeg` FFmpeg.service:262, `langextract`
Alignment:36 & Handoff:59, `mcp-kit` SanitizedSpan:188, `repo-configs`
SharedNextConfig.model:377) are **not** transformed by this codemod — their
source has no `R.getSomes` today (mutable-record / spread-group /
`Context.getOption` shapes) and remains a judgment-tier hand refactor for the P2
agent. The remaining sites carry live `R.getSomes({...})` calls this codemod
proposes edits for, per-diff reviewed at the assisted tier.

### `static-api-colocation` matcher scope (conservative, assisted-tier)

`static-api-colocation.codemod.ts` relocates **only** a non-exported module
const of the exact shape `const x = <S>.<method>(<Owner>)` where `<S>` is the
`import * as S from "effect/Schema"` namespace, `<method>` is one of `is`,
`decodeUnknownSync`, `decodeUnknownOption`, `encodeSync`, and `<Owner>` is a
single identifier naming an `S.Class`-family declaration **in the same file**
(detected by the class `extends` call chain rooting at the `S` namespace). It
adds an in-body `static readonly <method> = S.<method>(<Owner>)` and rewrites
local reads `x(v)` → `Owner.<method>(v)`. It deliberately **skips** (hand-apply
in P2): exported consts (public API — a §5.4 ripple, P2's judgment call);
owners whose schema is imported from another file; owners that are not the
`S.Class` family (e.g. branded `S.String.check(...).pipe(S.brand(...))` values
like `DockerResolver`'s `StableDockerTag`, which are not classes and cannot hold
a static); and any const whose target static name would collide with an existing
class member (or with another relocation already claiming that static on the
same owner). ts-morph inserts the static at its default indentation (four
spaces); the P2 apply reformats via biome, so the proposed diff's indentation is
cosmetic, not load-bearing.

### `defaults-fallback` matcher scope (conservative, assisted-tier)

`defaults-fallback.codemod.ts` absorbs **only** `<object>.<field> ?? <literal>`
reads where `<literal>` is a string / number / `true` / `false` literal and
`<field>` maps to **exactly one** same-file `S.optionalKey(...)` field (on an
`S.Class` heritage `{ field: schema }` object or an `S.Struct({...})`) that
carries **no** default combinator yet. It pipes
`SchemaUtils.withKeyDefaults(<literal>)` onto that field (adding the
`@beep/schema` `SchemaUtils` import if missing) and simplifies the body read to
the plain field access. It deliberately **skips** (hand-apply in P2): computed
or non-literal defaults (`?? computeDefault()`, `?? Duration.minutes(10)`, `??
someIdentifier`); fields whose owning schema is imported from another file (the
field name resolves to no same-file `optionalKey` field); fields that already
carry a default (`withKeyDefaults` / `withConstantDefault` /
`withConstructorDefault` / …); and any field name that matches more than one
same-file `optionalKey` field or is targeted by multiple bodies (a single schema
default cannot serve divergent call-site defaults). Because the field↔schema
link is **name-based**, not type-resolved, the P2 reviewer must confirm the
`<object>` actually has the matched schema's type before accepting each diff —
that confirmation is exactly the assisted-tier contract.
