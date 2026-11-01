### fable-1-1
- file: scratchpad/effected/npm/RegistryCredential.ts:105
- class: law   severity: required
- standard: D9 + section 14 (deviation protocol); 2026-10-09 ruling: one ledger+README deviation entry per module per systemic class (tagged errors); law 7 / native-runtime `native-error`   evidence: Upstream `src/RegistryCredential.ts` throws `new RangeError(...)`; lab throws `InvalidBasicAuthUsernameError.make(...)`. The upstream test was adjusted: `scratchpad/test/npm/PackagePublish.test.ts:650` asserts `InvalidBasicAuthUsernameError` where upstream `__test__/PackagePublish.test.ts:644` asserts `RangeError`. Same class of change at `NpmRegistry.ts:375-382` and `PackagePublish.ts:444-451` (`Effect.die(new Error(...))` -> `Effect.die(Unstubbed*MethodError.make(...))`, a different defect class; tests only check `_tag === "Die"`). PORT_LEDGER.json row `w2-npm` has `deviations: []`; README Port notes say `### Deviations` / `None.` (README.md:280-282).
- failure: An observable deviation (different thrown error class, different defect class) with an adjusted upstream test is unrecorded, so a consumer catching `RangeError` silently stops matching and nothing in the ledger or README says why; section 14 requires the ledger entry before the code change.
- fix: Add one `deviations` entry to the `w2-npm` ledger row and one README `### Deviations` item (jsonc README format): test `scratchpad/test/npm/PackagePublish.test.ts:650` (adjusting upstream `__test__/PackagePublish.test.ts:644`), upstream `RangeError` -> lab `InvalidBasicAuthUsernameError`, plus the two `Effect.die` defect-class sites, reason `law:7` (native-runtime `native-error`).

### fable-1-2
- file: scratchpad/effected/npm/index.ts:83
- class: law   severity: required
- standard: D2 superset export rule (additions listed under README Port notes -> Added exports, ledger `exportsAdded`); .patterns/error-handling.md (typed errors are public contract)   evidence: `RegistryCredential.ts:23` exports a new `InvalidBasicAuthUsernameError`, thrown by the barrel-exported `basicCredentialFromPair`, but `index.ts:78-84` re-exports only `BasicCredential`, `RegistryCredential`, `TokenCredential`, `basicCredentialFromPair`. Ledger `exportsAdded: []`, README.md:276-278 `### Added exports` / `None.`. Precedent: jsonc row lists `JsoncEditOverlapError` (kind `both`, entry `.`) for the same law-7 replacement.
- failure: A consumer of the public entry cannot name or `catchTag` the error the public function throws; the parity ledger under-reports the public surface.
- fix: Add `InvalidBasicAuthUsernameError` to the `./RegistryCredential.ts` export block in `index.ts`, append `{ name: "InvalidBasicAuthUsernameError", kind: "both", entry: "." }` to the ledger row's `exportsAdded`, and list it under README `### Added exports`.

### fable-1-3
- file: scratchpad/effected/npm/ReleaseAgeGate.ts:52
- class: law   severity: required
- standard: D9 + section 14 (a different accepted input is a deviation); 2026-10-09 ruling naming `S.Finite` as a systemic class needing one ledger+README entry per module; forcing rule: effect-tsgo `schemaNumber`   evidence: `S.Number` -> `S.Finite` at ReleaseAgeGate.ts:52 (`PartialReleaseAgeGate.ageMinutes`), NpmRegistry.ts:123 (`RegistryReadError.status`), PublishError.ts:34 (`exitCode`), PackageTarball.ts:49 (`TarballError.status`), PackagePublish.ts:49-51 and :93-97 (`PackJsonEntry`/`PackedTarball` sizes). Ledger `deviations: []`, README `Deviations: None`. ReleaseAgeGate.ts:160-163 still documents that `PartialReleaseAgeGate` "does not constrain its ageMinutes".
- failure: `S.decodeEffect(PartialReleaseAgeGate)({ ageMinutes: Infinity })` now fails where upstream succeeded (upstream `combine` exists precisely to clamp non-finite contributions), and `RegistryReadError.make({ ..., status: NaN })` / `PublishError.make({ ..., exitCode: Infinity })` now throw at construction; none of this is recorded.
- fix: Add one `deviations` entry (ledger + README) for the `S.Finite` class listing the eight sites and the `schemaNumber` cause (`law:schemaNumber`), stating no upstream test needed adjustment, and correct the stale `combine` remark at ReleaseAgeGate.ts:160-163.

### fable-1-4
- file: scratchpad/effected/npm/PackagePublish.ts:271
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form) and law 13 (schema transformations over ad-hoc parsing); section 14 (cause class is an observable deviation)   evidence: `parsePackJson` decodes `PackJsonString = S.fromJsonString(S.Unknown)` (line 63) then `S.decodeUnknownEffect(PackJson)` with two identical `Effect.mapError(... PublishError.make({ kind: "output", subject, cause }))` steps (lines 272-278). `S.fromJsonString(PackJson)` is one codec with the same failure partition. Side effect of the tsgo `preferSchemaOverJson` rewrite: `PublishError.cause` for `not json` is now a `SchemaError`, upstream's was the `SyntaxError` from `JSON.parse` (test at PackagePublish.test.ts:375 checks only `kind`).
- failure: Two schemas and two error mappings express one transformation; the `cause` class change is unrecorded in the deviation entries.
- fix: `const PackJson = S.fromJsonString(S.Union([S.Array(PackJsonEntry), S.Record(S.String, PackJsonEntry)]))`; `parsePackJson = (stdout, subject) => S.decodeEffect(PackJson)(stdout).pipe(Effect.mapError((cause) => PublishError.make({ kind: "output", subject, cause })), Effect.flatMap(...))`; delete `PackJsonString`; mention the `cause` class in the module's deviation record.

### fable-1-5
- file: scratchpad/effected/npm/DependencySection.ts:24
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (`LiteralKit` for named internal literal domains); AGENTS.md Code Laws (named `LiteralKit` domains, `S.Literals` only for anonymous inline unions); D5 end-state (kit substitutions land in S4)   evidence: `export const DependencyKind = S.Literals(["prod", "dev", "peer", "optional"]).pipe($I.annoteSchema(...))` is a named exported domain with derived maps `KIND_TO_FIELD`/`FIELD_TO_KIND` (lines 54-66) and a `type DependencyKind = typeof DependencyKind.Type`. Sibling precedent at S1: `scratchpad/effected/commands/LocalExec.ts:25` `Launcher = LiteralKit([...]).pipe($I.annoteSchema(...))`.
- failure: The domain lacks `.Enum`, `.is`, `$match` and `toTaggedUnion`; consumers hand-spell literals (`KIND_TO_FIELD.prod`) instead of `DependencyKind.Enum.prod`.
- fix: `import { LiteralKit } from "@beep/schema/LiteralKit"` and `export const DependencyKind = LiteralKit(["prod", "dev", "peer", "optional"]).pipe($I.annoteSchema(...))`; `.literals` and the type export are unchanged (D2 kinds stay `both`).

### fable-1-6
- file: scratchpad/effected/npm/DependencySection.ts:39
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; AGENTS.md Code Laws; D5   evidence: `export const DependencyField = S.Literals(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]).pipe(...)`, a named exported domain iterated via `DependencyField.literals` in Manifest.ts:87 and :262 and used as a field schema in `UnresolvedDependencyError`.
- failure: Same as fable-1-5: a named literal domain without kit helpers; `S.Literals` is reserved for anonymous inline unions.
- fix: `export const DependencyField = LiteralKit([...]).pipe($I.annoteSchema(...))` (LiteralKit extends `S.Literals`, so `.literals`, `annotateKey` and the Manifest.ts uses keep working).

### fable-1-7
- file: scratchpad/effected/npm/PackageManagerCache.ts:34
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5   evidence: `export const CachingPackageManager = S.Literals(["npm", "pnpm", "yarn-classic", "yarn-berry", "bun"]).pipe($I.annoteSchema(...))`, named, exported, and dispatched on by `defaultDirectory` through `Match.value(manager).pipe(Match.when("npm", ...), ..., Match.exhaustive)` (lines 125-144).
- failure: Named literal domain without kit helpers; the five-way dispatch re-spells every literal instead of using the kit's `$match`.
- fix: `export const CachingPackageManager = LiteralKit([...]).pipe($I.annoteSchema(...))`; optionally `CachingPackageManager.$match(manager, { npm: () => ..., ... })` in `defaultDirectory`.

### fable-1-8
- file: scratchpad/effected/npm/PackageManagerPin.ts:92
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (derive guards with `S.is(...)`) and law 19 (`LiteralKit` for named domains); AGENTS.md Code Laws (derived `S.is(...)` guards over ad-hoc predicate helpers)   evidence: `export const PackageManagerPinName = S.Literals(["npm", "pnpm", "yarn", "bun"]).pipe(...)` at :92 and a hand-rolled guard `const isPinName = (value: string): value is PackageManagerPinName => value === "npm" || value === "pnpm" || value === "yarn" || value === "bun"` at :102-103 used by `parseResult` (:223). Two sources of truth for one domain; `commands/LocalExec.ts:25` models the identical set as a `LiteralKit`.
- failure: Adding or removing a manager in the schema does not change `parseResult`'s acceptance; the guard can drift from the schema unnoticed.
- fix: `export const PackageManagerPinName = LiteralKit(["npm", "pnpm", "yarn", "bun"]).pipe($I.annoteSchema(...))` and `const isPinName = S.is(PackageManagerPinName)` (delete the hand-written predicate).

### fable-1-9
- file: scratchpad/effected/npm/RegistryKind.ts:19
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5   evidence: `export const RegistryKind = S.Literals(["npm", "github-packages", "jsr", "custom"]).pipe($I.annoteSchema(...))`, named and exported; `registryShortLabel` (:154-161) and `registryDisplayName` (:184-190) each re-spell all four literals in `Match.when` chains over `classifyRegistry(registry)`.
- failure: Named literal domain without kit helpers; two four-way dispatches duplicate the literal list by hand.
- fix: `export const RegistryKind = LiteralKit([...]).pipe($I.annoteSchema(...))`; the two label functions can become `RegistryKind.$match(classifyRegistry(registry), { npm: () => "npm", ... })`.

### fable-1-10
- file: scratchpad/effected/npm/IntegrityHash.ts:51
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; standards/schema-first-development-prompt.md ("export its runtime type from the same identifier: `export type Name = typeof Name.Type`"; Pattern 1, no parallel type + validator)   evidence: `export type IntegrityAlgorithm = "sha1" | "sha224" | "sha256" | "sha384" | "sha512"` (:51) next to a second, anonymous copy `const isIntegrityAlgorithm = S.is(S.Literals(["sha1", "sha224", "sha256", "sha384", "sha512"]))` (:53) introduced by the port for `algorithmOf` (:80-87).
- failure: The algorithm domain is written twice (type and schema) and can drift; the guard's schema is unnamed and unannotated.
- fix: `export const IntegrityAlgorithm = LiteralKit(["sha1", "sha224", "sha256", "sha384", "sha512"]).pipe($I.annoteSchema("IntegrityAlgorithm", {...}))`; `export type IntegrityAlgorithm = typeof IntegrityAlgorithm.Type`; `const isIntegrityAlgorithm = S.is(IntegrityAlgorithm)`; add the value export to `index.ts`, ledger `exportsAdded` and README Added exports (upstream kind `type` becomes `both`, a D2 superset).

### fable-1-11
- file: scratchpad/effected/npm/DependencySpecifier.ts:57
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5 (`LiteralKit` for literal domains)   evidence: `export type DependencyProtocol = "range" | "tag" | ... | "unknown"` is an 11-literal hand-rolled union, the return domain of the public `protocolOf` (:109-124), with no schema value behind it.
- failure: A public literal domain exists only at the type level: no `.Enum`, no `S.is` guard, no `$match`, not decodable, not annotated with `$ScratchpadId` identity (D5).
- fix: `export const DependencyProtocol = LiteralKit(["range", "tag", "git", "url", "npm", "file", "link", "portal", "catalog", "workspace", "unknown"]).pipe($I.annoteSchema(...))`; `export type DependencyProtocol = typeof DependencyProtocol.Type`; export the value from `index.ts` and list it under Added exports / `exportsAdded`.

### fable-1-12
- file: scratchpad/test/npm/WorkspaceResolver.test.ts:107
- class: law   severity: required
- standard: Section 11.1 (S1: upstream tests verbatim) and section 16 (never weaken a test); 2026-10-09 ruling: deliberate wrong-input casts go through `scratchpad/test/<m>/deliberatelyInvalid.ts`, the one shape D15's scan admits   evidence: Upstream `__test__/WorkspaceResolver.test.ts:99-103` asserts the constructor rejects an out-of-union reason: `assert.throws(() => DependencyResolutionError.make({ specifier: "workspace:x", reason: "bogus" as never, cause: undefined }))`. The lab test (:107-118) instead decodes from unknown via `Result.getOrThrow(S.decodeUnknownResult(DependencyResolutionError)({ _tag: ..., reason: "bogus", ... }))`. No `scratchpad/test/npm/deliberatelyInvalid.ts` exists.
- failure: The constructor path is no longer under test: a `make` that stopped validating `reason` would still pass, because decoding an unknown record is a different code path from constructing with a wrong literal.
- fix: Add `scratchpad/test/npm/deliberatelyInvalid.ts` (`export const deliberatelyInvalid = <T>(value: unknown): T => value as T`, the single admitted cast) and restore the upstream assertion: `assert.throws(() => DependencyResolutionError.make({ specifier: "workspace:x", reason: deliberatelyInvalid<"mechanism" | "no-version">("bogus"), cause: undefined }))`.

### fable-1-13
- file: scratchpad/effected/npm/RegistryCredential.ts:36
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md Pattern 1 (schema owns pure data; interfaces only for service contracts/ports) and standards/effect-laws-v1.md law 20 (finite variants as discriminated unions); D5 (full beep-native)   evidence: `TokenCredential` (:36-40), `BasicCredential` (:62-66) and `export type RegistryCredential = TokenCredential | BasicCredential` (:80) are exported data models with a `kind` discriminant carrying `Redacted` secrets; `NpmRegistry.ts:146-150` branches on `credential.kind === "token"` by hand and `basicCredentialFromPair` builds the record as an untyped object literal. v4 has `S.Redacted(S.String)` (Schema.d.ts:10210).
- failure: The credential union is not decodable, annotatable or `S.is`-guardable, and the carve-out for interfaces (service contracts, ports) does not cover a pure data value.
- fix: `export class TokenCredential extends S.Class<TokenCredential>($I`TokenCredential`)({ kind: S.Literal("token"), token: S.Redacted(S.String) }, $I.annote(...)) {}`, same for `BasicCredential` (`encoded: S.Redacted(S.String)`), `export const RegistryCredential = S.Union([TokenCredential, BasicCredential]).pipe($I.annoteSchema(...))` with `export type RegistryCredential = typeof RegistryCredential.Type`; keep the upstream names (D2: `type` -> `both`, listed under Added exports); `basicCredentialFromPair` returns `BasicCredential.make({...})`.

### fable-1-14
- file: scratchpad/effected/npm/ReleaseAgeGate.ts:70
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); effect-tsgo `schemaNumber` doc (`.check(isFinite)` on `S.Number` is exempt)   evidence: `const AgeMinutes = S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isFinite())`; in v4 `S.Finite` is already `Number.check(isFinite())`, so `Infinity` now fails two identical filters, and the comment above (:64-69) still describes the upstream `S.Number` + `isFinite` composition.
- failure: A redundant check that doubles the issue list for a non-finite age and a comment that no longer matches the code.
- fix: `const AgeMinutes = S.Finite.check(S.isGreaterThanOrEqualTo(0))` (or restore upstream `S.Number.check(S.isGreaterThanOrEqualTo(0), S.isFinite())`, which `schemaNumber` exempts) and update the comment.

### fable-1-15
- file: scratchpad/effected/npm/NpmExecutor.ts:12
- class: effect-idiom   severity: backlog
- standard: node_modules/effect/CLAUDE.md (`Effect.fn("name")` when a span is useful, `fnUntraced` for library internals; name should match the function); law 22   evidence: `const command = Effect.fn("command")(function* (spec, all) ...)` was extracted from the inline `Effect.gen` in `NpmExecutor#command` (upstream :130-144, no span). Every other span in the module is service-qualified (`Manifest.decode`, `NpmRegistry.versions`, `PackageTarball.extract`).
- failure: Traces gain an unqualified `command` span that upstream never emitted; the name collides with any other module's `command` helper.
- fix: Use `Effect.fnUntraced` (upstream tracing parity) or name it `"NpmExecutor.command"`.

### scratchpad/effected/npm/NpmExecutor.ts:104
- file: scratchpad/effected/npm/NpmExecutor.ts:104
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: Adjacent single-key spreads `...O.getSomesStruct({ spec: O.fromUndefinedOr(this.spec) }), ...O.getSomesStruct({ extraArgs: O.fromUndefinedOr(this.extraArgs) })` at NpmExecutor.ts:104-106 and :129-130, and three in a row at PackagePublish.ts:358-360 and :431-433. `getSomesStruct` takes a whole struct of Options.
- failure: One helper call expressed as two or three; purely cosmetic, no behaviour change.
- fix: Collapse each run into one call: `...O.getSomesStruct({ spec: O.fromUndefinedOr(this.spec), extraArgs: O.fromUndefinedOr(this.extraArgs) })` (likewise `packedSize`/`unpackedSize`/`fileCount`).

### fable-1-17
- file: scratchpad/effected/npm/PackagePublish.ts:234
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws (prefer effect helper modules over native helpers); standards/effect-laws-v1.md law 21   evidence: `const hex = (bytes: Uint8Array): string => A.fromIterable(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")`; installed effect ships `effect/encoding/Hex` with `encode: (input: Uint8Array | string) => string` (Hex.d.ts:33) producing the same lowercase two-digit-per-byte string.
- failure: A hand-rolled hex encoder where the library has one; no behaviour difference.
- fix: `import * as Hex from "effect/encoding/Hex"` and `sha256Hex: Hex.encode(digest)`; delete `hex`.

### fable-1-18
- file: scratchpad/effected/npm/PackageTarball.ts:110
- class: schema   severity: backlog
- standard: crispen (literal families written once); standards/effect-laws-v1.md law 19   evidence: `fail`'s parameter re-spells the five `TarballError.reason` literals by hand (`reason: "notFound" | "http" | "integrityMismatch" | "integrityUnverifiable" | "extractFailed"`) while the schema at :43 is the source of truth (upstream shape, no behaviour change).
- failure: Adding a reason to the error schema does not reach the helper's signature.
- fix: Lift the reason into `const TarballReason = LiteralKit([...])` used by both the field and `fail` (or type the parameter as `typeof TarballError.fields.reason.Type`).

### fable-1-19
- file: scratchpad/effected/npm/README.md:274
- class: docs   severity: backlog
- standard: D4 (README adapted); section 10.3   evidence: Line 274, inside `### Attribution`, reads `- scratchpad/effected/npm/DependencySection.ts:10 // `KIND_TO_FIELD` is the single source of truth; the inverse is derived from it,` - a leaked grep line, not an attribution bullet.
- failure: The attribution list carries a stray source-comment fragment.
- fix: Delete line 274.

### fable-1-20
- file: scratchpad/effected/npm/README.md:49
- class: docs   severity: backlog
- standard: D4 / section 10.3 README adaptation; standards/effect-laws-v1.md law 2 (root `effect` barrel not used in Markdown examples)   evidence: README examples still import `from "@effected/npm"` (lines 49, 81, 109, 129, 149, 164, 185, 202) and `from "effect"` (50, 82, 110, 131, 165, 186, 203); the Install section (31-35) still says `npm install @effected/npm effect`.
- failure: The adapted README documents the upstream package, not the lab module, and its examples violate law 2.
- fix: During S2 rewrite examples to `./index.ts` and per-module `effect/<Module>` imports and replace the Install section with the lab import path.

### fable-1-21
- file: scratchpad/effected/npm/index.ts:1
- class: docs   severity: backlog
- standard: D4 (every JSDoc body carried, never dropped); section 16 (never author `@module`)   evidence: Upstream `src/index.ts:1-14` opens with a `@packageDocumentation` overview (contracts, no-op layers, typed errors, `Manifest`); the lab `index.ts` starts at the `Layer` import with that prose removed, not converted.
- failure: The module overview body is lost rather than carried on a beep carrier.
- fix: Carry the prose into the README overview (or a plain leading comment without `@packageDocumentation`) during S2.

### fable-1-22
- file: scratchpad/effected/npm/RegistryCredential.ts:9
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled `**Example** (Title)` carriers; no `@example`/`@remarks`); S2 pending   evidence: The new `InvalidBasicAuthUsernameError` doc (:9-21) already uses `**Example** (Inspecting a rejected username)`, `@category errors`, `@since 0.0.0`, while every other export in the file and module still carries upstream `@example`/`@remarks`; `@throws InvalidBasicAuthUsernameError` at :93 references the new class.
- failure: Mixed documentation carriers inside one module until S2 runs.
- fix: Leave for S2; convert the remaining carriers in the file in that pass.

### fable-1-23
- file: scratchpad/test/npm/CatalogResolver.test.ts:30
- class: test   severity: backlog
- standard: D5 (`effect/HashMap|HashSet|MutableHashMap|MutableHashSet` only); section 16 (never native `Set`/`Map`); the laws skip test files by scope (runner/Gates.ts:531-535), so the gate did not see these   evidence: `new Map<string, Map<string, string>>([...])` at CatalogResolver.test.ts:30-33 and Manifest.test.ts:110-112, `new Set(readdirSync(SRC)...)` at reachability.test.ts:102.
- failure: Native collections in test doubles; the S3 canon pass will have to touch them anyway.
- fix: `HashMap.fromIterable` with `O.flatMap(HashMap.get(catalogs, name), HashMap.get(packageName))` for the stubs and `HashSet.fromIterable` in reachability.

### fable-1-24
- file: scratchpad/test/npm/NpmRegistry.test.ts:1
- class: tsgo   severity: backlog
- standard: `lint:tsgo-rules` directive gate (Quality.command.ts:386-388 admits `@effect-diagnostics` directives only in `vitest.setup.ts`, `vitest.shared.ts`, `test-utils/src/FileSystemConformance.ts`); brief: tsgo gate "with every Effect rule at error"   evidence: `// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file` (NpmRegistry.test.ts:1), `strictEffectProvide:skip-file asyncFunction:skip-file` (PackageTarball.test.ts:1), `strictEffectProvide:skip-file` (PackagePublish.test.ts:1), `nodeBuiltinImport:skip-file` (reachability.test.ts:1). 232 such lines across scratchpad/test, so this is lab-wide practice, but for these four files the named rules are off, not at error.
- failure: The rules are not enforced on these files and the repo policy lane will reject the directives at promotion.
- fix: Fix the sites (provide layers once through `it.layer`, read source through `FileSystem`) or narrow to per-line `:off` with a reason; decide lab-wide rather than per module.

### fable-1-25
- file: scratchpad/effected/npm/PackagePublish.ts:105
- class: schema   severity: backlog
- standard: standards/schema-first-development-prompt.md Pattern 1 (schema owns pure data; interfaces only for service contracts/ports); standards/effect-laws-v1.md law 20   evidence: Exported data-shaped interfaces remain interfaces: `PublishOutcome` (:105), `DryRunOutcome` (:125, `ok: boolean` plus optional size fields), `PackOptions` (:142), `PublishOptions` (:152); `SeededVersion`/`RegistrySeed` (NpmRegistry.ts:393-416); `DefaultCacheDirectoryOptions` (PackageManagerCache.ts). Service shapes (`NpmRegistryShape`, `PackagePublishShape`, `PackageTarballShape`) are covered by the carve-out.
- failure: Pure data models without schemas: not decodable, not annotated, `DryRunOutcome`'s `ok` flag models a finite variant as a boolean bag.
- fix: Model each as `S.Class`/`S.Struct` with `$I.annote` (keep the upstream names; kinds go `type` -> `both` and are listed under Added exports); consider `DryRunOutcome` as a tagged union of `packable`/`unpackable`.

REQUIRED: 13
BACKLOG: 12
