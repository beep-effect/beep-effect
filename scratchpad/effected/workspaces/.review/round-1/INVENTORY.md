# workspaces — round-1 merged inventory

Read all 12 seat reports (grok, sol and fable in part-1 through part-4), all four adjacent BRIEF.md files, the complete operator revision/rulings/grilling block, D1–D20, §§12.4–12.5 and §14, and all seven module allowlist entries. The briefs review `3fa5876691901fccf3d1cd29e9324564df134b56` against pinned upstream `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. All 124 original seat records are accounted for.

**Required: 60 · Backlog: 27 · Codemod: 7 · Rejected: 8 · Groups: 8.** Counts are merged disposition records, not the seats' original totals. IDs in `seats:` are qualified by part because each part reused seat-local IDs. Compound reports are split by independent defect or systemic class; distinct implementations of the same general law are separate defects. Repeated reports of a defect are deduplicated. Allowlist findings are one per entry in file order, even where issue labels repeat.

`required.json` owns 32 source files and 36 test files in eight non-overlapping groups, with at most six source files per group. It assigns only module-local source/tests. No root manifest, lockfile, shared configuration, PORT_LEDGER.json, diagnostic registry or README Port notes is a repair-group write surface. All D9 deviation/export bookkeeping remains central, including records for newly verified upstream bugs; the in-surface code/test fixes remain required. Native allowlist deletion is also central; groups replace the implementations only. S2/S3 findings stay backlog. Green-gate claims below come from the briefs; no runtime gate was rerun for this inventory.

## Required

### r01

- file: scratchpad/effected/workspaces/LockfileReader.ts:54
- class: schema   severity: required
- standard: `standards/effect-first-development.md`, “Tagged error with Identity composer” template: cause-carrying errors explicitly use `S.Defect({ includeStack: true })`; D11.
- evidence: A read-only `bun -e` probe encoded `LockfileReadError`, `ChangeDetectionError` and `LayerPolicyError` with an `Error("original")` cause. Each encoded cause contained only `{ name: "Error", message: "original" }`. The control using `S.Defect({ includeStack: true })` retained `stack`. The same omission exists in `ChangeDetector.ts:87` and `LayerPolicy.ts:38`.
- failure: Serializing these errors loses the originating failure’s stack, contrary to the explicit error-schema requirement. The green type and lint gates do not establish stack preservation.
- fix: Change these three cause fields to `S.Defect({ includeStack: true })`, retaining their field annotations. Add the smallest stack-preserving encoding assertion.
- seats: part-1/sol-1-1
- group: g1

### r02

- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:101
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; D5 and D11.
- evidence: `PeerDependencyRules` is a pure record-and-array payload declared only as an interface. The same applies to `HookReplayContext` at line 161, `HookReplay` at line 190 and `HookInjection` at line 211. `HookReplaySource` at line 141 is a handwritten literal union. Runtime validation separately reimplements parts of these shapes through `stringArrayOr`, `isStringRecord` and `peerRulesOr`.
- failure: The replay configuration, provenance and result models have no schema source of truth. Their types and tolerant validation logic can diverge independently; the required schema-derived construction, guards and codecs are unavailable. These are data payloads, beyond the permitted service-contract interface exception.
- fix: Define annotated schemas for these payloads and derive their existing type names from `.Type`; model `HookReplaySource` with `LiteralKit`. Preserve the plain external object shapes and current tolerant threading semantics, deriving the applicable guards from the schemas rather than introducing stricter hook rejection.
- seats: part-1/sol-1-2
- group: g1

### r03

- file: scratchpad/effected/workspaces/LockfileReader.ts:114
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5; `standards/effect-first-development.md` EF-33; D11.
- evidence: `LockfileReaderOptions` consists solely of the optional configuration fields `cwd` and `stopAt`, but is declared as an interface and has no corresponding runtime schema. `LockfileReaderShape` is a service contract and qualifies for the interface exception; this options payload does not.
- failure: Root-resolution configuration remains a handwritten data model, so its shape, optionality and future codecs cannot derive from one executable contract.
- fix: Add an annotated options schema and derive `LockfileReaderOptions` from its `.Type`. Preserve the existing distinction between `cwd?: string` and `stopAt?: string | undefined`, and retain lazy cwd resolution.
- seats: part-1/sol-1-3
- group: g1

### r04

- file: scratchpad/effected/workspaces/PackageManagerName.ts:126
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/ARCHITECTURE.md`, Core Principle 5; D11.
- evidence: `ManagerHint` is a named internal domain value containing only `name: string` and `version: O.Option<string>`. It is modeled as an interface, while `devEnginesHint` and `corepackHint` construct separate object literals implementing that shape.
- failure: The normalized manager-hint model has no executable schema despite being directly representable by Schema. Its two construction paths and its type definition remain independent.
- fix: Define one annotated `ManagerHint` schema, derive its type, and construct normalized hints through it. Keep the existing behavior that malformed hints are ignored and an invalid version drops only the version.
- seats: part-1/sol-1-4
- group: g1

### r05

- file: scratchpad/effected/workspaces/PackageManagerName.ts:36; scratchpad/effected/workspaces/PackageManagerName.ts:63
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-35; D5 and D11.; standards/effect-laws-v1.md law 19; D5 (kits land in S4); schema-first-development fast rule for named literal domains; standards/effect-laws-v1.md law 19; D5; schema-first-development; standards/effect-laws-v1.md law 19 (LiteralKit for named literal domains); EFFECTED_PORT_GOAL.md D5 ('LiteralKit for literal domains', applied at S4); AGENTS.md Code Laws ('named LiteralKit internal domains')
- evidence: Both `PackageManagerName` at line 36 and `PackageManagerEvidence` at line 63 are named, reused, annotation-bearing literal domains implemented with `S.Literals`. A read-only probe confirmed their `.Enum` and `.$match` helpers are absent.
- failure: These named domains do not meet the required `LiteralKit` idiom. Consumers must keep spelling literal values and branching independently of the domain’s derived helper surface.
- fix: Replace the two `S.Literals(...)` constructors with `LiteralKit(...)`, retaining annotations, same-name type aliases and the exact literal order. The evidence order is observable and must remain unchanged.
- seats: part-1/sol-1-5, part-1/grok-1-1, part-1/grok-1-2, part-1/fable-1-3
- group: g1

### r06

- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:69; scratchpad/effected/workspaces/ConfigDependencySpec.ts:67
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18: reusable custom checks carry `identifier`, `title` and `description`; D11.; standards/effect-laws-v1.md law 18 (named/reusable `S.makeFilter` carries identifier, title, description)
- evidence: The named `specVersion` schema contains a reusable `S.makeFilter` with no metadata argument. A read-only inspection of `ConfigDependencySpec.fields.version.ast.checks` returned a filter with `annotations: undefined`.
- failure: The constraint rejecting build metadata has no identifying or descriptive check metadata. Annotating the enclosing class and field does not annotate the filter itself.
- fix: Supply the filter’s metadata argument with a namespaced `$I` identifier, title and description. Keep its predicate and existing failure text unchanged.
- seats: part-1/sol-1-6, part-1/fable-1-14
- group: g1

### r07

- file: scratchpad/effected/workspaces/LayerPolicy.ts:98
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18; D11.
- evidence: The reusable glob-compilation filter supplies only `{ title: "compilable glob patterns" }`. A read-only inspection of `LayerPolicy.fields.unconstrained.ast.checks` confirmed that `identifier` and `description` are absent.
- failure: The policy’s custom glob constraint does not satisfy the required check metadata contract. Its enclosing field description cannot supply the missing filter identity and description.
- fix: Add a namespaced `$I` identifier and description to the existing filter metadata, preserving its title and validation behavior.
- seats: part-1/sol-1-7
- group: g1

### r08

- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:131
- class: schema   severity: required
- standard: D5 requires identity annotations on every exported schema; `standards/effect-first-development.md`, schema annotation requirements; D11.
- evidence: The public static codec `ConfigDependencySpec.FromString` is constructed without an identity annotation. A read-only probe of `ConfigDependencySpec.FromString.ast.annotations` returned `undefined`; the annotation on `ConfigDependencySpec` does not transfer to this separate transformation schema.
- failure: The exported string codec lacks its own schema identity, title and description, leaving the annotation migration incomplete for this public runtime schema.
- fix: Annotate the completed codec through `$I.annoteSchema(...)` with a distinct codec identifier and meaningful description, preserving its declared `S.Codec<ConfigDependencySpec, string>` contract and transformation behavior.
- seats: part-1/sol-1-8
- group: g1

### r09

- file: scratchpad/effected/workspaces/PackageManagerName.ts:132
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (reused domain constraints are schemas first; derive guards with `S.is(...)`); law 13 (schema transformations over ad-hoc parsing)
- evidence: `isPlainObject` is a hand-rolled predicate (`P.isObjectKeyword && !P.isFunction && !A.isArray`) used at :160, :163 and :311, and the same constraint is re-spelled inline at LayerPolicy.ts:23 (`withoutKeys`). Probe against installed effect 4.0.2: `S.decodeUnknownResult(S.Record(S.String, S.Unknown))` rejects `[1,2]`, `null` and `() => 1` and accepts `{a:1}`, i.e. identical semantics to the predicate, so `S.is(JsonObject)` is a drop-in guard (D9 preserved).
- failure: The manifest-object constraint lives in two hand-written predicates instead of one schema; `manifestOf` decodes JSON with `S.Unknown` and then re-checks the shape by hand, duplicating what the schema layer already expresses.
- fix: Define an annotated JsonObject schema in PackageManagerName.ts, derive isPlainObject with S.is, and reuse that schema-derived guard in LayerPolicy.ts instead of spelling the constraint twice. Preserve array/null/function rejection and tolerant manifest handling; use only these existing source files.
- seats: part-1/fable-1-4
- group: g1

### r10

- file: scratchpad/effected/workspaces/DependencyGraph.ts:162
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native `Array.prototype.sort`; use `A.sort` with an explicit `Order`)
- evidence: Ten native `.sort()` sites: :162, :218, :228, :253, :359, :366, :391, :411, :426, :430. The gate missed them: `NoNativeRuntime.ts:463` only reports `nativeSort` when `inHotspotScope`, and `NoNativeRuntimeHotspots.ts` lists `scratchpad/effect-ontology/` but not `scratchpad/effected/`. Sibling files in this module already comply (`VersioningStrategy.ts:148`, `internal/packedInstallPlan.ts:98` use `A.sort(..., Str.Order)`). Behaviour is unchanged: `Order.String` and the default comparator both order strings by UTF-16 code units.
- failure: Law 10 violation the hotspot-scoped gate cannot see; the module is inconsistent with itself on the ordering idiom.
- fix: Replace each `[...xs].sort()` with `A.sort(A.fromIterable(xs), Str.Order)` and `current.sort()` / `next.sort()` with `current = A.sort(current, Str.Order)` (import `* as Str from "effect/String"`).
- seats: part-1/fable-1-5
- group: g2

### r11

- file: scratchpad/effected/workspaces/ChangeDetector.ts:184
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native `Array.prototype.sort`; use `A.sort` with an explicit `Order`)
- evidence: `[...committed].sort()` at :184 and `[...MutableHashSet.fromIterable([...committed, ...working])].sort()` at :187; same gate gap as fable-1-5 (hotspot-scoped `nativeSort` rule, `scratchpad/effected/` not a hotspot). String ordering is identical under `Str.Order`, so D9 holds.
- failure: Law 10 violation outside the gate's scope.
- fix: `A.sort(A.fromIterable(committed), Str.Order)` and `A.sort(A.fromIterable(MutableHashSet.fromIterable([...committed, ...working])), Str.Order)`.
- seats: part-1/fable-1-6
- group: g1

### r12

- file: scratchpad/effected/workspaces/ReleaseTag.ts:28
- class: schema   severity: required
- standard: D5; schema-first fast rule (named literal domains are `LiteralKit`; `S.Literals` only for an anonymous inline union never referenced by name). `schemaUnionOfLiterals` only flags `Schema.Union` of `Schema.Literal` members, and schema-first lint scans `packages/**`, so neither gate sees this.; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-35; D5.
- evidence: `TagStyle` is a named, exported, annotation-bearing literal schema implemented with `S.Literals`. `VersioningStrategyType` has the same construction at `VersioningStrategy.ts:36`. Both declarations remain in the reviewed commit despite the stated green gates; the module’s port notes and ledger record no exception.
- failure: `TagStyle` is an exported literal domain built with `S.Literals`. It decodes the same two strings as upstream and has no `.Enum`, `.is`, or `.$match`. `jsonc` (`NavigateContainer`) is the D5 bar and uses `LiteralKit`.
- fix: `import { LiteralKit } from "@beep/schema/LiteralKit"` and `LiteralKit(["single", "scoped"]).pipe($I.annoteSchema("TagStyle", { description: "..." }))`. Keep `export type TagStyle = typeof TagStyle.Type`. Decode stays the same.
- seats: part-2/grok-1-1, part-2/sol-1-6
- group: g3

### r13

- file: scratchpad/effected/workspaces/VersioningStrategy.ts:36; scratchpad/effected/workspaces/ReleaseTag.ts:28
- class: schema   severity: required
- standard: D5; schema-first fast rule, same gate gap as grok-1-1.; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-35; D5.
- evidence: `TagStyle` is a named, exported, annotation-bearing literal schema implemented with `S.Literals`. `VersioningStrategyType` has the same construction at `VersioningStrategy.ts:36`. Both declarations remain in the reviewed commit despite the stated green gates; the module’s port notes and ledger record no exception.
- failure: `VersioningStrategyType` is an exported literal domain (`"single" | "fixed-group" | "independent"`) built with `S.Literals`, then used as the `type` field. Callers get no kit helpers. Classification results are unchanged.
- fix: Same swap as grok-1-1: `LiteralKit(["single", "fixed-group", "independent"]).pipe($I.annoteSchema(...))`. Leave the `type` field pointing at that const.
- seats: part-2/grok-1-2, part-2/sol-1-6
- group: g3

### r14

- file: scratchpad/effected/workspaces/PeerCheck.ts:93
- class: schema   severity: required
- standard: schema-first development, "Derive behavior instead of duplicating truth" and the named-domain `LiteralKit` rule; D5. D2 parity stays green: `exportKindCovers("both", "type")` is true.
- evidence: `UnverifiedReason` is a hand-written four-string union, and `PeerCheck.unverified` repeats those strings as `S.Literals` at line 709. The copies match today. Adding a reason to one side does not update the other, so `PeerCheck.make` and the push sites can disagree.
- failure: `UnverifiedReason` is a hand-written four-string union, and `PeerCheck.unverified` repeats those strings as `S.Literals` at line 709. The copies match today. Adding a reason to one side does not update the other, so `PeerCheck.make` and the push sites can disagree.
- fix: One `LiteralKit` of the four strings, exported under the same name, `export type UnverifiedReason = typeof UnverifiedReason.Type`, and use that kit as the `unverified` element schema. No new reason, no new decode.
- seats: part-2/grok-1-3
- group: g2

### r15

- file: scratchpad/effected/workspaces/SourceBoundary.ts:110
- class: schema   severity: required
- standard: D5; schema-first fast rule (`S.Literals` is for an inline union never referenced by name). `OffenceRule` at line 136 is that name. Parity accepts widening the type-only export to `both`.
- evidence: The seven offence rules live in an anonymous `S.Literals`, and `export type OffenceRule = Offence["rule"]` only re-exports the decoded union. The public domain has no `.is` or `.Enum`. `scan` and `check` still emit the same rule strings.
- failure: The seven offence rules live in an anonymous `S.Literals`, and `export type OffenceRule = Offence["rule"]` only re-exports the decoded union. The public domain has no `.is` or `.Enum`. `scan` and `check` still emit the same rule strings.
- fix: `export const OffenceRule = LiteralKit(["process", "node:process", "stdout-write", "console", "console-stdout", "forbidImports", "forbidTokens"]).pipe($I.annoteSchema(...))`, `export type OffenceRule = typeof OffenceRule.Type`, and set `Offence.rule` to that kit.
- seats: part-2/grok-1-4
- group: g4

### r16

- file: scratchpad/effected/workspaces/PeerCheck.ts:275
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `PeerCheck.run`’s documented requirement to retain `unresolvedEdge` for an uncovered link target.
- evidence: A read-only `bun -e` probe parsed a pnpm lockfile with a root dependency on `link:../packages/a`, an internal importer at `packages/a`, and a supplied manifest for that internal package. Both the port and pinned oracle returned `unverified: []` and reported the internal package’s missing `react` peer. Replacing the link with `link:../../packages/a` produced the same result. `linkTargetPath` discards `..` when its accumulated path is empty.
- failure: A dependency outside the workspace is joined to an unrelated internal package with the same remaining path. The report attributes that internal package’s peers to the external dependency and claims the link was verified, although the external manifest was never supplied or examined.
- fix: Preserve unmatched leading `..` segments during normalization, and never cancel an existing `..` with another `..`. An external target must remain distinct from a workspace-relative target and retain the unverified marker. Add a regression for a root link escaping the workspace.
- seats: part-2/sol-1-1
- group: g2

### r17

- file: scratchpad/effected/workspaces/SourceBoundary.ts:666
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `SourceBoundary.scan`’s path-specific `allow` and `allowRules` contract.
- evidence: An in-memory `bun -e` probe scanned `/repo/src/a.ts` containing `process.cwd()`, with `allow: ["zallowed/**"]`. Without an alias, both the port and pinned oracle reported `src/a.ts:1:18 process process`. Adding `/repo/zallowed` as a symlink to `/repo/src` changed both results to `files: ["zallowed/a.ts"]`, `allowed: ["zallowed/a.ts"]`, and `violations: []`.
- failure: The global realpath visited set lets the first directory alias determine the waiver policy for every alias of that directory. An allowed symlink can therefore suppress an offence under an unallowed source path. The same issue affects `allowRules`.
- fix: Use ancestry-based realpath cycle detection instead of globally dropping previously visited directories, so distinct logical paths receive their own waiver evaluation while ancestor cycles remain bounded. Add the allowed-alias regression.
- seats: part-2/sol-1-2
- group: g4

### r18

- file: scratchpad/effected/workspaces/PackedInstall.ts:1221
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the `PackedInstallResult.tarballs` contract identifies each packed package by name.
- evidence: A read-only `bun -e` probe used `MemoryFileSystem` and `ScriptedSpawner`, with discovery naming the carrier `carrier` but the tarball manifest naming it `wrong-package`. Both the port and pinned oracle succeeded and returned `{"carrier":"/scratch/tarballs/0/wrong.tgz"}`. The port also recorded the consumer’s carrier as `carrier`. No real package-manager process or disk write was involved. Manifest-name validation exists for replacement packages at line 1267, but the workspace closure bypasses it.
- failure: A stale or incorrectly selected build artifact can pass the packed-install proof under another package’s identity. The result claims it packed the requested carrier even though the archive’s manifest identifies a different package.
- fix: Check each workspace tarball manifest’s `name` against the closure package’s name before accepting it or installing consumers; fail `PackFailed` on a mismatch or missing name. Add a mismatched-carrier regression.
- seats: part-2/sol-1-3
- group: g5

### r19

- file: scratchpad/effected/workspaces/ReleaseTag.ts:283
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `classifyTag` accepts arbitrary tag strings, and the retained `TrackingTag.test.ts:102` contract says non-derivable versions return an empty result without throwing.
- evidence: Read-only probes against both the port and pinned oracle produced `Schema validation failed` for `classifyTag("v9007199254740992")` and `TrackingTag.forVersion("9007199254740992.2.3")`. The digit grammar accepts these inputs, but their converted numeric fields fail `TrackingTag`’s `S.Int` construction.
- failure: An arbitrary repository tag or version containing an oversized numeric component aborts these query APIs with a synchronous exception instead of returning `unrecognized` or an empty alias list.
- fix: Validate converted major/minor values against the existing integer field schemas before constructing a `TrackingTag`. Return `unrecognized` from the tracking-classification branch and `[]` from alias derivation when those fields cannot be represented. Add both overflow regressions.
- seats: part-2/sol-1-4
- group: g3

### r20

- file: scratchpad/effected/workspaces/ReleaseTag.ts:81
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `versionCore`’s documented `X.Y.Z[-pre][+build]` grammar and the retained classifier test that junk remains `unrecognized`.
- evidence: Read-only probes showed that `SemVer.parseResult` rejects `"1.2.3+"`, `"1.2.3+bad/path"`, `"1.2.3-"`, and `"1.2.3-01"`, while both the port and pinned oracle classify all four as releases. Both also derive `v1` and `v1.2` from the first two inputs. The implementation discards build metadata and removes the prerelease suffix without validating either suffix.
- failure: Malformed version text is presented as a release, and malformed build metadata can produce stable floating aliases. Invalid suffixes receive the same classification as valid release versions.
- fix: Validate the complete version grammar before extracting its numeric core, preserving the existing treatment of valid build metadata and prereleases. Keep the separate truncated tracking-tag grammar. Add malformed-suffix regressions.
- seats: part-2/sol-1-5
- group: g3

### r21

- file: scratchpad/effected/workspaces/ReleaseTag.ts:227; scratchpad/effected/workspaces/VersioningStrategy.ts:50,88
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; D5.
- evidence: `TagClassification` is a pure domain result union defined only as a TypeScript type. Other schema-representable data declarations remain type-only, including `VersioningStrategy.ts:50` (`ClassifyOptions`) and `:88` (`PackageRelease`), `SourceBoundary.ts:56` (`BoundaryRule`) and `:86` (`BoundaryFixture`), and `PackedInstall.ts:699` (`Replacement`) and `:707` (`ClosurePlan`). These are data shapes rather than service contracts or type-level machinery, and no modeling exception is recorded.
- failure: The port retains compile-time declarations as the source of truth for domain results, configuration, and plan data. Runtime guards, codecs, and arbitraries cannot derive from those declarations, leaving the schema-first requirement unmet.
- fix: Define annotated structural schemas for TagClassification, ClassifyOptions and PackageRelease and derive their existing types. Preserve structural inputs, discriminator strings, optionality and results. The other payloads from the same compound report are r22/r23.
- seats: part-2/sol-1-7
- group: g3

### r22

- file: scratchpad/effected/workspaces/SourceBoundary.ts:56,86
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; D5.
- evidence: `TagClassification` is a pure domain result union defined only as a TypeScript type. Other schema-representable data declarations remain type-only, including `VersioningStrategy.ts:50` (`ClassifyOptions`) and `:88` (`PackageRelease`), `SourceBoundary.ts:56` (`BoundaryRule`) and `:86` (`BoundaryFixture`), and `PackedInstall.ts:699` (`Replacement`) and `:707` (`ClosurePlan`). These are data shapes rather than service contracts or type-level machinery, and no modeling exception is recorded.
- failure: The port retains compile-time declarations as the source of truth for domain results, configuration, and plan data. Runtime guards, codecs, and arbitraries cannot derive from those declarations, leaving the schema-first requirement unmet.
- fix: Define annotated structural schemas for BoundaryRule and BoundaryFixture and derive their existing types. Preserve current structural inputs, optionality and waiver semantics. Keep function/service contracts as interfaces.
- seats: part-2/sol-1-7
- group: g4

### r23

- file: scratchpad/effected/workspaces/PackedInstall.ts:699,707
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; D5.
- evidence: `TagClassification` is a pure domain result union defined only as a TypeScript type. Other schema-representable data declarations remain type-only, including `VersioningStrategy.ts:50` (`ClassifyOptions`) and `:88` (`PackageRelease`), `SourceBoundary.ts:56` (`BoundaryRule`) and `:86` (`BoundaryFixture`), and `PackedInstall.ts:699` (`Replacement`) and `:707` (`ClosurePlan`). These are data shapes rather than service contracts or type-level machinery, and no modeling exception is recorded.
- failure: The port retains compile-time declarations as the source of truth for domain results, configuration, and plan data. Runtime guards, codecs, and arbitraries cannot derive from those declarations, leaving the schema-first requirement unmet.
- fix: Define annotated structural schemas for Replacement and ClosurePlan, including their finite kind domain, and derive existing types. Preserve plain construction inputs and carrier/closure/replacement order.
- seats: part-2/sol-1-7
- group: g5

### r24

- file: scratchpad/effected/workspaces/internal/roots.ts:30; scratchpad/effected/workspaces/PeerCheck.ts:400
- class: law   severity: required
- standard: standards/effect-laws-v1.md #6 (no native Map/Set in domain logic) and the allowlist contract; DependencyGraph.ts allowlist entry EFFECTED-WS-ADJACENCY is the sanctioned shape for a kept ReadonlyMap; standards/effect-laws-v1.md law 6 (no native Object/Map/Set/Date in domain logic); EFFECTED_PORT_GOAL D5 and section 16 (effect/HashMap|MutableHashMap only, never native Set/Map)
- evidence: `return { byId: byId.backing, workspaceByPath: workspaceByPath.backing }` builds two `MutableHashMap`s only to hand back their `backing: Map` fields so `InstanceIndex.byId/workspaceByPath` stay `ReadonlyMap<string, ResolvedPackage>` (roots.ts:17-19); the checker flags only `new Map` constructor calls (NoNativeRuntime.ts:69,390-397). Behaviour is preserved today only because `isSimpleKey` routes string keys straight into `backing` (MutableHashMap.js:352), an undocumented representation detail. `InstanceIndex` is internal (consumers: PeerCheck.ts, DuplicateCheck.ts), so no public contract forces the native Map. PeerCheck.ts:400, :972 and :1169 take `byId: ReadonlyMap<string, ResolvedPackage>` and call native `.get` at :413, :865, :1058, :1172. The maps come from internal/roots.ts:30, which reaches into the MutableHashMap implementation field: `return { byId: byId.backing, workspaceByPath: workspaceByPath.backing }` (same trick at WorkspaceStateSnapshot.ts:222). `backing: Map<K, V>` is the installed implementation detail (node_modules/effect/dist/MutableHashMap.d.ts:59). The gate missed it: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts only reports `new Map`/`new Set` constructors (`mapSetCtor`, line 397); no allowlist entry names roots.ts or PeerCheck.ts. The 10-09 grilling rejected exactly this kind of evasion ("not Object.defineProperties, which only evades the law").
- failure: The domain index remains a native Map while the law gate reports the module clean; the code depends on MutableHashMap's internal bucket layout, and the site is absent from the allowlist the fix wave works from.
- fix: Return the two MutableHashMaps themselves from internal/roots.ts and type InstanceIndex accordingly. Replace every rootInstances, PeerCheck and DuplicateCheck native get/iteration/size use with supported Effect collection APIs and Option lookups. Preserve instance traversal and result order; do not add an allowlist exception.
- seats: part-4/fable-1-4, part-2/fable-1-1
- group: g2

### r25

- file: scratchpad/effected/workspaces/PackedInstall.ts:759
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order)
- evidence: PackedInstall.ts:759 `for (const name of [...MutableHashMap.keys(wanted)].sort())` and :1347 `${[...names].sort().join(", ")}`. Not one of the four gated laws, so the gate did not see it; VersioningStrategy.ts:148 was converted to `A.sort(..., Str.Order)` in the same S1 pass, so the module is inconsistent. Default string sort is UTF-16 code-unit order, identical to `Str.Order` (`order.String`, node_modules/effect/dist/String.js:76), so the change is behaviour-preserving.
- failure: Law 10 violation in module source; a reviewer or future lint hardening (`A.sort` rule) fails the module.
- fix: `A.sort(A.fromIterable(MutableHashMap.keys(wanted)), Str.Order)` at :759 and `A.sort(names, Str.Order).join(", ")` at :1347 (import `* as A from "effect/Array"` and `* as Str from "effect/String"`).
- seats: part-2/fable-1-2
- group: g5

### r26

- file: scratchpad/effected/workspaces/SourceBoundary.ts:618
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order)
- evidence: SourceBoundary.ts:618 `.sort((a, b) => a.offset - b.offset)`; :706-709 `files.sort(byCodeUnit)`, `allowed.sort(byCodeUnit)`, `offences.sort(byPosition)`, `waived.sort(byPosition)` with hand-rolled comparators at :195-197. Not covered by the four gated laws. `A.sort` returns a new array; the sorted values are identical (stable sort, same comparison), so the `SourceScan` output is unchanged.
- failure: Law 10 violation in module source with ad-hoc comparator helpers that `Order.mapInput`/`Order.combine` already express.
- fix: Define `const byCodeUnit = Str.Order; const byPosition = Order.combine(Order.mapInput(Str.Order, (o: Offence) => o.file), Order.combine(Order.mapInput(Num.Order, (o) => o.line), Order.mapInput(Num.Order, (o) => o.column)))` and use `A.sort(found, Order.mapInput(Num.Order, (f) => f.offset))` at :618 and `A.sort(files, byCodeUnit)` etc. at :706-709.
- seats: part-2/fable-1-3
- group: g4

### r27

- file: scratchpad/test/workspaces/SourceBoundary.test.ts:103
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 (upstream tests and fixtures are the contract) and section 11.1 (rewrites per section 5.2 only; no test weakened); section 5.2 covers import specifiers of the test file, not source-text fixtures inside string literals
- evidence: diff against the oracle __test__/SourceBoundary.test.ts: the inputs to `SourceBoundary.importSpecifiers` were rewritten from `'import { a } from "./a.js"'` etc. to `"./a.ts"` (lab :103-108, :110-111 and the expected list :114-121), `'// import x from "./gone.js"'`/`'obj.require("./not.js")'` to `.ts` (:147-148), while the template-literal case `"const f = await import(`./f.js`)"` (:109) was left as `.js`, so the fixture is now a mixed `./a.ts … ./f.js … ./g.ts` list, the signature of an over-applied `.js`→`.ts` codemod. Line :140 also changed `require("./y/" + name)` to `require("./y" + name)`, a content change with no section 5.2 basis. No README Port notes or ledger `deviations` entry records any of it (README.md:589 `None`).
- failure: The upstream test no longer proves that `.js` specifiers (the form every upstream consumer scans) are extracted, and a fixture was silently altered; the suite passes but its meaning drifted, which is what D9 forbids.
- fix: Restore the pinned upstream .js source-text fixture strings and matching expectations at SourceBoundary.test.ts:103-121,147-148, plus require("./y/" + name) at :140. These changes were not forced by a law, diagnostic or ruling. Keep actual test-file import specifiers adapted to the lab.
- seats: part-2/fable-1-4
- group: g4

### r28

- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:233
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); `CatalogSet.resolveSpecifier` documents total lookup with `Option.none()` for an unmatched dependency, and `WorkspaceCatalogs.catalogResolver` documents the same miss convention.
- evidence: Read-only probes against commit `3fa5876691901fccf3d1cd29e9324564df134b56` and the pinned oracle both reproduce: `CatalogSet.make({ entries: { default: {} } }).rangeOf("constructor", O.none())` returns `Some` whose payload is a function; `.resolveSpecifier("constructor", "catalog:")` throws `TypeError: bareSpecifier.startsWith is not a function`. A snapshot with that empty default catalog and a seed declaring `constructor: "^1"` also resolves to `Some(function)`.
- failure: Catalog lookups read inherited properties as declared dependencies. `rangeOf` violates its `Option<string>` contract and suppresses valid seed or importer fallback; `resolveSpecifier` passes the inherited function into pnpm’s resolver and throws despite its totality contract.
- fix: Require own-property membership at both the catalog-name and dependency-name levels. Apply those checks in `rangeOf` and before `resolveSpecifier` delegates to pnpm. Add negative controls for inherited names and a positive control for an explicitly declared `"constructor"` dependency.
- seats: part-3/sol-1-1
- group: g7

### r29

- file: scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts:316
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); `WorkspaceStateSnapshot.resolveIn` explicitly promises `Option.none()` for an unknown importer or one recording nothing for the dependency.
- evidence: Read-only probes against the exact review commit and pinned oracle, using `WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty(), importerVersions: { ".": {} } })`, return `Some(function)` from `resolveIn(".", "constructor", "catalog:")` and `Some("Object")` from `resolveIn("constructor", "name", "catalog:")`.
- failure: The importer fallback traverses prototypes at both lookup levels. An absent dependency can produce a non-string payload, and an absent importer can fabricate a string version from the inherited `Object` constructor’s `name`. This can produce false resolution or diff results even after the catalog lookup in sol-1-1 is fixed.
- fix: Use own-property lookups for `importerPath` and `dependency`, returning `None` when either key is absent. Add regression cases for inherited importer and dependency names.
- seats: part-3/sol-1-2
- group: g7

### r30

- file: scratchpad/effected/workspaces/WorkspacePackage.ts:330
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); `WorkspacePackage.dependencyDiff` promises additions, removals and changed specifiers across its schema-accepted dependency records.
- evidence: With a dependency record parsed from `{"__proto__":"^1"}`, the exact-commit probe shows `allDependencies` retains the own key, but adding or removing it produces `{"added":{},"removed":{},"changed":{}}`. Changing it to `"^2"` produces the same empty serialized diff while `Object.getPrototypeOf(diff.changed)` becomes `{"from":"^1","to":"^2"}`. The pinned oracle reproduces the omission.
- failure: Assignments into the three plain result objects invoke the inherited `__proto__` setter. Additions and removals disappear, and a changed dependency modifies the result object’s prototype instead of creating a diff entry. The diff loses information that the input schema and merged dependency record preserve.
- fix: Construct result entries with an own-key-safe operation, such as `R.set` or `R.fromEntries`, for all three branches. Preserve ordinary result-object behavior. Add addition, removal and change regression cases for `"__proto__"`.
- seats: part-3/sol-1-3
- group: g7

### r31

- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:143; scratchpad/effected/workspaces/WorkspaceRoot.ts:142
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); the `isWorkspaceRoot` contract at lines 117–118 says a malformed root manifest is treated as “not a root” and ascent continues; `standards/effect-first-development.md`, “Operating Model,” requires explicit handling of external input failures.; D9 / section 14 cause 2 (`upstream-bug:<evidence>`); the function's own contract at :117-118 ('A malformed root package.json is "not a root", not an error; the ascent continues past it') and the header at :4-6 ('one unreadable ancestor must not hide a valid root above it'); standards/effect-first-development.md EF-31 (reserve Effect.die for invariant violations) and rule 29 (defects are reserved for invariants); .patterns/error-handling.md 'Effect.try pattern' (throwing code is confined to Effect.try); D9
- evidence: A read-only virtual filesystem containing `/repo/a/package.json = "null"` and `/repo/package.json = {"workspaces":["packages/*"]}` causes `find("/repo/a", { stopAt: "/repo" })` to exit with a `WorkspaceRootManifestError` defect at the exact review commit. The pinned oracle exits with a `TypeError` on the same fixture instead of finding `/repo`. `Walker.findRoot` absorbs only typed failures (scratchpad/effected/walker/Walker.ts:174 `Effect.orElseSucceed(predicate(candidate), () => false)`), so the defect from :143 escapes. Probe: with /ws/pnpm-workspace.yaml present and /ws/packages/a/package.json containing `null`, `find("/ws/packages/a/src")` dies with WorkspaceRootManifestError instead of resolving /ws. Upstream has the same latent bug through its `as Record<string, unknown>` cast; no upstream test covers a null manifest. Reported as backlog because it proposes a deviation; the cause and reproduction are supplied for the operator's decision. `if (parsed === null) throw WorkspaceRootManifestError.make({ message: "Cannot read properties of null (reading 'workspaces')" })` is a raw `throw` inside an `Effect.fn` generator carrying a hand-transcribed V8 message, reconstructing a TypeError that upstream only reached through its `JSON.parse(content) as Record<string, unknown>` cast (upstream WorkspaceRoot.ts). No upstream or lab test covers it (no 'reading workspaces'/null-manifest case in WorkspaceRoot.test.ts). Probe (bun, FileSystem.layerNoop with /ws/pnpm-workspace.yaml present and /ws/packages/a/package.json = `null`, `roots.find("/ws/packages/a/src")`): `EXIT DIE: Cause([Die(...WorkspaceRootManifestError: Cannot read properties of null (reading 'workspaces'))])`.
- failure: A non-object manifest at a nearer ancestor aborts discovery and hides a valid workspace root above it. The explicit preservation of the null-property-access defect retains a verified upstream bug in malformed-input handling.
- fix: Remove the null-specific raw throw and let the object guard treat null as not a root. Add the demonstrated null-manifest-below-valid-root regression. This verified upstream bug is allowed by D9/section 14; converting throw to Effect.die alone preserves the bug and is not the selected fix.
- seats: part-3/sol-1-4, part-3/fable-1-15, part-3/fable-1-2
- group: g8

### r32

- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:356
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Object in domain logic); gate miss: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts OBJECT_METHODS = keys/values/entries/fromEntries/assign/hasOwn/freeze/seal/create (no `defineProperty`), and standards/effect-laws.allowlist.jsonc has no WorkspaceCatalogs.ts entry
- evidence: Port-introduced: upstream `validCatalogs = catalogs as Record<string, Record<string, string>>` (no copy); the lab copies every validated catalog into `checked` through `Object.defineProperty(checked, name, {...})` only so that TypeScript gets a narrowed record and a `__proto__` catalog name stays an own key.
- failure: A native Object call in domain logic that neither the checker nor the allowlist can see; the per-entry copy exists purely to satisfy narrowing.
- fix: Keep the existing per-name error loop, derive a structural catalog-record guard from annotated S.Record schemas, and retain the validated original reference instead of copying with Object.defineProperty. Preserve own __proto__ keys and current validation/error behavior.
- seats: part-3/fable-1-3
- group: g7

### r33

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:584
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order); gate miss: NoNativeRuntime.ts:463 flags `.sort` only `inHotspotScope`, and NoNativeRuntimeHotspots.ts scopes hotspots to scratchpad/effect-ontology/**, not scratchpad/effected/**
- evidence: `.sort((a, b) => b.prefix.length - a.prefix.length)` at :584; `[...MutableHashMap.values(seen)].sort((a, b) => a.name.localeCompare(b.name))` at :659 and :788.
- failure: Three native sorts in domain logic that the native-runtime gate never scans in this tree.
- fix: `A.sort(Order.mapInput(Order.Number, (e) => -e.prefix.length))` for :584 (same descending-by-length order, stable); hoist one `const byName = Order.make<WorkspacePackage>((a, b) => { const c = a.name.localeCompare(b.name); return c < 0 ? -1 : c > 0 ? 1 : 0; })` and use `A.sort(byName)` at :659 and :788 (keeps localeCompare semantics exactly).
- seats: part-3/fable-1-4
- group: g6

### r34

- file: scratchpad/effected/workspaces/WorkspaceLayering.ts:114
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; same gate gap as fable-1-4 (NoNativeRuntime.ts:463 hotspot-only)
- evidence: Default-comparator `.sort()` on string arrays at :114, :132, :202, :203, :206 and :219.
- failure: Six native sorts in pure domain logic outside the gate's hotspot scope.
- fix: `A.sort(Order.String)` at each site; ordering is identical (default sort compares UTF-16 code units, which is what `Order.String`'s `<`/`>` comparison does).
- seats: part-3/fable-1-5
- group: g2

### r35

- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:460
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; same gate gap as fable-1-4
- evidence: `memberDirs.sort();` after the ls-tree loop.
- failure: Native in-place sort in domain logic outside the gate's hotspot scope.
- fix: Collect into `const collected: Array<string> = []` and `const memberDirs = A.sort(collected, Order.String);` (same code-unit order).
- seats: part-3/fable-1-6
- group: g7

### r36

- file: scratchpad/effected/workspaces/WorkspaceLayering.ts:49
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains; S.Literals only for anonymous inline unions never referenced by name); D5 (kits land at S4); kit precedent scratchpad/effected/xdg/Xdg.ts:23 `LiteralKit([...])` from `@beep/schema/LiteralKit`
- evidence: `type OffenceReason = "upward" | "sameLayer" | "toolingReachesLayer" | "intoUnconstrained" | "intoUnclassified"` (:49) is referenced by name (`offence` :100, `offenders` :191) and duplicated verbatim as `S.Literals([...])` inside `LayeringReport.offenders` (:65).
- failure: Two sources of truth for one named domain; adding a reason to one side type-checks until the schema rejects a report at runtime.
- fix: `const OffenceReason = LiteralKit(["upward", "sameLayer", "toolingReachesLayer", "intoUnconstrained", "intoUnclassified"]); type OffenceReason = typeof OffenceReason.Type;` and `reason: OffenceReason` in the offenders struct.
- seats: part-3/fable-1-7
- group: g2

### r37

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:90
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; user rule 'never a hand-rolled union of literals'; D5
- evidence: `WorkspacePatternError.kind: S.Literals([5 kinds])` (:90) duplicates the named `EnumerationFailureKind` union (internal/enumerate.ts:34) and the inline four-member return type of `patternKindOf` (:155-157, an identity function that only bridges the duplicates); `WorkspaceDiscoveryError.kind: S.Literals([5 kinds])` (:67) duplicates `PatternReadFailure.kind: "read" | "invalidYaml" | "invalidJson"` (internal/patterns.ts:20).
- failure: The same literal domains are spelled three times across the service and its internals with no shared schema, guard or `.Enum`; `patternKindOf` exists only to paper over the duplication.
- fix: `export const EnumerationFailureKind = LiteralKit([...])` in internal/enumerate.ts and `export const PatternReadFailureKind = LiteralKit([...])` in internal/patterns.ts (types derived from them); in WorkspaceDiscovery.ts `const WorkspacePatternErrorKind = LiteralKit([the five])`, `kind: WorkspacePatternErrorKind`, delete `patternKindOf` (the subset literal type is assignable); likewise `const WorkspaceDiscoveryErrorKind = LiteralKit([the five])` for :67.
- seats: part-3/fable-1-8
- group: g6

### r38

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:214,626,772
- class: schema   severity: required
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 public-collection replacement ruling.
- evidence: Public `ReadonlyMap` surfaces are manufactured from `MutableHashMap.fromIterable(...).backing`: `importerMap` (:214, :626, :772) and `WorkspaceStateSnapshot.versions` (WorkspaceStateSnapshot.ts:208, :222, :243). `backing` is a public typed `Map<K, V>` (node_modules/effect/dist/MutableHashMap.d.ts:59), so this is legal, but it is a native Map handed to consumers through an Effect-collection escape hatch. The ruling enumerates specific collections (chosen, adjacency, YAML anchors, MarkdownDocument.definitions) and not these two, so this needs an operator call rather than a reviewer mandate.
- failure: Two public contracts stay native while the rest of the kit's public collections move to HashMap; the `.backing` detour is the tell.
- fix: Return an Effect HashMap from importerMap and remove .backing extraction. Adapt module-local consumers/tests with Effect lookups. Retain an explicit ordered key sequence wherever importer iteration promises insertion order; do not keep a native-collection exception. The independent versions contract from this report is r39.
- seats: part-3/fable-1-11
- group: g6

### r39

- file: scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts:208,222,243
- class: schema   severity: required
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 public-collection replacement ruling.
- evidence: Public `ReadonlyMap` surfaces are manufactured from `MutableHashMap.fromIterable(...).backing`: `importerMap` (:214, :626, :772) and `WorkspaceStateSnapshot.versions` (WorkspaceStateSnapshot.ts:208, :222, :243). `backing` is a public typed `Map<K, V>` (node_modules/effect/dist/MutableHashMap.d.ts:59), so this is legal, but it is a native Map handed to consumers through an Effect-collection escape hatch. The ruling enumerates specific collections (chosen, adjacency, YAML anchors, MarkdownDocument.definitions) and not these two, so this needs an operator call rather than a reviewer mandate.
- failure: Two public contracts stay native while the rest of the kit's public collections move to HashMap; the `.backing` detour is the tell.
- fix: Represent versions with an Effect HashMap and supported lookups, adapting module-local consumers/tests. Keep explicit package-name order where insertion order is observable, and exclude unversioned members as before. Do not expose .backing or retain an exception.
- seats: part-3/fable-1-11
- group: g7

### r40

- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:189
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 13 (prefer schema decoding over ad-hoc parsing); tsgo preferSchemaOverJson (does not fire for a plain function, so the gate is silent)
- evidence: `parseJsonObject` uses `JSON.parse` inside try/catch while the four sibling files decode through `const JsonValue = S.fromJsonString(S.Unknown)` (WorkspaceCatalogs.ts:60, WorkspaceDiscovery.ts:35, WorkspacePackage.ts:24, WorkspaceRoot.ts:29).
- failure: One file in the module parses JSON outside the schema path the others settled on; upstream parity, so behaviour is unchanged.
- fix: Use S.fromJsonString(S.Unknown) with the available decodeUnknownResult/decodeResult API and fold failures to the same empty object. Preserve acceptance/rejection and fallback behavior; derive any object guard from its owning schema.
- seats: part-3/fable-1-12
- group: g7

### r41

- file: scratchpad/effected/workspaces/internal/catalogs.ts:76
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 and the allowlist contract (entries must match a live violation); 2026-10-09 ruling :83-85 (R.fromEntries/R.get for dictionaries)
- evidence: `Object.defineProperty(target, key, ...)` in the `__proto__`-only `define` helper (upstream parity) escapes the native-runtime gate (OBJECT_METHODS lacks `defineProperty`), so it can be neither flagged nor allowlisted today. Outside the focus list; recorded so the gate gap is fixed once.
- failure: A native Object call the checker cannot see and the allowlist cannot register.
- fix: Build normalized catalog entries and clean records with R.fromEntries and read via R.get. Remove Object.defineProperty/define while retaining hostile __proto__ cases and array-form normalization semantics. Checker hardening is outside this write surface; do not add an allowlist entry.
- seats: part-3/fable-1-19
- group: g7

### r42

- file: scratchpad/effected/workspaces/internal/sourceText.ts:385
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `SourceBoundary.importsNode` and `check` promise to identify imported modules.
- evidence: A read-only probe against both the port and the pinned oracle used `import p from "\u006eode:process";`. Both returned `["\\u006eode:process"]` from `importSpecifiers` and zero offences for `["node:process", { forbidImports: ["node:*"] }]`. Executing the equivalent dynamic import resolved to the actual `node:process` module.
- failure: Module specifiers reach rule matching with their escapes unprocessed. Valid JavaScript can therefore import a forbidden built-in while the scanner reports no offence. This limitation is absent from the documented scanner limits and recorded deviations.
- fix: Preserve the raw literals and source offsets produced by `lex`, but provide cooked ECMAScript string values for module-specifier matching. Add the escaped-import regression fixture.
- seats: part-4/sol-1-1
- group: g4

### r43

- file: scratchpad/effected/workspaces/internal/sourceText.ts:351
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the `references` contract explicitly excludes longer identifiers.
- evidence: Both the port and pinned oracle reported two `process` offences for each of `const 𝒙process = 1; 𝒙process;` and `const process𝒙 = 1; process𝒙;`. A read-only JavaScript execution probe successfully declared both identifiers and returned their sum, `3`.
- failure: Identifier-boundary checks pass individual UTF-16 code units to the Unicode regular expression. Each half of an astral identifier character fails that check, so the scanner incorrectly treats the embedded `process` substring as a separate identifier. Valid source consequently fails the boundary check.
- fix: Make identifier-boundary lookups and backward identifier scans operate on complete Unicode code points while retaining UTF-16 offsets for diagnostics. Add fixtures for astral characters on both sides of a forbidden identifier.
- seats: part-4/sol-1-2
- group: g4

### r44

- file: scratchpad/effected/workspaces/internal/sourceText.ts:268
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the lexer promises to distinguish comments from subsequent executable code.
- evidence: For each separator `\r`, `\u2028`, and `\u2029`, a read-only probe executed `// harmless<separator>process.touch();` with a harmless injected `process` object. JavaScript executed `touch` once, whereas both the port and pinned oracle returned zero `process` offences.
- failure: A line comment stops only at LF. With another valid JavaScript line terminator, the lexer blanks the following executable statement as part of the comment, allowing real forbidden references to pass undetected.
- fix: Recognize all four ECMAScript line terminators when ending line comments. Preserve those terminators in the lexed views and update location accounting consistently, treating CRLF as one line break. Add the three regression fixtures.
- seats: part-4/sol-1-3
- group: g4

### r45

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:539
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-35; `AGENTS.md` requires schema-derived guards for named or structurally validated domain constraints.
- evidence: `isStringRecord` manually establishes `Record<string, string>` through `P.isObject(value) && R.values(value).every(P.isString)`, and that guard controls all four dependency fields. The existing `WorkspacePackage` model already defines those fields through its `DependencyMap` schema. `isStringRecord` (:539-540) exists only to feed `stringRecord` (:542-543), which is the single consumer; upstream had one helper.
- failure: The synchronous discovery boundary maintains a second handwritten definition of a dependency map instead of deriving validation from the schema that owns the model. The committed guard remains present despite the green gates; this is a semantic schema-modeling violation, not a claimed compiler diagnostic.
- fix: Derive S.is from WorkspacePackage's existing dependency-field schema and remove handwritten isStringRecord. Preserve all-or-nothing fallback for malformed maps and upstream empty/default behavior; keep the tolerant stringRecord adapter only if needed. This also removes the two-helper wall reported by part-4/fable-1-15; do not inline a second handwritten predicate.
- seats: part-4/sol-1-4, part-4/fable-1-15
- group: g6

### r46

- file: scratchpad/effected/workspaces/internal/traverse.ts:53
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-35; `standards/effect-laws-v1.md` law 17.
- evidence: The named, shared `isValidMaxDepth` constraint is implemented as `Number.isInteger(maxDepth) && maxDepth >= 1` and is consumed by both synchronous and Effect enumeration. It has no owning schema.
- failure: A reused domain constraint remains an ad-hoc boolean helper rather than a schema-derived guard. Its accepted values, annotations, and validation behavior cannot be derived from one schema definition.
- fix: Define an annotated depth schema and derive `isValidMaxDepth` with `S.is`. Preserve the upstream predicate exactly: a read-only equivalence probe showed that replacing it with `S.Int.check(S.isGreaterThanOrEqualTo(1))` would newly reject `1e100`, which upstream accepts. Use an annotated `Number.isInteger` filter where needed to retain that contract.
- seats: part-4/sol-1-5
- group: g6

### r47

- file: scratchpad/effected/workspaces/internal/configDependencyShared.ts:68
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b, EF-13, and EF-33; `AGENTS.md` schema-first domain-model rule.
- evidence: `ManifestVersion` is a handwritten three-case domain union. Its cases are constructed by `manifestVersion`, represented by separate `ABSENT` and `UNVERSIONED` objects, and matched throughout config-dependency resolution and fetch verification. No schema owns the cases or payload.
- failure: The resolution state model exists only as a TypeScript declaration, with case construction and discrimination maintained separately. This named, reused domain model does not satisfy the required schema-first representation.
- fix: Define an identity-annotated `S.TaggedUnion` for `absent`, `unversioned`, and `version`, and derive the existing type from it. Preserve the current structural objects, tag strings, and version acceptance behavior.
- seats: part-4/sol-1-6
- group: g8

### r48

- file: scratchpad/effected/workspaces/internal/enumerate.ts:196
- class: law   severity: required
- standard: standards/effect-laws-v1.md #10 (no native Array.prototype.sort; use A.sort with an explicit Order)
- evidence: `results.sort((a, b) => (a.relativePath < b.relativePath ? -1 : ...))`; also WorkspacesSync.ts:742 `[...included].sort(([a], [b]) => ...)` and internal/configDependencyResolution.ts:230 `.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))`. The checker flags `.sort` only `inHotspotScope` (NoNativeRuntime.ts:463) and scratchpad/effected is not a hotspot, so the gate never evaluated these sites. The same lane already converted packedInstallPlan.ts:98 to `A.sort(R.keys(...), Str.Order)`.
- failure: Law 10 violated at three sites with hand-written comparators that re-implement `Str.Order` / `Number.Order`; the law gate is silent only because of scope, not compliance.
- fix: Replace results.sort with A.sort and Order.mapInput(Str.Order, r => r.relativePath), preserving stable code-unit order. Independent sorts from this compound report are r49/r50.
- seats: part-4/fable-1-5
- group: g6

### r49

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:742
- class: law   severity: required
- standard: standards/effect-laws-v1.md #10 (no native Array.prototype.sort; use A.sort with an explicit Order)
- evidence: `results.sort((a, b) => (a.relativePath < b.relativePath ? -1 : ...))`; also WorkspacesSync.ts:742 `[...included].sort(([a], [b]) => ...)` and internal/configDependencyResolution.ts:230 `.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))`. The checker flags `.sort` only `inHotspotScope` (NoNativeRuntime.ts:463) and scratchpad/effected is not a hotspot, so the gate never evaluated these sites. The same lane already converted packedInstallPlan.ts:98 to `A.sort(R.keys(...), Str.Order)`.
- failure: Law 10 violated at three sites with hand-written comparators that re-implement `Str.Order` / `Number.Order`; the law gate is silent only because of scope, not compliance.
- fix: Use A.sort with an explicit Order on the included relative-path key, preserving stable code-unit order.
- seats: part-4/fable-1-5
- group: g6

### r50

- file: scratchpad/effected/workspaces/internal/configDependencyResolution.ts:230
- class: law   severity: required
- standard: standards/effect-laws-v1.md #10 (no native Array.prototype.sort; use A.sort with an explicit Order)
- evidence: `results.sort((a, b) => (a.relativePath < b.relativePath ? -1 : ...))`; also WorkspacesSync.ts:742 `[...included].sort(([a], [b]) => ...)` and internal/configDependencyResolution.ts:230 `.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))`. The checker flags `.sort` only `inHotspotScope` (NoNativeRuntime.ts:463) and scratchpad/effected is not a hotspot, so the gate never evaluated these sites. The same lane already converted packedInstallPlan.ts:98 to `A.sort(R.keys(...), Str.Order)`.
- failure: Law 10 violated at three sites with hand-written comparators that re-implement `Str.Order` / `Number.Order`; the law gate is silent only because of scope, not compliance.
- fix: Use A.sort with a reversed numeric Order mapped to the existing Number(v.slice(1)) key, preserving stable ties and candidate preference exactly.
- seats: part-4/fable-1-5
- group: g8

### r51

- file: scratchpad/effected/workspaces/index.ts:140
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D2 (superset export rule: additions listed under README Port notes → Added exports and ledger `exportsAdded`)
- evidence: WorkspacesSync.ts:59 exports a new public class `WorkspaceEnumerationDepthError` (thrown by the public `getWorkspacePackagesSync`, WorkspacesSync.ts:669) but the `./WorkspacesSync.ts` export block in index.ts:140-151 omits it; the test imports it from the module file directly (`scratchpad/test/workspaces/WorkspacesSync.test.ts:29`). PORT_LEDGER.json row `exportsAdded: []`; README `Added exports: None`.
- failure: A consumer of the package entry cannot name or `instanceof`-match the error class the public function throws, and the D2 additions inventory is wrong.
- fix: Add WorkspaceEnumerationDepthError to index.ts's WorkspacesSync export block and assert its availability through the package entrypoint. Keep the law-forced tagged error. Added-export bookkeeping is c06, handled centrally.
- seats: part-4/fable-1-6
- group: g6

### allow-1

- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:124
- class: law   severity: required
- kind: object-method
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-FROZEN-DEFAULTS, file scratchpad/effected/workspaces/ConfigDependencyHooks.ts, kind object-method: Object.freeze keeps the shared exported NoPeerDependencyRules default (and its record and arrays) immutable at runtime for every caller. 
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Drop Object.freeze on NoPeerDependencyRules and all nested defaults. Keep readonly types/schema-derived values and build public records via R.fromEntries with R.get for lookups. Retarget any isFrozen assertion to the readonly/schema representation, preserving default content and replay behavior.
- seats: operator/allowlist:EFFECTED-WS-FROZEN-DEFAULTS:scratchpad/effected/workspaces/ConfigDependencyHooks.ts
- group: g1

### allow-2

- file: scratchpad/effected/workspaces/DependencyGraph.ts:143
- class: law   severity: required
- kind: new-map-set
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-ADJACENCY, file scratchpad/effected/workspaces/DependencyGraph.ts, kind new-map-set: The public adjacency API returns ReadonlyMap<string, ReadonlySet<string>> backed by these maps and sets; Effect collections would change that public contract. `DependencyNames` (:44-50) and `DependencyIndex` (:52-65) are hand-written adapters that implement `ReadonlySet`/`ReadonlyMap` over `MutableHashSet`/`MutableHashMap` solely so `sortSubset` (:317-326) can feed `kahn`/`cycleMembers` through the native-typed `Edges` interface, while `#index()` (:143-147) still builds native `Map`/`Set` under the allowlist entry the operator has ruled will be replaced.
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Replace adjacency and forward/reverse indexes with HashMap<string, HashSet<string>>. Use Effect collection access throughout graph algorithms, remove the ReadonlyMap/ReadonlySet adapter classes, and keep explicit vertex/neighbor order where promised. Retarget native adjacency get/size tests while retaining every graph/cycle/order expectation.
- seats: part-1/fable-1-7, operator/allowlist:EFFECTED-WS-ADJACENCY:scratchpad/effected/workspaces/DependencyGraph.ts
- group: g2

### allow-3

- file: scratchpad/effected/workspaces/internal/importerVersions.ts:81
- class: law   severity: required
- kind: object-method
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-NULL-PROTOTYPE, file scratchpad/effected/workspaces/internal/importerVersions.ts, kind object-method: Object.create(null) dictionaries keep importer paths and dependency names such as __proto__, constructor and toString as plain keys with no inherited values. 
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Replace internal null-prototype dictionaries with Effect HashMap/MutableHashMap, preserving first-field-wins and importer order. Build the public nested record with R.fromEntries and read it with R.get. Preserve __proto__, constructor and toString as own keys with no inherited fallback.
- seats: operator/allowlist:EFFECTED-WS-NULL-PROTOTYPE:scratchpad/effected/workspaces/internal/importerVersions.ts
- group: g7

### allow-4

- file: scratchpad/effected/workspaces/internal/packedInstallPlan.ts:329
- class: law   severity: required
- kind: object-method
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-NULL-PROTOTYPE, file scratchpad/effected/workspaces/internal/packedInstallPlan.ts, kind object-method: Object.create(null) gives the packed plan a null prototype; PackedInstallPlan.test.ts asserts the null prototype and an absent constructor. 
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Replace the null-prototype consumer dependency dictionary with an internal Effect HashMap and a public R.fromEntries record read through R.get. Preserve hostile keys and selected dependency order/content. Retarget PackedInstallPlan.test.ts:323's null-prototype assertion and the absent-constructor assertion to own-key-safe lookup semantics.
- seats: operator/allowlist:EFFECTED-WS-NULL-PROTOTYPE:scratchpad/effected/workspaces/internal/packedInstallPlan.ts
- group: g5

### allow-5

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:569
- class: law   severity: required
- kind: new-map-set
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-DISCOVERY-INDEXES, file scratchpad/effected/workspaces/WorkspaceDiscovery.ts, kind new-map-set: WeakMaps cache owner, package and version indexes per discovered package array; they need array identity and weak retention across refreshes. Inner indexes are Effect maps. Three `new WeakMap` caches keyed by package-array identity: `ownerIndexes` :569, `packageIndexes` :599, `versionIndexes` :870, currently allowlisted in standards/effect-laws.allowlist.jsonc ('WorkspaceDiscovery.ts', kind new-map-set).
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Remove all three WeakMaps (ownerIndexes, packageIndexes, versionIndexes). Compute/store indexes as fields on module-owned discovery memo/state or resolver-owner objects, refresh them with the owning package snapshot, and compare snapshot identity with === only where needed. Preserve lookup correctness, identity-sensitive refresh and bounded retention; do not globally mark caller objects for reference equality.
- seats: part-3/fable-1-9, operator/allowlist:EFFECTED-WS-DISCOVERY-INDEXES:scratchpad/effected/workspaces/WorkspaceDiscovery.ts
- group: g6

### allow-6

- file: scratchpad/effected/workspaces/WorkspacePackage.ts:26
- class: law   severity: required
- kind: object-method
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-NULL-PROTOTYPE, file scratchpad/effected/workspaces/WorkspacePackage.ts, kind object-method: Object.freeze(Object.create(null)) defaults are shared, immutable and free of inherited keys; dependency and manifest lookups must not see prototype members. `Object.freeze<Record<string, string>>(Object.create(null))` at :26 (EMPTY) and :31 (EMPTY_MANIFEST), and the same shape at WorkspaceStateSnapshot.ts:30, all allowlisted. Every reader already uses own-property access (`R.has` at :250-266 and :287, spreads at :240-245), and WorkspacePackage.test.ts:221 pins inherited-name lookups through `dependencyVersion`, which stays green under `R.has`; no focus suite asserts `isFrozen` or a null prototype.
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Drop runtime freezing and Object.create(null) for dependency/manifest defaults. Keep readonly schema/type representations, build public records with R.fromEntries, and read with R.get. Preserve absent-key behavior for __proto__, constructor and toString; retarget any representation assertions without reintroducing freezing.
- seats: part-3/fable-1-10, operator/allowlist:EFFECTED-WS-NULL-PROTOTYPE:scratchpad/effected/workspaces/WorkspacePackage.ts
- group: g7

### allow-7

- file: scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts:30
- class: law   severity: required
- kind: object-method
- standard: D5; effect-laws-v1 law 6; Grilling 2026-10-09 (later), removal of every effected native-runtime allowlist entry.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-WS-NULL-PROTOTYPE, file scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts, kind object-method: Object.freeze(Object.create(null)) is the shared, immutable dependency-map default with no inherited keys. `Object.freeze<Record<string, string>>(Object.create(null))` at :26 (EMPTY) and :31 (EMPTY_MANIFEST), and the same shape at WorkspaceStateSnapshot.ts:30, all allowlisted. Every reader already uses own-property access (`R.has` at :250-266 and :287, spreads at :240-245), and WorkspacePackage.test.ts:221 pins inherited-name lookups through `dependencyVersion`, which stays green under `R.has`; no focus suite asserts `isFrozen` or a null prototype.
- failure: This native-runtime site is retained only by an exception the operator explicitly removed.
- fix: Drop runtime freezing and Object.create(null) for the snapshot dependency-map default. Build the public record with R.fromEntries and use R.get for reads, with internal HashMap indexes. Preserve absent-key behavior and readonly representations; retarget any freeze/prototype assertions.
- seats: part-3/fable-1-10, operator/allowlist:EFFECTED-WS-NULL-PROTOTYPE:scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts
- group: g7

### r52

- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:325
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 21 (direct helper refs over trivial wrapper lambdas)
- evidence: `value.every((entry: unknown): entry is string => P.isString(entry))` wraps `P.isString`, whose signature `(input: unknown) => input is string` already satisfies `Array.prototype.every`'s refinement overload; `isStringRecord` at :364 already passes `P.isString` directly. Gate miss confirmed by TerseEffect.ts:208-237: the one-argument helper-reference rule recognizes A.make and O.some, not P.isString, so the green gate does not enforce this concrete predicate-wrapper case.
- failure: A trivial wrapper lambda the terse law names, inconsistent with the sibling helper two lines down.
- fix: `A.isArray(value) && value.every(P.isString) ? value : fallback`.
- seats: part-1/fable-1-13
- group: g1

### r53

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:548
- class: effect-idiom   severity: required
- standard: ~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md (decode unknown input with `decodeUnknown*`); upstream used `Schema.decodeUnknownEffect(PublishConfig)`
- evidence: `S.decodeEffect(PublishConfig)(publishConfig)` where `publishConfig` is narrowed only to `object`; `decodeEffect` expects `PublishConfig["Encoded"]` and only compiles because `object` satisfies the weak all-optional type. `Schema.decodeUnknownEffect` exists in effect 4.0.2 (Schema.d.ts:361).
- failure: The call claims the value already has the encoded shape; a future non-weak `PublishConfig` encoded type turns this into a type error, and the intent (validate untrusted manifest data) is obscured.
- fix: `Effect.runSyncExit(S.decodeUnknownEffect(PublishConfig)(publishConfig))`.
- seats: part-4/fable-1-11
- group: g6

## Backlog

### b01

- file: scratchpad/effected/workspaces/ChangeDetector.ts:29; scratchpad/effected/workspaces/Publishability.ts:80; scratchpad/effected/workspaces/WorkspaceCatalogs.ts:83; scratchpad/effected/workspaces/Workspaces.ts:315; scratchpad/effected/workspaces/PackedInstall.ts:46; scratchpad/effected/workspaces/PeerCheck.ts:39; scratchpad/effected/workspaces/Publishability.ts:43; scratchpad/effected/workspaces/ReleaseTag.ts:21; scratchpad/effected/workspaces/SourceBoundary.ts:19; scratchpad/effected/workspaces/VersioningStrategy.ts:27
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Carrier policy; operator deferral of S2.; `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; S2 is deferred by operator order.; `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; the reviewer brief defers S2.; `.patterns/jsdoc-documentation.md` hard requirements and carrier policy; EFFECTED_PORT_GOAL section 10.2. S2 is deferred by the review brief.; `.patterns/jsdoc-documentation.md` carrier policy (`@remarks` and `@example` forbidden; exports need `@category` and `@since`). Round brief: S2 has not run, so this stays backlog.; `.patterns/jsdoc-documentation.md` carrier policy; S2 deferred by the round brief.
- evidence: The reviewed files retain legacy `@example` and `@remarks` carriers and omit canonical `@category` and `@since 0.0.0` tags. Examples include `ChangeDetector.ts:29`, `ConfigDependencySpec.ts:79`, `DependencyGraph.ts:24`, `DuplicateCheck.ts:51` and `PackageManagerName.ts:49`. Several exported runtime declarations also lack their required Example. `CatalogSet` has a legacy `@remarks` block, no Example, and no `@category` or `@since`. The seven focus files retain legacy `@remarks`/`@example` carriers and public declarations lacking the required category and since tags; several exported schema/error classes also lack Examples. The `Workspaces.layer` block retains `@remarks` and `@example`, lacks canonical `@category` and `@since`, and its example at line 338 references `PlatformLayer` without declaring or importing it. Similar legacy carriers remain in the other focus-file API blocks.
- failure: These public APIs do not yet satisfy the repository’s JSDoc grammar and inventory requirements. This is deferred documentation work, so it is backlog despite D11’s general JSDoc classification.
- fix: During S2, convert every cited legacy carrier to titled **Example** (Title)/**Details**, supply canonical category/since metadata and missing runtime examples, and make examples independently compilable. Preserve the upstream prose, including Workspaces.layer's platform-layer example.
- seats: part-1/sol-1-9, part-2/sol-1-8, part-3/sol-1-5, part-4/sol-1-7, part-2/grok-1-6, part-2/grok-1-7, part-2/grok-1-8, part-2/grok-1-9, part-2/grok-1-10, part-2/grok-1-11
- disposition: backlog
- reason: S2 documentation/JSDoc conversion has not run.

### b02

- file: scratchpad/effected/workspaces/LockfileReader.ts:97
- class: jsdoc   severity: backlog
- standard: operator order for this round (S2 has not run; JSDoc findings stay backlog); the shape at line 88
- evidence: `LockfileReaderShape.read` is `Effect.Effect<Lockfile, LockfileReadFailure>`. The remark still says callers should read `lockfile.packagesNamed(name)` off `` `read()` ``. The `makeTest` remark at line 329 repeats `` `read()` ``.
- failure: A reader who follows the remark writes `reader.read()`, which does not typecheck. Running the effect is `yield* reader.read`.
- fix: In both remarks, describe `` `read` `` as the effect value. Leave the `unstubbed("read")` die text alone; the double tests assert that string.
- seats: part-1/grok-1-3
- disposition: backlog
- reason: S2 documentation is deferred.

### b03

- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:103
- class: docs   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Example quality; operator deferral of S2.
- evidence: The example passes `"0.11.1+sha512-m35m…=="` and describes a successful result. A read-only probe of `ConfigDependencySpec.parse` with that exact string returned `Failure(InvalidConfigDependencySpecError)` with `reason: "integrity"`.
- failure: Executing the documented example fails before reaching its advertised `[bare, hasIntegrity]` result because the ellipsis is not valid SRI base64.
- fix: Replace the abbreviated integrity with a complete valid SRI string, such as the existing test fixture value, and verify the example during S2.
- seats: part-1/sol-1-10
- disposition: backlog
- reason: S2 example repair is deferred.

### b04

- file: scratchpad/test/workspaces/ConfigDependencySpec.test.ts:116; scratchpad/effected/workspaces/VersioningStrategy.ts:115; scratchpad/test/workspaces/WorkspacePackage.test.ts:25
- class: test   severity: backlog
- standard: D10 requires generated schema/codec round trips and parser/formatter properties using `Arbitrary.schema` and `fcRuns`; operator deferral of S3.; D10, the schema/codec round-trip and parser/formatter property floor; S3 is deferred by operator order.; D10 and section 11.4, “S3: property floor”; the reviewer brief defers S3.
- evidence: The codec round-trip test enumerates four fixed strings. Searching `scratchpad/test/workspaces/**` found no `Arbitrary`, `fast-check`, `fcRuns` or property registrations implementing the required floor. `git grep -n -E 'Arbitrary|fast-check|fcRuns|@beep/fc' 3fa5876 -- scratchpad/test/workspaces` returned no matches. The focused tests use concrete examples, including enumerated tag round trips, rather than generated schema round trips and parser/formatter properties. An exact-commit search over `scratchpad/test/workspaces/**` for `Arbitrary`, `fcRuns`, `it.effect.prop`, and `it.prop` finds no occurrences. The exported schemas in the focus files—including `PublishConfig`, `WorkspacePackage`, `CatalogSet`, `LayerEdge`, `LayeringReport`, `PackageStateSnapshot`, and `WorkspaceStateSnapshot`—have example-based tests but no required generated round-trip properties.
- failure: The reviewed schemas and codec lack the required generated round-trip and fidelity proof. The existing example tests exercise selected inputs but do not establish D10’s property floor.
- fix: At S3 add generated schema/codec encode-decode round trips and parser/formatter fidelity/idempotence properties using Effect Arbitrary and fcRuns. Retain every upstream example/oracle suite.
- seats: part-1/sol-1-11, part-2/sol-1-9, part-3/sol-1-8
- disposition: backlog
- reason: S3 property/coverage work has not run.

### b05

- file: scratchpad/test/workspaces/ConfigDependencySpec.test.ts:28; scratchpad/test/workspaces/WorkspaceSnapshots.test.ts:377; scratchpad/test/workspaces/importerVersions.test.ts:128
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; operator deferral of S3.; `goals/effect-vitest-canon/SPEC.md`, D5; `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; the reviewer brief defers S3.; `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; `goals/effect-vitest-canon/SPEC.md` D5 assertion-helper doctrine. S3 is deferred by the review brief.
- evidence: Result assertions use `assert.isTrue(Result.isSuccess(parsed))` followed by manual narrowing. Option assertions compare containers or test `O.isNone`, including `ConfigDependencySpec.test.ts:31` and `:51`, `PackageManagerDetector.test.ts:34` and `:54`, and `LockfileReader.test.ts:79` and `:85`. These files do not use the corresponding public assertion helpers. Inside `it.effect`, this test compares an `Option` with `assert.deepStrictEqual` and uses `assert.isTrue(O.isNone(...))` for the miss. Similar container assertions occur in the discovery and catalog Effect tests. Lines 128–129 compare Option containers with `assert.deepStrictEqual(..., O.some(...))`; line 136 asserts `O.isNone(...)` through a boolean assertion. The suite does not use the canonical Option assertion helpers.
- failure: The tests retain noncanonical Option/Result assertions and redundant narrowing rather than the required helpers that assert the expected variant and payload.
- fix: At S3 use the canonical assertSuccess/assertFailure/assertSome/assertNone helpers for the cited Result/Option assertions while retaining every expected payload and negative case.
- seats: part-1/sol-1-12, part-3/sol-1-7, part-4/sol-1-8
- disposition: backlog
- reason: S3 assertion-canon conversion is deferred.

### b06

- file: scratchpad/test/workspaces/ConfigDependencyHooksSubprocess.test.ts:1; scratchpad/test/workspaces/PeerCheck.test.ts:1; scratchpad/test/workspaces/WorkspaceDiscovery.test.ts:1
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14 (`it.layer` for effectful layers; per-test `Effect.provide` only for pure `Layer.succeed` stubs); tsgo `strictEffectProvide` (tsconfig.base.json:217 at error); EFFECTED_PORT_GOAL section 11.2/11.3 (S3 canon; D14 memfs double for filesystem reads) and section 12.1 (tsgo diagnostics with every rule at error); brief: test-canon findings are backlog until S3; goals/effect-vitest-canon/SPEC.md D14 (`it.layer`/`layer(...)` composition); tsgo strictEffectProvide (Effect.provide with layers outside application entry points); backlog per the brief because S3/test-canon has not run
- evidence: The file opens with `// @effect-diagnostics strictEffectProvide:skip-file ...` and every test does `.pipe(Effect.provide(layer))` where `layer = ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(spawner.layer))` (:64), a `Layer.effect` layer; the suppression is what keeps the strict tsgo gate green. (`PackageManagerDetectorDouble.test.ts:1` carries the same directive but provides a pure `Layer.succeed` double, which the canon allows.) File-wide `// @effect-diagnostics nodeBuiltinImport:skip-file` was added to PeerCheck.test.ts:1 (also SourceBoundary.test.ts:1, e2e/PackedInstall.e2e.test.ts:1 with `processEnvInEffect:skip-file`, VersioningStrategy.test.ts:1 with `strictEffectProvide:skip-file`; 20 workspaces test files carry such directives) so the `node:fs`/`node:path` fixture reads pass the gate. Nothing in README Port notes, the ledger row, or TESTS_NOT_PASSING.md records the suppressions. `// @effect-diagnostics strictEffectProvide:skip-file` added to WorkspaceDiscovery.test.ts, WorkspaceRoot.test.ts, WorkspaceSnapshots.test.ts and WorkspaceStateSnapshotSeed.test.ts (and 29 more suites in scratchpad/test/workspaces); the upstream suites carry no directive, so the tsgo gate is green by file-wide suppression rather than by composition.
- failure: A diagnostic the gate is configured to reject is silenced file-wide instead of being resolved by the canon's `it.layer` shape; S3 will have to revisit it.
- fix: At S3 migrate the cited test-layer composition and fixture reads through canonical Effect testers/platform services and remove the file-wide directives where resolved. Keep all oracle assertions. Any shared tsconfig/vitest or DIAGNOSTIC_EXCEPTIONS registry adjustment is a separate central follow-up outside the port's write surface.
- seats: part-1/fable-1-16, part-2/fable-1-12, part-3/fable-1-16
- disposition: backlog
- reason: S3 test-canon composition/fixture migration is deferred; shared configuration edits are outside the port's write surface.

### b07

- file: scratchpad/effected/workspaces/DependencyGraph.ts:193; scratchpad/effected/workspaces/VersioningStrategy.ts:229
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3 (a branch unreachable by construction is a finding against the source; S3 coverage); EFFECTED_PORT_GOAL section 11.3 (a branch unreachable by construction is a finding against the source: simplify it); effect-laws-v1 law 21 (tersest equivalent form)
- evidence: `if (frame === undefined) break;` (:193) and `if (next === undefined) continue;` (:201) were added for `noUncheckedIndexedAccess` and cannot execute: `frame` is read after `stack.length > 0` and `next` after `cursor < deps.length`. No test can cover them; S3's per-file 100 percent branch gate will fail here. `tagsFor` returns at :226 when `releases.length === 0`, so `const first = releases[0]; return first === undefined ? [] : [...]` (:228-229) can never take the `[]` arm; it exists only to satisfy `noUncheckedIndexedAccess` on the upstream `releases[0].version`. S3 per-file 100 percent branch coverage will flag the dead arm.
- failure: Dead branches that the S3 coverage gate cannot satisfy without an ignore comment, which section 16 forbids.
- fix: At S3 replace the proven nonempty stack/dependency/release indexed accesses with total Array/nonempty operations and remove unreachable fallback branches without ignores or non-null assertions.
- seats: part-1/fable-1-8, part-2/fable-1-8
- disposition: backlog
- reason: S3 unreachable-branch coverage cleanup is deferred.

### b08

- file: scratchpad/test/workspaces/WorkspaceCatalogs.test.ts:35
- class: test   severity: backlog
- standard: `.patterns/testing-patterns.md`, “Never use Effect.runSync in tests”; the reviewer brief defers S3 test-canon work.
- evidence: The catalog normalization test uses ordinary `it` and manually executes `Effect.gen` with `Effect.runSync`; the neighboring named-catalog and lookup tests repeat that pattern. `WorkspaceRoot.test.ts:211` also manually runs an Effect to construct its test double.
- failure: Effectful tests bypass the canonical Effect tester and its managed test environment.
- fix: During S3, migrate Effect-returning cases to `it.effect`; use the canonical layer tester for shared effectful construction where applicable. Keep the existing behavioral assertions.
- seats: part-3/sol-1-6
- disposition: backlog
- reason: S3 Effect tester migration is deferred.

### b09

- file: scratchpad/effected/workspaces/ChangeDetector.ts:233
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (prefer the tersest equivalent Effect helper form)
- evidence: `names.map((name) => O.getOrUndefined(MutableHashMap.get(byName, name))).filter((pkg): pkg is WorkspacePackage => pkg !== undefined)` round-trips an `Option` through `undefined` and a hand-written type guard.
- failure: Two passes and a manual refinement where one `filterMap` over the `Option` expresses the same lookup.
- fix: `const affected = A.filterMap(names, (name) => MutableHashMap.get(byName, name));`
- seats: part-1/fable-1-10
- disposition: backlog
- reason: An optional filterMap consolidation; no concrete bug, diagnostic, mandatory law pattern or measured regression under D11.

### b10

- file: scratchpad/effected/workspaces/LockfileReader.ts:174; scratchpad/effected/workspaces/WorkspaceDiscovery.ts:320; scratchpad/effected/workspaces/internal/configDependencyFetch.ts:136
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (span naming); module convention `"LockfileReader.<member>"` at :267, :271, :277; standards/effect-first-development.md (Effect.fn span naming); consistency with WorkspaceCatalogs.ts:633 `Effect.fn("WorkspaceCatalogs.make")` and WorkspaceRoot.ts:285 `Effect.fn("WorkspaceRoot.makeTest")`; standards/effect-first-development.md (span naming); module convention `Effect.fn("Workspaces.resolveManifest")`, `"WorkspaceDiscovery.listPackages"`
- evidence: `static readonly make = Effect.fn("make")(function* (...)` names the construction span `make`, while every other span in the file and in the sibling services is qualified (`"LockfileReader.read"`, `"ChangeDetector.changedFiles"`, `"PackageManagerDetector.detect"`). The upstream arrow was converted to `Effect.fn` for `effectFnOpportunity` (tsconfig.base.json:136). `Effect.fn("make")` here and at WorkspaceSnapshots.ts:304; two services share one anonymous span name while their siblings qualify it. `Effect.fn("expectedIntegrity")`; also internal/patterns.ts:51 `"readPatterns"` and internal/configDependencyResolution.ts:181,208,242,288,394 (`"storesFromLinks"`, `"storesFromEnvironment"`, `"discoverStores"`, `"findInStores"`, `"resolveDirectory"`) use bare span names, while enumerate.ts and resolvePnpmfiles chose `Effect.fnUntraced` for internals.
- failure: A trace shows an anonymous `make` span with no service attribution.
- fix: If trace naming is standardized later, qualify the cited constructor/internal span names or choose fnUntraced for deliberately untraced helpers, preserving operation timing and scope.
- seats: part-1/fable-1-11, part-3/fable-1-14, part-4/fable-1-14
- disposition: backlog
- reason: Qualified span naming is a consistency preference; the reports cite no mandatory naming law or observable correctness failure.

### b11

- file: scratchpad/effected/workspaces/LockfileReader.ts:267
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form)
- evidence: `read: Effect.suspend(Effect.fn("LockfileReader.read")(function* () { return yield* memo; }))` (:267) and the same shape for `integrity` (:277) wrap an existing Effect value in a generator, an `Effect.fn` and a `suspend` only to attach a span.
- failure: Three layers of indirection where the value plus a span is the whole intent.
- fix: `read: Effect.withSpan(memo, "LockfileReader.read")` and `integrity: Effect.withSpan(Effect.gen(...), "LockfileReader.integrity")` (or keep the `Effect.fn` body and drop the outer `Effect.suspend`, which `Effect.fn` already defers).
- seats: part-1/fable-1-12
- disposition: backlog
- reason: Optional Effect wrapper/span consolidation; no current bug or specifically enforced law violation is established.

### b12

- file: scratchpad/effected/workspaces/DuplicateCheck.ts:281
- class: perf   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D11 (perf required only with a measurement or an algorithmic-class win)
- evidence: The reachability walk pops with `queue.shift()` inside `while (queue.length > 0)`; `DependencyGraph.affectedBy` (:243-252) and `sortSubset` (:306-315) in the same module walk the same way with a cursor index. Upstream is identical, so there is no regression, and V8 left-trims `shift` on fast arrays, so no measurement was taken; recorded as backlog only.
- failure: Potentially quadratic queue handling on very large lockfiles under engines without the left-trim fast path.
- fix: `for (let head = 0; head < queue.length; head += 1) { const current = queue[head]; ... }` as `affectedBy` does.
- seats: part-1/fable-1-15
- disposition: backlog
- reason: D11 performance evidence is absent: upstream is identical, no measured regression, and no engine-independent algorithmic-class win is established.

### b13

- file: scratchpad/effected/workspaces/PackedInstall.ts:312; scratchpad/effected/workspaces/WorkspaceCatalogs.ts:238; scratchpad/effected/workspaces/WorkspacesSync.ts:547
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (direct helper refs over trivial wrapper predicates); installed node_modules/effect/dist/Predicate.js:687 and :782; standards/effect-laws-v1.md law 21 (tersest equivalent helper form); standards/effect-laws-v1.md #21 (tersest equivalent helper form); effect/Predicate: `isObjectOrArray` = `typeof x === "object" && x !== null` (Predicate.js:687), `isObjectKeyword` additionally admits functions (Predicate.js:782)
- evidence: `P.isObjectKeyword(x) && !P.isFunction(x)` (PackedInstall.ts:312, :1408; PeerCheck.ts:454) is exactly `P.isObjectOrArray(x)` (`typeof input === "object" && input !== null`; `isObjectKeyword` is that OR `isFunction`). PeerCheck.ts:452 already uses `P.isObjectOrArray(meta)` two lines above the long form. `P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value)` is exactly `P.isObject` in effect 4.0.2 (probe: `P.isObject([])` false, `P.isObject(() => 1)` false, `P.isObject(null)` false); same three-clause helper at WorkspaceSnapshots.ts:177-178, and `P.isObjectKeyword(parsed) && !P.isFunction(parsed)` at WorkspaceRoot.ts:144 where an array short-circuits to the same `false`. Not the inline guards at WorkspaceCatalogs.ts:252/:257/:262: there an array-form `catalogs` still spreads index keys exactly as upstream/pnpm do, so `P.isObject` would change that (silly) input's result. `P.isObjectKeyword(publishConfig) && !P.isFunction(publishConfig)`; same spelling at internal/patterns.ts:40 and internal/catalogs.ts:62. Each is exactly `P.isObjectOrArray(x)`, which the same lane already used elsewhere (catalogs.ts:52,55; patterns.ts:30,36).
- failure: Three roundabout predicates that read as if functions were a meaningful case; no behaviour difference.
- fix: If consolidated later, replace only the proven-equivalent predicate combinations with the corresponding stock Predicate helper, retaining array acceptance where upstream accepts arrays and avoiding stricter decoding.
- seats: part-2/fable-1-9, part-3/fable-1-13, part-4/fable-1-9
- disposition: backlog
- reason: Stock-predicate consolidation is a style preference here; the current guards retain the stated behavior and no mandatory law violation is demonstrated.

### b14

- file: scratchpad/effected/workspaces/PeerCheck.ts:240; scratchpad/effected/workspaces/internal/sourceText.ts:46
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (immutable values for module-level constants; prefer the immutable collection when nothing mutates it); upstream typed both as `ReadonlySet`; standards/effect-laws-v1.md #6 (Effect collections); immutable constants belong in `HashSet`, as internal/limits.ts:32 already does
- evidence: `PEER_RESOLVING_FORMATS` (PeerCheck.ts:240) and `STDERR_METHODS` (SourceBoundary.ts:208) are module-scope `MutableHashSet`s that are only ever read (`MutableHashSet.has`). Upstream exposed them as `ReadonlySet<string>`; the port widened the contract to a mutable structure. `REGEX_AFTER`, `DECLARATIONS` (:64), `CONTROL` (:67), `GLOBAL_OBJECTS` (:70) are module-level constants built with `MutableHashSet.fromIterable`; internal/packedInstallPlan.ts:29 `TRAPS = MutableHashSet.make(...)` likewise. None is mutated after construction.
- failure: A shared mutable singleton where upstream guaranteed read-only; any accidental `MutableHashSet.add` changes module-wide behaviour.
- fix: If constants are standardized later, use immutable HashSet for the cited read-only peer/scanner/lexer/scrub vocabularies while retaining per-call mutable working sets.
- seats: part-2/fable-1-10, part-4/fable-1-12
- disposition: backlog
- reason: All cited constants are private and only read; Effect mutable collections are permitted, so immutability preference alone is outside D11.

### b15

- file: scratchpad/effected/workspaces/VersioningStrategy.ts:148
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)
- evidence: `A.sort(A.fromIterable(MutableHashSet.fromIterable(options.packages)), Str.Order)` builds a hash set only to de-duplicate strings; installed `effect/Array` exports `dedupe` (Array.d.ts:8693), which keeps first occurrences and feeds `A.sort` directly with the same result.
- failure: Extra allocation and an unneeded `MutableHashSet` import for a one-line dedupe.
- fix: `const packages = A.sort(A.dedupe(options.packages), Str.Order);` and drop the `MutableHashSet` import.
- seats: part-2/fable-1-11
- disposition: backlog
- reason: Optional dedupe allocation simplification; no measured regression or algorithmic-class improvement under D11.

### b16

- file: scratchpad/effected/workspaces/README.md:580
- class: docs   severity: backlog
- standard: D4 (README adapted, release boilerplate not carried); EFFECTED_PORT_GOAL.md 10.3 README adaptation
- evidence: Three grep-output lines pasted into 'Port notes -> Attribution': `scratchpad/effected/workspaces/Workspaces.ts:38 * Derived from the option shapes...`, `internal/catalogs.ts:7 // be replaced or vendored...`, `testing.ts:9 * A separate subpath...` (README.md:580-582).
- failure: The attribution block reads as a scraped terminal dump rather than a port note.
- fix: Delete README.md:580-582.
- seats: part-3/fable-1-17
- disposition: backlog
- reason: S2 README cleanup is deferred.

### b17

- file: scratchpad/effected/workspaces/README.md:595
- class: docs   severity: backlog
- standard: D3 (every third-party runtime dep gets a ledger backlog row naming its Effect-native replacement candidate); EFFECTED_PORT_GOAL.md section 13
- evidence: README 'Dependency backlog: None' while the module adds four runtime deps (`@pnpm/catalogs.config`, `@pnpm/catalogs.protocol-parser`, `@pnpm/catalogs.resolver`, `@pnpm/catalogs.types`; ledger `newDeps` each with `replacement: null`, `backlog: []`). internal/catalogs.ts:4-10 names itself the single replacement point for the quartet.
- failure: The D3 ledger contract is unmet for this module and the README states the opposite.
- fix: Central dependency-ledger maintenance should add the four @pnpm catalog dependency replacement candidates and mirror the README dependency-backlog text. Do not assign PORT_LEDGER.json or README Port notes to a repair group.
- seats: part-3/fable-1-18
- disposition: backlog
- reason: outside the port's write surface

### b18

- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:1
- class: docs   severity: backlog
- standard: D4 (carried documentation surfaces, header comments included); .patterns/module-organization.md import grouping
- evidence: `import { $ScratchpadId }` and `import { dual }` sit above the carried upstream header comment (:3-8), splitting it from the top of the file; `A`/`P`/`R` imports are appended after the local `./` imports at :47-49 instead of with the other effect modules.
- failure: The upstream file header no longer heads the file and the import block is split in two.
- fix: Move the two imports into the import block below the header and group the effect module imports together.
- seats: part-3/fable-1-20
- disposition: backlog
- reason: S2 carried-header/import presentation cleanup is deferred.

### b19

- file: scratchpad/effected/workspaces/Workspaces.ts:241
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #21 (tersest equivalent helper form); tsgo `strictEffectProvide` at error (tsconfig.base.json:217); DIAGNOSTIC_EXCEPTIONS.md is the sanctioned exception route
- evidence: `Layer.build(resolverLayer(options)).pipe(Effect.flatMap((context) => manifest.resolve().pipe(Effect.provideContext(context))), Effect.scoped)` replaces upstream `manifest.resolve().pipe(Effect.provide(resolverLayer(options)))` (commit fef6838fd8). The two are the same operation spelled by hand so the `strictEffectProvide` rule does not fire; the per-call resolver layer is the upstream design, which the rule doc says is the entry-point case to disable rather than rewrite.
- failure: Less idiomatic form that hides a deliberate `Effect.provide` from the diagnostic instead of recording the exception; a reader cannot tell it from a scope workaround.
- fix: Leave the diagnostic-forced Layer.build/provideContext composition in the module fix wave. If the per-call provisioning exception is reconsidered centrally, verify the diagnostic contract and update DIAGNOSTIC_EXCEPTIONS.md there; this inventory assigns no exception-registry or shared-config writes.
- seats: part-4/fable-1-8
- disposition: backlog
- reason: outside the port's write surface

### b20

- file: scratchpad/effected/workspaces/internal/catalogs.ts:54
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #21; crispen (no type-appeasement branches)
- evidence: `P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw)` (and :57 for `catalog`) exists only to type-check the array branch of `P.isObjectOrArray`; upstream iterated `Object.entries(raw)` once, treating an array as index-keyed. The explicit type argument instantiates `ReadonlyRecord<"length" | "push" | ..., unknown>`, a type-level fiction that happens to accept arrays.
- failure: Unreadable ternary whose second branch depends on an accidental assignability; any tightening of `R.toEntries` breaks it.
- fix: If simplified later, keep all own enumerable key/value pairs currently accepted from array and object catalog inputs, including sparse arrays and extra enumerable properties. Do not narrow catalog acceptance merely for a simpler helper; coordinate any implementation with r41.
- seats: part-4/fable-1-10
- disposition: backlog
- reason: Optional readability consolidation; no incorrect runtime result is demonstrated, and rejecting array catalogs would be an unforced deviation.

### b21

- file: scratchpad/effected/workspaces/internal/traverse.ts:49
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (docs must describe the shipped behaviour); S2 not yet run (backlog by operator order)
- evidence: traverse.ts:49 still says "a thrown `RangeError`" and WorkspacesSync.ts:247-248 describes the `invalidShape` cause as "an `Error` whose message matches..."; after the tagged-error change the thrown value is `WorkspaceEnumerationDepthError` and the cause a `WorkspaceSyncManifestError`. The new data-last overloads of `findWorkspaceRootSync` (:444-446) and `getWorkspacePackagesSync` (:656-658) are not mentioned by their JSDoc ("The signature is path-first, options second", :405).
- failure: Docs contradict the code on the error classes and omit the added call form.
- fix: Update the two sentences alongside the fable-1-1 deviation entry and add one line per sync entry point naming the `(options)(cwd)` form.
- seats: part-4/fable-1-13
- disposition: backlog
- reason: S2 stale error-class and data-last overload documentation is deferred.

### b22

- file: scratchpad/effected/workspaces/README.md:211,550,557
- class: law   severity: backlog
- standard: D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests
- evidence: part-3/fable-1-1 identifies README.md:211,550,557 retaining method-call spellings after the diagnostic-forced service value migration.
- failure: README examples instruct callers to invoke members that are now Effect values.
- fix: During S2 change stale WorkspaceCatalogs.set()/releaseAgeGate() examples to the current Effect-value spelling. Leave README Port notes bookkeeping to the central codemod.
- seats: part-3/fable-1-1
- disposition: backlog
- reason: S2 stale README service-call examples are deferred; the deviation-recording portions are c01-c04.

### b23

- file: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:OBJECT_METHODS
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md law 6 and the allowlist contract (entries must match a live violation); 2026-10-09 ruling :83-85 (R.fromEntries/R.get for dictionaries)
- evidence: part-3/fable-1-19 and part-3/fable-1-3 identify Object.defineProperty at internal/catalogs.ts:76 and WorkspaceCatalogs.ts:356; OBJECT_METHODS omits defineProperty.
- failure: The native-runtime checker omits defineProperty and cannot report the demonstrated catalog site.
- fix: Central law-checker work should recognize Object.defineProperty and test that scanner coverage. The in-surface catalog implementation repair is r41; do not add an effected allowlist exception.
- seats: part-3/fable-1-19
- disposition: backlog
- reason: outside the port's write surface

### b24

- file: scratchpad/effected/workspaces/node-sync.ts:30
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md #8 (no `node:path` in runtime source) and the allowlist contract ("Do not add entries for scanner misses"); tsgo rule `nodeBuiltinImport` at error (tsconfig.base.json); DIAGNOSTIC_EXCEPTIONS.md contract ("remove the directive and the diagnostic comes back")
- evidence: `process.getBuiltinModule("node:fs")` / `("node:path")` replace upstream ES imports; same at internal/configDependencyFetch.ts:57-58, internal/configDependencyShared.ts:20-21, internal/configDependencyResolution.ts:59-60 (`node:fs/promises`, `node:path`). Commit 2ac543dbcf removed the `nodeBuiltinImport:skip-file` directives (grep `@effect-diagnostics` in the four files: 0), yet scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md still lists those four whole-file exceptions. The native-runtime checker inspects only `ImportDeclaration` specifiers and only in hotspot scope (NoNativeRuntime.ts:379-385; scratchpad/effected is not a hotspot per NoNativeRuntimeHotspots.ts:50-61), so neither gate can see the sites; the same files still `import { tmpdir|homedir } from "node:os"` directly, showing only the scanned specifiers were rewritten. No `scratchpad/effected/workspaces/*` entry for these files in standards/effect-laws.allowlist.jsonc.
- failure: Four native-runtime bindings bypass import-specifier scanners, while a shared exception register still describes removed skip-file directives.
- fix: Central diagnostic/law-checker maintenance must decide and implement detection of process.getBuiltinModule native fs/path bindings and reconcile the stale DIAGNOSTIC_EXCEPTIONS.md rows. Keep this outside module repair groups. Do not add new effected allowlist entries; that proposal is rejected in x08.
- seats: part-4/fable-1-3
- disposition: backlog
- reason: outside the port's write surface

### b25

- file: scratchpad/test/workspaces/SourceBoundary.test.ts
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL D9 + section 14 deviation protocol (ledger entry first, adjusted upstream test cited, README Port notes → Deviations); operator ruling 2026-10-09: one ledger plus README deviation entry per module per systemic class (S.Finite named explicitly)
- evidence: `Offence.line`/`Offence.column` moved from upstream `Schema.Number` to `S.Finite` (:106, :108) under tsgo `schema-number` (effect-tsgo docs/rules/schema-number.md, at error in the gate). This is an observable deviation per section 14 (a different accepted input: `Offence.make({ line: Infinity })` / decoding `{line: NaN}` now fails). README.md:589 says `### Deviations` → `None` and the ledger row `w4-workspaces` has `deviations: []`. The jsonc precedent recorded the same class (PORT_LEDGER.json:627-645, jsonc README.md:294/318) and added `rejects a non-finite width` tests; `rg -n "Infinity|NaN|Finite" scratchpad/test/workspaces/SourceBoundary*.test.ts` finds nothing here.
- failure: Existing tests do not explicitly pin the new rejection of non-finite offence coordinates.
- fix: During S3 add an Offence non-finite line/column rejection assertion without restoring S.Number.
- seats: part-2/fable-1-5
- disposition: backlog
- reason: A new S.Finite rejection assertion is S3 coverage/property work; the law-forced recording portion is c04.

### b26

- file: scratchpad/test/workspaces/WorkspaceCatalogs.test.ts:112
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 / §14
- evidence: Upstream `fromBunBlocks` (`WorkspaceCatalogs.ts:137`) copies `blocks.catalogs` with `Object.assign` onto `{}`. `Object.assign` writes with `[[Set]]`, and an ordinary object's `__proto__` setter replaces `[[Prototype]]` and creates no own key, so `normalize` (`Object.entries` / `R.toEntries`) omits that catalog. The lab copies with object spread (`CopyDataProperties` → `[[DefineOwnProperty]]`), and `normalize`'s `define` (`internal/catalogs.ts:75`) then stores `__proto__` as an own enumerable catalog. `fromManifestWorkspaces` (line 194) and bun `fromLockfile` (line 148) both call `fromBunBlocks`. pnpm's `getCatalogsFromWorkspaceManifest` already spreads, and `scratchpad/test/workspaces/WorkspaceCatalogs.test.ts:112` locks the own-key outcome only for `fromLockfileCatalogs`. README Port notes → Deviations and the ledger `deviations` array are empty. A key-skip copy would satisfy `beep-laws/no-native-runtime` and keep upstream membership, so the retained catalog needs an `upstream-bug` record.
- failure: The existing hostile-key test covers fromLockfileCatalogs but not fromBunBlocks.
- fix: During S3 add the own __proto__ catalog case for fromBunBlocks, retaining the law-forced own-key-safe representation.
- seats: part-3/grok-1-1
- disposition: backlog
- reason: An additional fromBunBlocks hostile-key assertion is S3 coverage work; law-forced copy bookkeeping is c07.

### b27

- file: scratchpad/effected/workspaces/ChangeDetector.ts:197
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); tsgo `lazyEffect` rationale
- evidence: `rootOf` is still a zero-arg thunk (`const rootOf = (): Effect.Effect<...> => discovery.info.pipe(...)`) although `discovery.info` became a value in this port; it is called as `rootOf()` at :203 and :211.
- failure: Indirection the port removed from the service shapes survives in the one local helper that wraps them.
- fix: `const rootOf = Effect.map(discovery.info, (info) => info.root);` and `yield* rootOf` at the two call sites.
- seats: part-1/fable-1-9
- disposition: backlog
- reason: The report establishes optional local-thunk simplification, not an active diagnostic or a mandatory law breach under D11.

## Handled by the deviation codemod

### c01

- file: scratchpad/effected/workspaces/LockfileReader.ts:88,104,106; scratchpad/effected/workspaces/WorkspaceDiscovery.ts:210,212,263; scratchpad/effected/workspaces/WorkspaceCatalogs.ts:490-572; scratchpad/effected/workspaces/WorkspaceSnapshots.ts:161
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 + section 14 (deviation protocol); 2026-10-09 ruling 'one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests'; EFFECTED_PORT_GOAL D9 + section 14; operator rulings 2026-10-09 (law-forced public API changes are allowed but each systemic class gets a ledger + README deviation entry citing the adjusted upstream tests; non-law-forced thunk→value changes must be restored); D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests; EFFECTED_PORT_GOAL D9 + section 14; 2026-10-09 ruling on recording law-forced changes per systemic class; tsgo `lazyEffect` is at error (tsconfig.base.json:165)
- evidence: The strongest evidence is part-3/fable-1-1 and part-1/fable-1-1: the pinned oracle's () => Effect members became Effect values to clear tsgo lazyEffect. LockfileReader.read/integrity/refresh, WorkspaceDiscovery.info/listPackages/refresh and derived members, WorkspaceCatalogs' zero-arg members, and WorkspaceSnapshots.worktree changed; 87 oracle test calls across 11 files were rewritten. README says Deviations: None and the ledger deviations array is empty.
- failure: A reviewer or the promotion grill cannot tell this public contract change from an accident; `makeTest({ read: () => ... })` consumers written against upstream silently stop type-checking with no port note explaining why; `ledger --verify` closes the row with the D9 record missing.
- fix: The central per-module/per-class codemod records law:tsgo/lazyEffect, listing all members and adjusted upstream test lines, and mirrors the deviation in README Port notes. Keep the diagnostic-forced values; do not restore upstream thunks.
- seats: part-1/fable-1-1, part-2/fable-1-6, part-3/fable-1-1, part-4/fable-1-7
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

### c02

- file: scratchpad/effected/workspaces/LayerPolicy.ts:146; scratchpad/effected/workspaces/LockfileReader.ts:257; scratchpad/effected/workspaces/PackageManagerName.ts:309; scratchpad/effected/workspaces/PackedInstall.ts:1406; scratchpad/effected/workspaces/WorkspaceDiscovery.ts:341; scratchpad/effected/workspaces/internal/patterns.ts:83; scratchpad/effected/workspaces/internal/configDependencyShared.ts:96
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 + section 14; 2026-10-09 ruling on recording law-forced changes per systemic class; EFFECTED_PORT_GOAL D9 + section 14 (a different error shape is an observable deviation and needs a `law:<id>` entry); effect-laws-v1.md law 7; D15; `SchemaGetter.parseJson`; D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests; EFFECTED_PORT_GOAL D9 + section 14; WorkspacesSync.ts:208-211 documents both surfaces performing `JSON.parse` for `invalidJson`
- evidence: part-2/fable-1-7 traces the public PackedInstallError.cause from upstream SyntaxError to SchemaError through S.fromJsonString, forced by preferSchemaOverJson. part-1/fable-1-2 supplies a failing decode probe and sites in LayerPolicy, LockfileReader and PackageManagerName; part-3/4 reports trace WorkspaceDiscovery/WorkspacePackage and internal/patterns/configDependencyShared similarly. The synchronous JSON.parse paths still expose SyntaxError; this difference is the law-forced deviation to record.
- failure: Consumers branching on `cause instanceof SyntaxError` or on JSON-schema definition ids diverge from upstream with no port note; the D9 contract ('upstream tests and fixtures are the contract') is unverifiable for the module.
- fix: Central codemod records the schema-JSON transformation class (law:preferSchemaOverJson / law:effect-laws-v1#13), its cause/message differences and all adjusted upstream tests, then updates README Port notes. Keep schema decoding at the forced sites; no new diagnostic suppressions or raw JSON.parse restoration.
- seats: part-1/fable-1-2, part-2/fable-1-7, part-3/grok-1-3, part-3/fable-1-1, part-4/fable-1-2
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

### c03

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:284,527,535,669; scratchpad/effected/workspaces/internal/enumerate.ts:75; scratchpad/effected/workspaces/internal/configDependencyResolution.ts:128,414,420,511; scratchpad/effected/workspaces/internal/packedInstallPlan.ts:244
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 + section 14; 2026-10-09 ruling on recording law-forced changes per systemic class; effect-laws-v1.md law 7; D15; `SchemaGetter.parseJson`; D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests; EFFECTED_PORT_GOAL D9 + section 14 (deviation procedure); 2026-10-09 ruling: one ledger + README deviation entry per module per systemic class, listing sites and adjusted upstream tests
- evidence: part-4/fable-1-1 shows the pinned RangeError test retargeted to WorkspaceEnumerationDepthError at WorkspacesSync.test.ts:209-211 and records S1's tagged-error conversion. The reports also identify LockfileReader, PackageManagerName, ConfigDependencyHooks, WorkspaceCatalogs, WorkspaceDiscovery, WorkspaceRoot, WorkspaceSnapshots, enumerate, configDependencyResolution and packedInstallPlan native-error replacements. The messages were kept while _tag/name/class changed.
- failure: Consumers branching on `cause instanceof SyntaxError` or on JSON-schema definition ids diverge from upstream with no port note; the D9 contract ('upstream tests and fixtures are the contract') is unverifiable for the module.
- fix: Central codemod records one law:effect-laws-v1#7 tagged-error deviation class listing sites and adjusted tests, mirrored in README Port notes. Keep law-forced tagged errors. The verified null-manifest bug repair remains required r31; merely recording it does not repair the bug.
- seats: part-1/fable-1-2, part-3/grok-1-3, part-3/fable-1-1, part-4/fable-1-1
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

### c04

- file: scratchpad/effected/workspaces/SourceBoundary.ts:106,108; scratchpad/effected/workspaces/WorkspaceLayering.ts:75
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL D9 + section 14 deviation protocol (ledger entry first, adjusted upstream test cited, README Port notes → Deviations); operator ruling 2026-10-09: one ledger plus README deviation entry per module per systemic class (S.Finite named explicitly); D9 and section 14; `effect(schemaNumber)` (`Schema.Number` accepts `NaN`, `Infinity`, and `-Infinity`). `jsonc` records the same swap. The round brief ranks docs backlog.; effect-tsgo `schemaNumber` (TS377098); EFFECTED_PORT_GOAL.md §14; D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests
- evidence: Offence.line/column at SourceBoundary.ts:106,108 and LayeringReport.edgeCount at WorkspaceLayering.ts:75 changed from S.Number to S.Finite under schemaNumber. Decodes now reject NaN and infinities while normal scanner/layering outputs remain finite. The ledger and README have no deviation record.
- failure: An unrecorded behaviour deviation: a later reviewer or the promotion re-grill cannot tell a law-forced change from drift, and the new rejection is untested.
- fix: Central codemod records one law:tsgo/schemaNumber S.Finite class with all sites and adjusted upstream tests and mirrors README Port notes. Do not restore S.Number. The optional new rejection assertion is S3 backlog b25.
- seats: part-2/fable-1-5, part-2/grok-1-5, part-3/grok-1-2, part-3/fable-1-1
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

### c05

- file: scratchpad/test/workspaces/LayerPolicy.test.ts:102
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 + section 14; 2026-10-09 ruling on recording law-forced changes per systemic class; D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests
- evidence: LayerPolicy.test.ts:102 was adjusted from definitions.LayerPolicyEncoded to identity-derived @beep/scratchpad/effected/workspaces/LayerPolicy/LayerPolicyEncoded keys; part-3/fable-1-1 cites the identity migration commit and other JSON Schema key tests. This is the operator-required identity step, not an unforced API edit.
- failure: Consumers branching on `cause instanceof SyntaxError` or on JSON-schema definition ids diverge from upstream with no port note; the D9 contract ('upstream tests and fixtures are the contract') is unverifiable for the module.
- fix: Central codemod records one identity-key deviation class, listing schema sites and adjusted JSON Schema test lines, and mirrors README Port notes. Preserve identity annotations and derived keys.
- seats: part-1/fable-1-2, part-3/fable-1-1
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

### c06

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:59; scratchpad/effected/workspaces/index.ts:140
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL D2 (superset export rule: additions listed under README Port notes → Added exports and ledger `exportsAdded`)
- evidence: WorkspaceEnumerationDepthError is exported from WorkspacesSync.ts but exportsAdded is empty and README Added exports says None. Its missing index.ts re-export is an actual code defect required in r51; recording the addition is separate bookkeeping.
- failure: A consumer of the package entry cannot name or `instanceof`-match the error class the public function throws, and the D2 additions inventory is wrong.
- fix: Central codemod appends added symbols to exportsAdded and generates README Port notes -> Added exports after the repair wave. Do not assign ledger/Port-notes files to r51's group.
- seats: part-4/fable-1-6
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

### c07

- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:160
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 / §14
- evidence: The oracle Object.assign in CatalogSet.fromBunBlocks used [[Set]], so __proto__ could alter the prototype or vanish as an own key. The lab's spread uses own-property creation, matching the existing hostile-key catalog contract. This follows the native-runtime replacement class and the later operator's R.fromEntries/R.get own-key representation ruling; the report asks only for recording and a new test.
- failure: `CatalogSet.fromBunBlocks({ catalogs: JSON.parse('{"__proto__":{"evil":"1.0.0"}}') })` keeps an own `__proto__` catalog whose range is `1.0.0`. Upstream's assign path yields an empty set. When `catalog` is also an object and the `__proto__` value has a `default` object, upstream's `[[Set]]` reads that inherited `default` and merges it into the default catalog; the spread path's default catalog contains only the explicit `catalog` block.
- fix: Central codemod records the module's native-runtime replacement class, including fromBunBlocks own-key semantics, all seven allowlist replacement sites and adjusted freeze/prototype/order tests. Keep own-key-safe copies; do not reintroduce Object.assign/defineProperty or emulate inherited __proto__ setter effects. The optional extra fromBunBlocks test is b26.
- seats: part-3/grok-1-1
- disposition: handled by the deviation codemod
- reason: Recording a law/diagnostic-forced change is centralized per module and systemic class; no module repair-group bookkeeping writes.

## Rejected

### x01

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:669
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 11.1, section 14
- evidence: Oracle `src/WorkspacesSync.ts:626` throws `new RangeError(\`getWorkspacePackagesSync: ${badMaxDepthMessage(maxDepth)}\`)`. Oracle `__test__/WorkspacesSync.test.ts:206-208` asserts `RangeError`. The lab test `scratchpad/test/workspaces/WorkspacesSync.test.ts:209-211` asserts `WorkspaceEnumerationDepthError`. README Port notes and the `w4-workspaces` ledger row both record no deviations. `traverse.ts:49` still describes this path as a thrown `RangeError`. `.patterns/error-handling.md` does not require a tagged error for this synchronous throw.
- failure: `getWorkspacePackagesSync` throws `WorkspaceEnumerationDepthError` (`WorkspacesSync.ts:59`). `instanceof RangeError` is false. The sentence is unchanged. The new class is exported from this module while README Added exports is None, and the upstream assertion was retargeted with no ledger entry.
- fix: Throw `new RangeError(\`getWorkspacePackagesSync: ${badMaxDepthMessage(maxDepth)}\`)`, delete `WorkspaceEnumerationDepthError`, and restore the three `RangeError` assertions.
- seats: part-4/grok-1-1
- disposition: rejected
- reason: Contradicts effect-laws-v1 law 7 and the tagged-error ruling: restoring native Error/RangeError is not permitted; the law-forced class change is c03.

### x02

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:284
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 14
- evidence: Oracle `src/WorkspacesSync.ts:243` uses `new Error("package.json is not a JSON object")`, and lines 485 and 493 use `new Error(\`version must be a string, got ${typeof version}\`)` and `new Error("version must be a non-empty string")`. The same sentences are still what `scratchpad/test/workspaces/WorkspacesSync.test.ts:668-670` reads from `cause.message`. No deviation is recorded.
- failure: Those three `invalidShape` causes (`WorkspacesSync.ts:284`, `:527`, `:535`) are `WorkspaceSyncManifestError` (`:35`), so the skip `cause` carries `_tag: "WorkspaceEnumerationDepthError"`'s sibling tag `WorkspaceSyncManifestError` and `name` `WorkspaceSyncManifestError`. `instanceof Error` and `.message` still hold. Section 14 counts a new error tag as a deviation.
- fix: Restore the three `new Error(...)` values and delete `WorkspaceSyncManifestError`.
- seats: part-4/grok-1-2
- disposition: rejected
- reason: Contradicts effect-laws-v1 law 7 and the tagged-error ruling: restoring native Error/RangeError is not permitted; the law-forced class change is c03.

### x03

- file: scratchpad/effected/workspaces/internal/enumerate.ts:75
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 14
- evidence: Oracle `src/internal/enumerate.ts:60` is `Effect.die(new Error(\`enumerate: ${badMaxDepthMessage(maxDepth)}\`))`. The lab dies with `EnumerationOptionsError.make` (`enumerate.ts:23`). No deviation is recorded.
- failure: A bad `maxDepth` defect is `EnumerationOptionsError` (`_tag` and `name` `EnumerationOptionsError`). The message text is the upstream sentence. Callers inspecting the die value no longer see a plain `Error`.
- fix: Restore `Effect.die(new Error(\`enumerate: ${badMaxDepthMessage(maxDepth)}\`))` and delete `EnumerationOptionsError`.
- seats: part-4/grok-1-3
- disposition: rejected
- reason: Contradicts effect-laws-v1 law 7 and the tagged-error ruling: restoring native Error/RangeError is not permitted; the law-forced class change is c03.

### x04

- file: scratchpad/effected/workspaces/internal/packedInstallPlan.ts:244
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 14
- evidence: Oracle `src/internal/packedInstallPlan.ts:224` returns `Result.fail(new Error("package.json is not an object"))`. Syntax errors still return the `JSON.parse` throw (`packedInstallPlan.ts:238-241`, matching the oracle). No deviation is recorded.
- failure: A parsed non-object manifest fails as `PackedManifestError` (`packedInstallPlan.ts:24`) with the same message. The failure value's `_tag` and `name` are `PackedManifestError`.
- fix: Return `Result.fail(new Error("package.json is not an object"))` and delete `PackedManifestError`.
- seats: part-4/grok-1-4
- disposition: rejected
- reason: Contradicts effect-laws-v1 law 7 and the tagged-error ruling: restoring native Error/RangeError is not permitted; the law-forced class change is c03.

### x05

- file: scratchpad/effected/workspaces/internal/configDependencyShared.ts:96
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 14
- evidence: Oracle `src/internal/configDependencyShared.ts:79-81` is `Effect.try({ try: () => JSON.parse(text.value), catch: (cause) => hooksError(name, cause) })`, so `cause` is the `SyntaxError`. Lab `S.decodeEffect(JsonValue)` maps the failure through `hooksError`. `SchemaGetter.parseJson` (`packages/effect/src/SchemaGetter.ts:1264-1270`) drops that `SyntaxError` and fails with `SchemaIssue.InvalidValue` expected `"a valid JSON string"`. `SchemaError.message` (`Schema.ts:1220-1221`) is `SchemaIssue.defaultFormatter`, which renders `Expected a valid JSON string` (`SchemaIssue.ts:1191-1193`, `1327-1328`). `CatalogAssemblyError.message` (`scratchpad/effected/npm/CatalogAssemblyError.ts:92-96`) appends `cause.message`. No deviation is recorded. The sync reader in this module still uses `JSON.parse`, so this substitution is not what the green gates require.
- failure: An unparseable config-dependency `package.json` makes `CatalogAssemblyError.message` end in the schema sentence. Upstream ends in the `SyntaxError` message (`Unexpected token …`). `cause instanceof SyntaxError` is false.
- fix: Parse with `Effect.try(() => JSON.parse(text.value))` and `hooksError(name, cause)` on the thrown `SyntaxError`, as the oracle does.
- seats: part-4/grok-1-5
- disposition: rejected
- reason: Contradicts the diagnostic/law-forced schema-decoding ruling: a synchronous JSON.parse boundary does not justify restoring it at Effect decode sites; c02 records the allowed cause change.

### x06

- file: scratchpad/effected/workspaces/internal/patterns.ts:83
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 14
- evidence: Oracle `src/internal/patterns.ts:77-79` stores the `JSON.parse` throw as `PatternReadFailure.cause` with `kind: "invalidJson"`. The lab stores the `SchemaError` from `S.decodeEffect(JsonValue)`. `WorkspaceDiscovery.ts:448-455` copies `failure.cause` onto `WorkspaceDiscoveryError`. That error's own `message` (`WorkspaceDiscovery.ts:72-74`) stays `Workspace discovery failed at ${path} (${kind})`. The cause field is public. Same `SchemaGetter.parseJson` drop of the `SyntaxError` as grok-1-5. No deviation is recorded.
- failure: An unparseable root `package.json` (no usable `pnpm-workspace.yaml`) reports `invalidJson` whose `cause` is a `SchemaError` with message `Expected a valid JSON string`. Upstream's `cause` is the `SyntaxError`.
- fix: Restore `Effect.try(() => JSON.parse(content))` and put that thrown value on `invalidJson`.
- seats: part-4/grok-1-6
- disposition: rejected
- reason: Contradicts the diagnostic/law-forced schema-decoding ruling: a synchronous JSON.parse boundary does not justify restoring it at Effect decode sites; c02 records the allowed cause change.

### x07

- file: scratchpad/effected/workspaces/internal/configDependencyResolution.ts:128
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, section 14
- evidence: Oracle `src/internal/configDependencyResolution.ts:105` fails with `hooksError(name, new Error(...))`; `:395` and `:400-402` use `new Error(message)` or `new Error(message, { cause })`; `:487-493` uses `new Error(...)`. The lab uses `ConfigDependencyResolutionError.make` at `:128`, `:414`, `:420`, and `:511`. `{ message: S.String }` exposes that string as `.message` (the skip tests in grok-1-2), and `CatalogAssemblyError.message` splices `cause.message`, so the assembly sentence matches. No deviation is recorded.
- failure: The `CatalogAssemblyError` cause for a `..` segment, an ambiguous store match, a not-installed dependency, and a lookup miss is `ConfigDependencyResolutionError` (`_tag` and `name`). Upstream's cause is a plain `Error` with the same message, and with `.cause` set to the fetch cause when one exists.
- fix: Pass `new Error(message)` and `new Error(message, { cause })` into `hooksError`, and delete `ConfigDependencyResolutionError`.
- seats: part-4/grok-1-7
- disposition: rejected
- reason: Contradicts effect-laws-v1 law 7 and the tagged-error ruling: restoring native Error/RangeError is not permitted; the law-forced class change is c03.

### x08

- file: scratchpad/effected/workspaces/node-sync.ts:30
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md #8 (no `node:path` in runtime source) and the allowlist contract ("Do not add entries for scanner misses"); tsgo rule `nodeBuiltinImport` at error (tsconfig.base.json); DIAGNOSTIC_EXCEPTIONS.md contract ("remove the directive and the diagnostic comes back")
- evidence: `process.getBuiltinModule("node:fs")` / `("node:path")` replace upstream ES imports; same at internal/configDependencyFetch.ts:57-58, internal/configDependencyShared.ts:20-21, internal/configDependencyResolution.ts:59-60 (`node:fs/promises`, `node:path`). Commit 2ac543dbcf removed the `nodeBuiltinImport:skip-file` directives (grep `@effect-diagnostics` in the four files: 0), yet scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md still lists those four whole-file exceptions. The native-runtime checker inspects only `ImportDeclaration` specifiers and only in hotspot scope (NoNativeRuntime.ts:379-385; scratchpad/effected is not a hotspot per NoNativeRuntimeHotspots.ts:50-61), so neither gate can see the sites; the same files still `import { tmpdir|homedir } from "node:os"` directly, showing only the scanned specifiers were rewritten. No `scratchpad/effected/workspaces/*` entry for these files in standards/effect-laws.allowlist.jsonc.
- failure: Four runtime files bind `node:path`/`node:fs` exactly as before but are invisible to the tsgo rule, the beep law and the exception register: the operator can no longer overrule the exception by removing a directive, and the 2026-10-09 fix wave (replace every recorded native-runtime site) will miss them.
- fix: Restore the upstream `import ... from "node:fs" / "node:path" / "node:fs/promises"` lines with the whole-file `@effect-diagnostics nodeBuiltinImport:skip-file` directive and the reason already recorded in DIAGNOSTIC_EXCEPTIONS.md, and add matching `beep-laws/no-native-runtime` allowlist entries (`kind: "node-runtime-import"`) so the sites are tracked for the fix wave.
- seats: part-4/fable-1-3
- disposition: rejected
- reason: The proposed new effected allowlist entries contradict the operator's removal of every effected entry; restoring scanner-visible imports plus suppression is not a compliant fix. The separate checker/registry work is backlog b24.


