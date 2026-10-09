### sol-1-1
- file: scratchpad/effected/workspaces/PeerCheck.ts:275
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `PeerCheck.run`’s documented requirement to retain `unresolvedEdge` for an uncovered link target.
- evidence: A read-only `bun -e` probe parsed a pnpm lockfile with a root dependency on `link:../packages/a`, an internal importer at `packages/a`, and a supplied manifest for that internal package. Both the port and pinned oracle returned `unverified: []` and reported the internal package’s missing `react` peer. Replacing the link with `link:../../packages/a` produced the same result. `linkTargetPath` discards `..` when its accumulated path is empty.
- failure: A dependency outside the workspace is joined to an unrelated internal package with the same remaining path. The report attributes that internal package’s peers to the external dependency and claims the link was verified, although the external manifest was never supplied or examined.
- fix: Preserve unmatched leading `..` segments during normalization, and never cancel an existing `..` with another `..`. An external target must remain distinct from a workspace-relative target and retain the unverified marker. Record the upstream-bug deviation and add a regression for a root link escaping the workspace.

### sol-1-2
- file: scratchpad/effected/workspaces/SourceBoundary.ts:666
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `SourceBoundary.scan`’s path-specific `allow` and `allowRules` contract.
- evidence: An in-memory `bun -e` probe scanned `/repo/src/a.ts` containing `process.cwd()`, with `allow: ["zallowed/**"]`. Without an alias, both the port and pinned oracle reported `src/a.ts:1:18 process process`. Adding `/repo/zallowed` as a symlink to `/repo/src` changed both results to `files: ["zallowed/a.ts"]`, `allowed: ["zallowed/a.ts"]`, and `violations: []`.
- failure: The global realpath visited set lets the first directory alias determine the waiver policy for every alias of that directory. An allowed symlink can therefore suppress an offence under an unallowed source path. The same issue affects `allowRules`.
- fix: Use ancestry-based realpath cycle detection instead of globally dropping previously visited directories, so distinct logical paths receive their own waiver evaluation while ancestor cycles remain bounded. Record the upstream-bug deviation and add the allowed-alias regression.

### sol-1-3
- file: scratchpad/effected/workspaces/PackedInstall.ts:1221
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the `PackedInstallResult.tarballs` contract identifies each packed package by name.
- evidence: A read-only `bun -e` probe used `MemoryFileSystem` and `ScriptedSpawner`, with discovery naming the carrier `carrier` but the tarball manifest naming it `wrong-package`. Both the port and pinned oracle succeeded and returned `{"carrier":"/scratch/tarballs/0/wrong.tgz"}`. The port also recorded the consumer’s carrier as `carrier`. No real package-manager process or disk write was involved. Manifest-name validation exists for replacement packages at line 1267, but the workspace closure bypasses it.
- failure: A stale or incorrectly selected build artifact can pass the packed-install proof under another package’s identity. The result claims it packed the requested carrier even though the archive’s manifest identifies a different package.
- fix: Check each workspace tarball manifest’s `name` against the closure package’s name before accepting it or installing consumers; fail `PackFailed` on a mismatch or missing name. Record the upstream-bug deviation and add a mismatched-carrier regression.

### sol-1-4
- file: scratchpad/effected/workspaces/ReleaseTag.ts:283
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `classifyTag` accepts arbitrary tag strings, and the retained `TrackingTag.test.ts:102` contract says non-derivable versions return an empty result without throwing.
- evidence: Read-only probes against both the port and pinned oracle produced `Schema validation failed` for `classifyTag("v9007199254740992")` and `TrackingTag.forVersion("9007199254740992.2.3")`. The digit grammar accepts these inputs, but their converted numeric fields fail `TrackingTag`’s `S.Int` construction.
- failure: An arbitrary repository tag or version containing an oversized numeric component aborts these query APIs with a synchronous exception instead of returning `unrecognized` or an empty alias list.
- fix: Validate converted major/minor values against the existing integer field schemas before constructing a `TrackingTag`. Return `unrecognized` from the tracking-classification branch and `[]` from alias derivation when those fields cannot be represented. Record the upstream-bug deviation and add both overflow regressions.

### sol-1-5
- file: scratchpad/effected/workspaces/ReleaseTag.ts:81
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `versionCore`’s documented `X.Y.Z[-pre][+build]` grammar and the retained classifier test that junk remains `unrecognized`.
- evidence: Read-only probes showed that `SemVer.parseResult` rejects `"1.2.3+"`, `"1.2.3+bad/path"`, `"1.2.3-"`, and `"1.2.3-01"`, while both the port and pinned oracle classify all four as releases. Both also derive `v1` and `v1.2` from the first two inputs. The implementation discards build metadata and removes the prerelease suffix without validating either suffix.
- failure: Malformed version text is presented as a release, and malformed build metadata can produce stable floating aliases. Invalid suffixes receive the same classification as valid release versions.
- fix: Validate the complete version grammar before extracting its numeric core, preserving the existing treatment of valid build metadata and prereleases. Keep the separate truncated tracking-tag grammar. Record the upstream-bug deviation and add malformed-suffix regressions.

### sol-1-6
- file: scratchpad/effected/workspaces/ReleaseTag.ts:28
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-35; D5.
- evidence: `TagStyle` is a named, exported, annotation-bearing literal schema implemented with `S.Literals`. `VersioningStrategyType` has the same construction at `VersioningStrategy.ts:36`. Both declarations remain in the reviewed commit despite the stated green gates; the module’s port notes and ledger record no exception.
- failure: These named domains violate the rule reserving `S.Literals` for anonymous inline unions. Their runtime vocabulary lacks the canonical `LiteralKit` surface from which enum values, guards, and matching helpers should derive.
- fix: Replace both named `S.Literals` constructions with annotated `LiteralKit` constructions, preserving their names, literal values, and derived public types.

### sol-1-7
- file: scratchpad/effected/workspaces/ReleaseTag.ts:227
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; D5.
- evidence: `TagClassification` is a pure domain result union defined only as a TypeScript type. Other schema-representable data declarations remain type-only, including `VersioningStrategy.ts:50` (`ClassifyOptions`) and `:88` (`PackageRelease`), `SourceBoundary.ts:56` (`BoundaryRule`) and `:86` (`BoundaryFixture`), and `PackedInstall.ts:699` (`Replacement`) and `:707` (`ClosurePlan`). These are data shapes rather than service contracts or type-level machinery, and no modeling exception is recorded.
- failure: The port retains compile-time declarations as the source of truth for domain results, configuration, and plan data. Runtime guards, codecs, and arbitraries cannot derive from those declarations, leaving the schema-first requirement unmet.
- fix: Define annotated structural schemas for these pure data shapes and derive their existing types from them. Use schema unions for the variants, preserve current structural inputs and discriminator spellings, and leave service/function contracts as interfaces.

### sol-1-8
- file: scratchpad/effected/workspaces/Publishability.ts:80
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; S2 is deferred by operator order.
- evidence: The focus files retain forbidden `@example` and `@remarks` carriers. For example, `Publishability.ts` uses `@example` at lines 80, 101, and 148. Exported declarations also lack canonical `@category` and `@since 0.0.0` metadata; several runtime exports have no required Example.
- failure: The documentation does not yet satisfy the repository’s public API documentation grammar and metadata requirements. This is deferred S2 work, not a required round-one gate.
- fix: During S2, preserve the carried prose and examples, convert them to titled `**Example** (Title)` and `**Details**` sections, supply required metadata and value-level examples, and replace forbidden example scaffolding with compilable examples.

### sol-1-9
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:115
- class: test   severity: backlog
- standard: D10, the schema/codec round-trip and parser/formatter property floor; S3 is deferred by operator order.
- evidence: `git grep -n -E 'Arbitrary|fast-check|fcRuns|@beep/fc' 3fa5876 -- scratchpad/test/workspaces` returned no matches. The focused tests use concrete examples, including enumerated tag round trips, rather than generated schema round trips and parser/formatter properties.
- failure: The retained tests do not yet supply D10’s property floor for the exported schemas and tag parsing/formatting surfaces. The missing generated inputs also leave the malformed-suffix and numeric-overflow cases above unexercised. This is deferred S3 work; no coverage percentage is inferred.
- fix: During S3, add canonical generated properties using `Arbitrary.schema` and `fcRuns`, covering schema encode/decode round trips and tag fidelity/idempotence while retaining the upstream example and oracle suites.

REQUIRED: 7
BACKLOG: 2