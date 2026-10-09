### sol-1-1

- file: scratchpad/effected/workspaces/LockfileReader.ts:54
- class: schema   severity: required
- standard: `standards/effect-first-development.md`, “Tagged error with Identity composer” template: cause-carrying errors explicitly use `S.Defect({ includeStack: true })`; D11.   evidence: A read-only `bun -e` probe encoded `LockfileReadError`, `ChangeDetectionError` and `LayerPolicyError` with an `Error("original")` cause. Each encoded cause contained only `{ name: "Error", message: "original" }`. The control using `S.Defect({ includeStack: true })` retained `stack`. The same omission exists in `ChangeDetector.ts:87` and `LayerPolicy.ts:38`.
- failure: Serializing these errors loses the originating failure’s stack, contrary to the explicit error-schema requirement. The green type and lint gates do not establish stack preservation.
- fix: Change these three cause fields to `S.Defect({ includeStack: true })`, retaining their field annotations. Record the law-forced serialization deviation under section 14 and add the smallest encoding assertion.

### sol-1-2

- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:101
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; D5 and D11.   evidence: `PeerDependencyRules` is a pure record-and-array payload declared only as an interface. The same applies to `HookReplayContext` at line 161, `HookReplay` at line 190 and `HookInjection` at line 211. `HookReplaySource` at line 141 is a handwritten literal union. Runtime validation separately reimplements parts of these shapes through `stringArrayOr`, `isStringRecord` and `peerRulesOr`.
- failure: The replay configuration, provenance and result models have no schema source of truth. Their types and tolerant validation logic can diverge independently; the required schema-derived construction, guards and codecs are unavailable. These are data payloads, beyond the permitted service-contract interface exception.
- fix: Define annotated schemas for these payloads and derive their existing type names from `.Type`; model `HookReplaySource` with `LiteralKit`. Preserve the plain external object shapes and current tolerant threading semantics, deriving the applicable guards from the schemas rather than introducing stricter hook rejection.

### sol-1-3

- file: scratchpad/effected/workspaces/LockfileReader.ts:114
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5; `standards/effect-first-development.md` EF-33; D11.   evidence: `LockfileReaderOptions` consists solely of the optional configuration fields `cwd` and `stopAt`, but is declared as an interface and has no corresponding runtime schema. `LockfileReaderShape` is a service contract and qualifies for the interface exception; this options payload does not.
- failure: Root-resolution configuration remains a handwritten data model, so its shape, optionality and future codecs cannot derive from one executable contract.
- fix: Add an annotated options schema and derive `LockfileReaderOptions` from its `.Type`. Preserve the existing distinction between `cwd?: string` and `stopAt?: string | undefined`, and retain lazy cwd resolution.

### sol-1-4

- file: scratchpad/effected/workspaces/PackageManagerName.ts:126
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/ARCHITECTURE.md`, Core Principle 5; D11.   evidence: `ManagerHint` is a named internal domain value containing only `name: string` and `version: O.Option<string>`. It is modeled as an interface, while `devEnginesHint` and `corepackHint` construct separate object literals implementing that shape.
- failure: The normalized manager-hint model has no executable schema despite being directly representable by Schema. Its two construction paths and its type definition remain independent.
- fix: Define one annotated `ManagerHint` schema, derive its type, and construct normalized hints through it. Keep the existing behavior that malformed hints are ignored and an invalid version drops only the version.

### sol-1-5

- file: scratchpad/effected/workspaces/PackageManagerName.ts:36
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-35; D5 and D11.   evidence: Both `PackageManagerName` at line 36 and `PackageManagerEvidence` at line 63 are named, reused, annotation-bearing literal domains implemented with `S.Literals`. A read-only probe confirmed their `.Enum` and `.$match` helpers are absent.
- failure: These named domains do not meet the required `LiteralKit` idiom. Consumers must keep spelling literal values and branching independently of the domain’s derived helper surface.
- fix: Replace the two `S.Literals(...)` constructors with `LiteralKit(...)`, retaining annotations, same-name type aliases and the exact literal order. The evidence order is observable and must remain unchanged.

### sol-1-6

- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:69
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18: reusable custom checks carry `identifier`, `title` and `description`; D11.   evidence: The named `specVersion` schema contains a reusable `S.makeFilter` with no metadata argument. A read-only inspection of `ConfigDependencySpec.fields.version.ast.checks` returned a filter with `annotations: undefined`.
- failure: The constraint rejecting build metadata has no identifying or descriptive check metadata. Annotating the enclosing class and field does not annotate the filter itself.
- fix: Supply the filter’s metadata argument with a namespaced `$I` identifier, title and description. Keep its predicate and existing failure text unchanged.

### sol-1-7

- file: scratchpad/effected/workspaces/LayerPolicy.ts:98
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18; D11.   evidence: The reusable glob-compilation filter supplies only `{ title: "compilable glob patterns" }`. A read-only inspection of `LayerPolicy.fields.unconstrained.ast.checks` confirmed that `identifier` and `description` are absent.
- failure: The policy’s custom glob constraint does not satisfy the required check metadata contract. Its enclosing field description cannot supply the missing filter identity and description.
- fix: Add a namespaced `$I` identifier and description to the existing filter metadata, preserving its title and validation behavior.

### sol-1-8

- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:131
- class: schema   severity: required
- standard: D5 requires identity annotations on every exported schema; `standards/effect-first-development.md`, schema annotation requirements; D11.   evidence: The public static codec `ConfigDependencySpec.FromString` is constructed without an identity annotation. A read-only probe of `ConfigDependencySpec.FromString.ast.annotations` returned `undefined`; the annotation on `ConfigDependencySpec` does not transfer to this separate transformation schema.
- failure: The exported string codec lacks its own schema identity, title and description, leaving the annotation migration incomplete for this public runtime schema.
- fix: Annotate the completed codec through `$I.annoteSchema(...)` with a distinct codec identifier and meaningful description, preserving its declared `S.Codec<ConfigDependencySpec, string>` contract and transformation behavior.

### sol-1-9

- file: scratchpad/effected/workspaces/ChangeDetector.ts:29
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Carrier policy; operator deferral of S2.   evidence: The reviewed files retain legacy `@example` and `@remarks` carriers and omit canonical `@category` and `@since 0.0.0` tags. Examples include `ChangeDetector.ts:29`, `ConfigDependencySpec.ts:79`, `DependencyGraph.ts:24`, `DuplicateCheck.ts:51` and `PackageManagerName.ts:49`. Several exported runtime declarations also lack their required Example.
- failure: These public APIs do not yet satisfy the repository’s JSDoc grammar and inventory requirements. This is deferred documentation work, so it is backlog despite D11’s general JSDoc classification.
- fix: During S2, convert the existing bodies to titled `**Example** (Title)` and `**Details**` sections, add canonical category/since tags, and supply missing runtime examples without dropping upstream prose.

### sol-1-10

- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:103
- class: docs   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Example quality; operator deferral of S2.   evidence: The example passes `"0.11.1+sha512-m35m…=="` and describes a successful result. A read-only probe of `ConfigDependencySpec.parse` with that exact string returned `Failure(InvalidConfigDependencySpecError)` with `reason: "integrity"`.
- failure: Executing the documented example fails before reaching its advertised `[bare, hasIntegrity]` result because the ellipsis is not valid SRI base64.
- fix: Replace the abbreviated integrity with a complete valid SRI string, such as the existing test fixture value, and verify the example during S2.

### sol-1-11

- file: scratchpad/test/workspaces/ConfigDependencySpec.test.ts:116
- class: test   severity: backlog
- standard: D10 requires generated schema/codec round trips and parser/formatter properties using `Arbitrary.schema` and `fcRuns`; operator deferral of S3.   evidence: The codec round-trip test enumerates four fixed strings. Searching `scratchpad/test/workspaces/**` found no `Arbitrary`, `fast-check`, `fcRuns` or property registrations implementing the required floor.
- failure: The reviewed schemas and codec lack the required generated round-trip and fidelity proof. The existing example tests exercise selected inputs but do not establish D10’s property floor.
- fix: During S3, retain the oracle examples and add canonical property tests for the reviewed exported schemas and `ConfigDependencySpec.FromString`, using valid constrained arbitraries and `fcRuns`.

### sol-1-12

- file: scratchpad/test/workspaces/ConfigDependencySpec.test.ts:28
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; operator deferral of S3.   evidence: Result assertions use `assert.isTrue(Result.isSuccess(parsed))` followed by manual narrowing. Option assertions compare containers or test `O.isNone`, including `ConfigDependencySpec.test.ts:31` and `:51`, `PackageManagerDetector.test.ts:34` and `:54`, and `LockfileReader.test.ts:79` and `:85`. These files do not use the corresponding public assertion helpers.
- failure: The tests retain noncanonical Option/Result assertions and redundant narrowing rather than the required helpers that assert the expected variant and payload.
- fix: During S3, replace these checks with `assertSuccess`, `assertFailure`, `assertSome` and `assertNone` from `@effect/vitest/utils`, retaining all existing payload assertions and test meaning.

REQUIRED: 8
BACKLOG: 4