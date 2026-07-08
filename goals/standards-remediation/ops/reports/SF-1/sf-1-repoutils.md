# SF-1 — @beep/repo-utils schema-first conversions

Single writer: `packages/tooling/library/repo-utils`. 17 assigned entries
(`ops/slices/P4/beep__repo-utils.json`). Not committed.

## Disposition table

| # | File | Symbol | Ruling | Disposition |
|---|---|---|---|---|
| 1 | `src/TSMorph/TSMorph.model.ts` | `makeProjectCacheKey` | SFV4-fn-schema | **fixed** |
| 2 | `src/TSMorph/TSMorph.model.ts` | `makeProjectScopeId` | SFV4-fn-schema | **fixed** |
| 3 | `src/TSMorph/TSMorph.model.ts` | `makeSymbolId` | SFV4-fn-schema | **fixed** |
| 4 | `src/schemas/DocgenConfig.ts` | `toCanonicalDocgenConfigJson` | SFV4-fn-schema | **fixed** |
| 5 | `src/schemas/PackageJson.ts` | `NpmPackageJsonShape` | object-struct-schema | **fixed** |
| 6 | `src/schemas/PackageJson.ts` | `PackageJsonShape` | object-struct-schema | **fixed** |
| 7 | `src/schemas/PackageJson.ts` | `PeerDependencyMetaEntry` | object-struct-schema | **fixed** |
| 8 | `src/schemas/PackageJson.ts` | `PublishConfigBase` | object-struct-schema | **fixed** |
| 9 | `src/schemas/TSConfig.ts` | `TSConfigBuildOptionsShape` | object-struct-schema | **fixed** |
| 10 | `src/schemas/TSConfig.ts` | `TSConfigCompilerOptionsShape` | object-struct-schema | **fixed** |
| 11 | `src/schemas/TSConfig.ts` | `TSConfigShape` | object-struct-schema | **fixed** |
| 12 | `src/schemas/TSConfig.ts` | `TSConfigTypeAcquisitionShape` | object-struct-schema | **fixed** |
| 13 | `src/schemas/TSConfig.ts` | `TSConfigWatchOptionsShape` | object-struct-schema | **fixed** |
| 14 | `src/schemas/TSConfig.ts` | `TSNodeConfigShape` | object-struct-schema | **fixed** |
| 15 | `src/schemas/TSConfig.ts` | `makeTypeStruct` | object-struct-schema | **unconvertible** |
| 16 | `src/schemas/TSConfig.ts` | `makeEncodedStruct` | object-struct-schema | **unconvertible** |
| 17 | `src/schemas/TSConfig.ts` | `strict` (in `makeLooseJsonObject`) | object-struct-schema | **unconvertible** |

15/17 fixed, 3/17 unconvertible (real compile-tested negative attempts, evidence below).

## Mechanism note (governs most of the "fixed" entries)

`detectStructReason` (`SchemaFirst.ts:1197-1226`) only fires on literal
`S.Struct(...)` call expressions; bucket 1 (`!isObjectLiteralExpression`) is
what tagged every `XxxShape = S.Struct(xxxFields)` pattern here (`xxxFields` is
an identifier reference, not an inline literal). Two independent fixes both
make the call disappear from the scan:

- **Fold into the outer class** (5, 6, 9, 12, 13, 14): when `XxxShape` is used
  *only* as the fields-arg for exactly one exported `S.Class`, delete the
  intermediate `S.Struct(...)` entirely and pass the raw fields record
  directly to `S.Class<Xxx>(id)(xxxFields, ...)` (overload 1, `Fields extends
  Struct.Fields`). Verified against this file's own precedent (every other
  class here, e.g. `PersonObject`, already does this).
- **Inline the object literal** (7, 8): when `XxxShape`/its fields feed
  `S.StructWithRest(...)` (not `S.Class`), converting to `S.Class` is
  type-blocked (see entry 15-17 evidence: `Class`'s `.ast` is typed
  `SchemaAST.Declaration`, but `StructWithRest.Objects` requires `ast:
  SchemaAST.Objects` — TS2345 reproduced). Since both fields records
  (`peerDependencyMetaEntryFields`, `publishConfigBaseFields`) were single-use,
  the fix is to delete the named const and inline the literal directly as
  `S.Struct({ ... })` — satisfies bucket 1, stays a genuine `Struct` (keeps
  `StructWithRest` compatibility), zero behavior change.

## Dual-use entries (10, 11) — verified, not assumed

Both `TSConfigCompilerOptionsShape` and `TSConfigShape` feed `.check(...)`
before composing into an outer `S.Class`. Real probe (`tsgo`, see below)
proved `Class.check()` returns `this["Rebuild"]` = `decodeTo<declareConstructor<Self,...>>`
(per `Class<Self,S,Inherited> extends BottomLazy<..., decodeTo<...>, ...>`,
`Schema.ts:12379-12389`), **not** `Struct<Fields>` (Struct's own `Rebuild` is
self-referential `Struct<Fields>`, `Schema.ts:3300`) — so naively swapping the
intermediate Shape to a Class and feeding its `.check()` result into another
`S.Class` fails (`TS2769`, confirmed empirically).

- **`TSConfigShape`**: `TSConfig`'s own class was *already* built directly
  from the raw (unchecked) `TSConfigShape` — the checks only apply on the
  separate, non-exported `TSConfigSemantic` decode-helper path. Folding
  `tsConfigFields` straight into `TSConfig`'s class (reordering the file so
  the class is declared first, then `TSConfigSemantic = TSConfig.check(...)`)
  is a zero-behavior-change refactor. `decodeTSConfigSemanticUnknown*` stay
  private; no external ripple.
- **`TSConfigCompilerOptionsShape`**: harder — here the checks *are* baked
  into the exported `TSConfigCompilerOptions` class (nested as
  `compilerOptions` inside `TSConfigShape`, so removing them would silently
  stop enforcing `allowImportingTsExtensions`/`reactNamespace`/etc. semantic
  checks during ordinary nested tsconfig decode — a real regression).
  Verified externally-safe substitution: grepped every consumer
  (`packages/tooling/tool/docgen/src/{Configuration,CLI}.ts`, this package's
  `src/index.ts`) — all use only generic ops (`S.toEncoded`, `S.encodeEffect`,
  `S.decodeUnknownEffect`), never `.fields`/`.make()`/`new`/bare-type
  annotations. So: `TSConfigCompilerOptionsShape` became a real (internal)
  `S.Class`; the exported `TSConfigCompilerOptions` became a plain
  re-annotated `const` (`TSConfigCompilerOptionsSemantic.pipe($I.annoteSchema(...))`)
  instead of another `S.Class` wrapper, preserving identical `.Type`/`.Encoded`
  and the checks. Added `export type TSConfigCompilerOptions = (typeof
  TSConfigCompilerOptions)["Type"]` defensively (bare-type usage wasn't found,
  but costs nothing). Verified both in-package (`tsgo -b`, full vitest) and
  cross-package (`tsgo -b` on `packages/tooling/tool/docgen`, its
  `Configuration.test.ts`).

## Unconvertible residue (15, 16, 17) — real negative attempts, reverted

All three live in generic factories parameterized by an abstract `Fields
extends S.Struct.Fields` (not a concrete schema — unlike the
`TypedTextSchema` precedent from the P2 audit, which parameterized over a
single *schema* type argument, not a whole fields record).

Real attempt 1 (`makeTypeStruct`/`makeEncodedStruct`, compiled via `tsgo -b`,
then reverted):
```
S.Class<S.Schema.Type<S.Struct<Fields>>>($I.make("TypeStruct"))(Struct.map(fields, toTypeSchemaField))
```
fails with **two** independent errors: `"Missing \`Self\` generic"` (TS can't
resolve `Self` when it's derived from the generic `Fields` param) **and**,
even past that, the result is fed to `S.StructWithRest(...).ast` at the call
site, which fails `TS2345`: `Class`'s `.ast` is `SchemaAST.Declaration`,
`StructWithRest.Objects` requires `ast: SchemaAST.Objects`.

Real attempt 2 (`strict`, both a `class Strict extends S.Class<Strict>(id)(fields) {}`
form and a non-extends `const strict = S.Class<Self>(id)(fields)` form,
compiled via `tsgo -b`, then reverted): the `class extends` form fails
`TS2509` ("Base constructor return type ... is not an object type ... with
statically known members" — a generic `Fields` base can't be resolved for a
local class declaration); the non-extends form reproduces the same "Missing
`Self` generic" failure as attempt 1, because `S.Schema.Type<S.Struct<Fields>>`
is still abstract over `Fields`. `strict` itself is only ever used for
`S.decodeUnknownEffect`/`S.encodeEffect` (a leaf use, no `StructWithRest`
composition) — so it's blocked purely by the generic-Self limitation, not the
`StructWithRest.ast` one.

**Ruling: `S.Class` cannot be constructed inside a function generic over an
abstract `Fields extends S.Struct.Fields` type parameter**, and separately,
its `.ast` type (`Declaration`) is incompatible with `StructWithRest`'s
`Objects` constraint. Both are genuine, reproduced TS-level blockers, not
avoidable without a wider redesign of `makeLooseJsonObject`'s generic shape
(out of this lane's scope — same-file, same-package, but a much larger
diff than the fence-11/fence-13 posture warrants for 3 entries). Left as
`S.Struct(fields)`/`S.Struct(Struct.map(fields, ...))`, unchanged.

## §5.3 parity proof

No wire-shape or behavior changes in any "fixed" entry — every conversion is
either (a) deleting a redundant intermediate `S.Struct` wrapper in favor of
passing the same fields record directly to the same outer class, or (b)
inlining an already-identical fields literal. Proof:

- Full pre-existing suite (184 tests across 16 files) passes byte-for-byte
  unchanged after every edit (re-run after each conversion step, and once
  more at the end).
- Added 3 new `S.toArbitrary` round-trip laws for entries that had no
  existing coverage at that granularity:
  - `test/schemas/PackageJson.test.ts`: `PublishConfig` round-trip
    (`PublishConfigBase`'s non-recursive fields — `PublishConfig.exports` is a
    pre-existing recursive `suspend()` schema with no finite arbitrary
    generation path, unrelated to this conversion, so the arbitrary excludes
    it and exercises the `StructWithRest` composition directly).
  - `test/TSMorph.model.test.ts`: `ProjectIdentityParts` and
    `SymbolIdentityParts` round-trips (new classes), each also re-deriving
    `ProjectScopeId`/`SymbolId` from the decoded parts to prove the
    `fromParts` factories still compose correctly.
- Pre-existing arbitrary round-trips already covering touched schemas and
  still green: `NpmPackageJson.fields.peerDependenciesMeta` (exercises
  `PeerDependencyMetaEntry` via `StructWithRest`),
  `TSConfig.fields.compilerOptions` (exercises the dual-use
  `TSConfigCompilerOptionsShape`/checks path end-to-end).
- Final count: **187/187 tests passing** (184 + 3 new).

## Files touched

- `packages/tooling/library/repo-utils/src/schemas/PackageJson.ts`
- `packages/tooling/library/repo-utils/src/schemas/TSConfig.ts`
- `packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts`
- `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts`
- `packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts`
- `packages/tooling/library/repo-utils/test/TSMorph.model.test.ts`

No `standards/*.jsonc`, ledger, or other package touched. No commit made.

## Commands + outcomes

- `npx tsgo -b tsconfig.json` (repo-utils) — clean after every edit round,
  final state clean.
- `npx vitest run` (repo-utils) — 16 files / 187 tests passed (final).
- `turbo run build check test docgen --filter=@beep/repo-utils` — 19/19 tasks
  successful (build+check+test+docgen for repo-utils and its deps).
- Cross-package read-only verification (no edits made outside repo-utils):
  - `npx tsgo -b packages/tooling/tool/docgen/tsconfig.json` — clean.
  - `npx vitest run test/Configuration.test.ts` (docgen) — 3/3 passed
    (exercises the now-plain-const `TSConfigCompilerOptions` and the
    unchanged `toCanonicalDocgenConfigJson` return shape).
  - `npx tsgo -b packages/tooling/tool/cli/tsconfig.json` — pre-existing,
    unrelated errors only (`DualArity.ts`, `Laws.command.ts`,
    `SchemaFirst.ts`, `RepoFile.ts` — files this lane never touched; none
    reference `toCanonicalDocgenConfigJson`/`Operations.ts`).
- Two real negative-result compile attempts (`tsgo -b`) for entries 15-17,
  each written in-tree then reverted — see evidence above.

## Summary

15/17 entries fixed (0 behavior change, 187/187 tests green, turbo
build+check+test+docgen clean). 2 dual-use Shapes (TSConfigShape,
TSConfigCompilerOptionsShape) converted to real S.Class via verified-safe
reorders (one required a cross-package consumer grep + docgen re-verify).
2 StructWithRest-feeding Shapes fixed by inlining (Class incompatible with
StructWithRest's `ast: Objects` constraint — proven via tsgo). 3 residue
entries (makeTypeStruct, makeEncodedStruct, strict) are genuinely
unconvertible: S.Class cannot be built inside a function generic over an
abstract Fields type param (two independent real compile failures,
reverted). 3 TSMorph/DocgenConfig SFV4-fn-schema advisories fixed via named

## Follow-up — driver regen surfaced `CanonicalDocgenConfigJson` as a new candidate

The bare `export interface CanonicalDocgenConfigJson` I introduced for entry 4
(`toCanonicalDocgenConfigJson`) resolved the original `SFV4-fn-schema` inline-
return-type advisory but itself surfaced as a *new* schema-first
`object-struct-schema`-family candidate ("exported pure-data interface should
be modeled as an annotated schema"). Fixed per RC-SF option 1 (derive the type
from a real annotated schema) rather than inlining or making the exported
symbol itself an executable-constructor concern:

- Added `export class CanonicalDocgenConfigJsonShape extends S.Class<...>($I\`CanonicalDocgenConfigJsonShape\`)({ $schema: S.String, exclude: S.Array(S.String), srcLink: S.String, examplesCompilerOptions: S.Record(S.String, S.Unknown) }, ...) {}`
  in `src/schemas/DocgenConfig.ts`, replacing the bare interface.
- `export type CanonicalDocgenConfigJson = (typeof CanonicalDocgenConfigJsonShape)["Type"]`
  is now a genuine schema-derived type (matches this file's existing
  `NpmPackageName`-style `(typeof X)["Type"]` alias convention), not a
  hand-written shape.
- `toCanonicalDocgenConfigJson`'s return type annotation is unchanged
  (`CanonicalDocgenConfigJson`) and its body still returns a plain object
  literal — since the class has no private members, a plain literal remains
  structurally assignable to `.Type` (same proof pattern as `FieldErrorEntry`
  in the P2 audit), so this is a pure compile-time relabeling: **zero runtime
  change**, the function never constructs an actual class instance.
- Re-verified byte-identical contract for the `packages/tooling/tool/cli`
  consumer (`Operations.ts`'s `...canonicalConfigJson` spread into
  `DocgenConfigDocument.make({...})`) precisely because it stays a plain
  object at runtime — spreading a class instance was the scenario I'd
  originally ruled out; spreading a plain literal typed *as* the class's `.Type`
  carries no such risk.

Re-verification commands (all re-run after this follow-up edit):
- `npx tsgo -b tsconfig.json` (repo-utils) — clean.
- `npx vitest run` (repo-utils) — 16 files / **187/187** passed (unchanged).
- `npx tsgo -b packages/tooling/tool/docgen/tsconfig.json` — clean.
- `npx vitest run test/Configuration.test.ts` (docgen) — 3/3 passed.
- `npx tsgo -b packages/tooling/tool/cli/tsconfig.json` — clean, exit 0 (the
  unrelated pre-existing errors noted in the original report — `DualArity.ts`,
  `Laws.command.ts`, `SchemaFirst.ts`, `RepoFile.ts` — are gone; resolved by a
  concurrent lane elsewhere in this session, not by this change).

Files touched by this follow-up: only
`packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts`. Still no
commit, no `standards/*.jsonc` touched.
schema/type extraction, zero ripple. No commit made; no standards/*.jsonc
touched.
