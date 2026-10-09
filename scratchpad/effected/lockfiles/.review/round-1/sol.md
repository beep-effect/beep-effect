### sol-1-1

- file: scratchpad/effected/lockfiles/UnsupportedLockfileVersion.ts:74
- class: type-safety   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-35; D11; section 14’s `upstream-bug` exception.   evidence: A read-only probe against both the port and pinned oracle returned `true` for `{ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: 3 }`. Reading `cause.message.length` after that successful narrowing threw `TypeError`. Both implementations also accepted `format: "yarn"`, although the narrowed type permits only `"npm" | "pnpm"`. The test at `scratchpad/test/lockfiles/Lockfile.test.ts:1601` explicitly preserves the incomplete validation; it does not establish the stronger TypeScript predicate contract.
- failure: The predicate narrows arbitrary unknown values to a type whose required fields and literal domain it has not validated. Callers can access supposedly present fields and crash, or treat an unsupported format as a gated format.
- fix: Define a schema for the complete record, derive the guard with `S.is`, and retain the own-property check for `_tag`. Validate `lockfileVersion`, `message`, and the exact format literals. Record the demonstrated upstream type-guard bug under section 14 and adjust the near-miss test that currently expects the incomplete record to pass.

### sol-1-2

- file: scratchpad/effected/lockfiles/internal/bun.ts:129
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 10; `standards/effect-first-development.md` EF-38.   evidence: Native `.sort()` remains here and at `internal/pnpm.ts:250`, `internal/pnpm.ts:386`, and `internal/yarn.ts:196`. The green gate misses these sites because `NoNativeRuntime.ts` detects native sorts only when `inHotspotScope` is true. A read-only probe of `isNoNativeRuntimeExtraCheckHotspot` returned `false` for all three files; no lockfiles allowlist entry covers them.
- failure: Four production sorting operations remain outside the required Effect collection API despite the green native-runtime gate.
- fix: Use `A.sort` with an explicit order: descending prefix length for bun and ascending string order for unresolved edge names. Consume the returned sorted array so bun’s deepest-first resolution order remains unchanged.

### sol-1-3

- file: scratchpad/effected/lockfiles/internal/shared.ts:288
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3 and EF-19.   evidence: Native `JSON.stringify(raw)` remains in the version-error message; `internal/pnpmEnv.ts:90` and `:94` also call `JSON.stringify(key)`. The tsgo `preferSchemaOverJson` implementation checks calls inside recognized Effect contexts, while these calls occur in ordinary arrow-function bodies. The native-runtime checker has no JSON-method detection branch. These are concrete gaps in the green gates.
- failure: Error formatting still performs JSON serialization outside the required schema codec path.
- fix: Encode the interpolated values with schema JSON codecs and compose the result into the existing typed failure. Reuse `pnpmEnv.ts`’s existing `JsonString` codec for package keys, preserving the current quoting and error-message bytes.

### sol-1-4

- file: scratchpad/effected/lockfiles/PnpmExtension.ts:17
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `PnpmCatalogs` independently spells the same record and specifier/version shape implemented by `PnpmExtension.catalogs`. Other representable domain payloads remain handwritten: `PeerDeclarations`, `ContentFailure`, `FramingFailure`, `ParseFailure`, `LockfileFields`, and `WorkspaceEntry` in `internal/shared.ts`; `SelectedDocument` and `PnpmStream` in `internal/documents.ts`; and `ResolvedEdges` in `internal/pnpm.ts`. These are payload shapes, rather than service contracts or overload machinery.
- failure: The module retains parallel TypeScript-only definitions for domain data and failure variants, so schema-derived validation, guards, and generators cannot share one authoritative definition.
- fix: Derive `PnpmCatalogs` from a named catalog schema reused by the extension. Define structural schemas for the internal payloads and a schema union discriminated by `stage` for `ParseFailure`, then derive their types. Preserve the existing object shapes and discriminator spellings.

### sol-1-5

- file: scratchpad/effected/lockfiles/LockfileFormat.ts:24
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b; D5.   evidence: `LockfileFormat` is a named, exported, annotation-bearing literal domain used by schemas, dispatch, and filename mappings, but is implemented with `S.Literals`. The standard reserves `S.Literals` for anonymous inline unions that are never referenced by name.
- failure: The central format domain does not meet the required `LiteralKit` modeling convention.
- fix: Replace this constructor with `LiteralKit(["bun", "npm", "pnpm", "yarn"])`, retaining the current identity annotation, same-name type alias, literal order, and filename behavior.

### sol-1-6

- file: scratchpad/effected/lockfiles/internal/npm.ts:29
- class: schema   severity: required
- standard: The goal’s operator revision, step 4: every schema takes its identity from IdentityComposer, with field and schema annotations; `standards/effect-first-development.md` EF-12.   evidence: `NpmPackageEntry`, `NpmVersionProbe`, and `NpmLockfileRaw` have no composer annotations, and their fields lack annotation metadata. The same omission occurs in named raw schemas in `internal/bun.ts`, `internal/pnpm.ts`, `internal/pnpmEnv.ts`, `internal/yarn.ts`, and `internal/shared.ts`. Public class annotations do not cover these separate schema values.
- failure: Parser-boundary schemas still lack the required identity and semantic metadata, leaving the identity step incomplete on the reviewed surface.
- fix: Add file-local `$ScratchpadId` composers and meaningful schema and field annotations to the named raw schemas. Keep their permissive boundary shapes and decoding behavior unchanged.

### sol-1-7

- file: scratchpad/effected/lockfiles/internal/yarn.ts:41
- class: docs   severity: backlog
- standard: D9 and section 14; tsgo rule `schemaNumber`; the operator’s instruction to classify documentation findings as backlog in round 1.   evidence: A read-only differential probe with yarn `__metadata.version: .inf` succeeded upstream with `lockfileVersion: "Infinity"` but failed in the port with `LockfileParseError`, validation stage, and `SchemaError` cause. For pnpm `lockfileVersion: .inf`, upstream returned an `UnsupportedLockfileVersion` cause while the port returned a `SchemaError` cause through `internal/shared.ts:302`. The README says “Deviations: None,” and the lockfiles ledger has an empty deviations array.
- failure: The law-motivated `Number` → `Finite` changes narrow accepted input and change the observable version-rejection cause without documenting those differences.
- fix: Record these differences as `law:schemaNumber` deviations in the ledger and README, with focused witnesses for accepted-input and cause changes. Retain the finite-number schemas.

### sol-1-8

- file: scratchpad/effected/lockfiles/index.ts:21
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; goal section 10.2; S2 deferral.   evidence: A read-only scan of the module’s 21 TypeScript files found 29 `@remarks` tags, three `@example` tags, zero `@category` tags, and zero `@since` tags. The entrypoint example also contains a `declare` statement. Exported classes such as `BunExtension` have no required value-level Example.
- failure: The carried documentation does not yet satisfy the required section grammar, export metadata, or compiling-example contract.
- fix: Perform the S2 conversion while preserving upstream prose: convert carriers to titled sections, add canonical categories and `@since 0.0.0`, and supply concrete compiling examples for value-level exports.

### sol-1-9

- file: scratchpad/effected/lockfiles/README.md:28
- class: docs   severity: backlog
- standard: Goal section 10.3, README adaptation; `standards/effect-laws-v1.md` law 2; S2 deferral.   evidence: The README retains npm/version/Node/TypeScript badges, the pre-1.0 stability block, `pnpm-plugin-effect` guidance, and registry installation instructions. Its quick start imports `@effected/lockfiles` and the root `effect` barrel at lines 45–46.
- failure: The lab README directs readers to the published upstream package and demonstrates imports that do not exercise this port or meet the repository’s import convention.
- fix: Remove the upstream installation and release boilerplate required by section 10.3, rewrite examples to lab imports and dedicated Effect module imports, and preserve the API explanations and attribution.

### sol-1-10

- file: scratchpad/test/lockfiles/roundtrip.property.test.ts:181
- class: test   severity: backlog
- standard: D10; goal section 11.2; `goals/effect-vitest-canon/SPEC.md` property-run configuration; S3 deferral.   evidence: The suite registers round-trip properties for six schemas. It has no round-trip registrations for `BunExtension`, `ConfigDependencyLock`, `LockfileFormat`, `LockfileParseError`, `LockfileFramingError`, `PackageManagerLock`, `PnpmExtension`, or `WorkspaceManifest`. `lockfileArb` never supplies an extension. The module contains no `fcRuns` configuration and no generated parser-fidelity property.
- failure: The exported-schema property floor is incomplete, format extensions never participate in generated lockfile round trips, and property runs do not use the repository’s explicit run-floor configuration.
- fix: During S3, add the missing schema properties and extension variants, retain the upstream suites, add generated parser-fidelity checks against the pinned oracle, and configure property runs through `fcRuns(n)`.

### sol-1-11

- file: scratchpad/test/lockfiles/Lockfile.test.ts:74
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; goal section 11.2; S3 deferral.   evidence: The Effect test asserts `O.isSome(byId)` through `assert.isTrue`, then unwraps with `O.getOrUndefined`. Lines 78–80 similarly assert `O.isNone` through boolean assertions. The same assertion style appears elsewhere in the module.
- failure: Option outcomes use manual predicate assertions instead of the canonical assertion helpers that assert and narrow the outcome directly.
- fix: Replace these checks with `assertSome` and `assertNone` from `@effect/vitest/utils`, then inspect the narrowed `Some.value`. Keep plain-value assertions unchanged.

REQUIRED: 6
BACKLOG: 5