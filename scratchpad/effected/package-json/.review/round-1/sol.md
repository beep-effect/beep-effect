### sol-1-1

- file: scratchpad/effected/package-json/EntryPoint.ts:183
- class: bug   severity: required
- standard: D9, D11; `.patterns/module-organization.md` dual-function contract.   evidence: A read-only Bun probe with `const options: ResolveEntryPointOptions = {}; const resolve = resolveEntryPoint(options)` printed `typeof resolve === "object"`; calling `resolve({ main: "x.js" })` threw `TypeError: resolve is not a function`. Conversely, a manifest typed as `EntryPointManifest & { conditions: ReadonlyArray<string> }` with value `{ conditions: [] }` returned a function in the lab and `Success("index.js")` in the pinned oracle.
- failure: The predicate distinguishes manifests from options by their keys, but the two structural types overlap. The declared options overload can return a non-callable `Result`, and an existing one-argument manifest call can return a function instead of its upstream result. The added tests cover explicit `conditions` options and manifests with `exports` or `main`, leaving these collisions uncovered.
- fix: Preserve the original one-argument manifest dispatch and remove the ambiguous object-options overload. Provide options-based currying through a distinct entry point or explicitly distinguishable argument; retain the zero-argument curried form. Add regression cases for empty options and manifests carrying a `conditions` extension.

### sol-1-2

- file: scratchpad/effected/package-json/internal/format.ts:201
- class: bug   severity: required
- standard: D9 and section 14’s verified-upstream-bug exception; README’s unknown-key round-trip guarantee.   evidence: In both the lab and pinned oracle, decoding `{"name":"my-pkg","version":"1.0.0","__proto__":{"x":1}}` and calling `toJsonString({ sort: true, newline: false })` produced output without `__proto__`; `sort: false` preserved it. `Object.hasOwn(JSON.parse(output), "__proto__")` returned `false` and `true`, respectively. The existing `Package.test.ts:174` case verifies wire encoding, which succeeds before sorting.
- failure: Default serialization silently drops a valid unknown manifest key. Assignment into the ordinary `{}` accumulator invokes the inherited `__proto__` setter instead of creating an own data property. `sortMapEntries` at line 169 has the same problem for nested map keys. This is an inherited upstream bug verified by a failing fidelity case.
- fix: Build both sorted records with `R.fromEntries` from their ordered entries, preserving `__proto__` as data. Extend the existing regression through default `toJsonString`, include a nested map case, and record the fix as an `upstream-bug` deviation under section 14.

### sol-1-3

- file: scratchpad/effected/package-json/PackageName.ts:45
- class: schema   severity: required
- standard: D5; operator step 4; `standards/schema-first-development-prompt.md`, “Documentation and Annotation Review.”   evidence: A read-only runtime inspection found `schema.ast.annotations === undefined` for `ScopedPackageName`, `UnscopedPackageName`, `PackageName`, `SpdxLicense`, `PublishConfigField`, and `PeerDependenciesMetaField`. `DependencyMapField` and `StringMapField` carried Effect’s built-in HashMap metadata but no module identity. As a control, `BinField` carried the expected `$ScratchpadId` identifier, schemaId, IRI, and CURIE.
- failure: These exported schema values remain unidentified despite the completed identity phase. Their schema metadata lacks the required Beep identity; this is a schema-identity gap rather than deferred JSDoc conversion. The green diagnostic and four-law gates have not caught it.
- fix: Apply the owning file’s `$I.annoteSchema(...)` to those eight exported schemas without changing their validation or encoded shapes. For `PackageName`, annotate the union before attaching its classification statics.

### sol-1-4

- file: scratchpad/effected/package-json/License.ts:63
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18; `standards/schema-first-development-prompt.md`, “Precision carries invariants”; D11.   evidence: Runtime inspection of `SpdxLicense.ast.checks` and `PackageManagerRange.fields.range.ast.checks` showed reusable `Filter` values with `annotations: undefined`. The latter originates in `PackageManagerRange.ts:77`. Neither custom check supplies `identifier`, `title`, or `description`.
- failure: The reusable SPDX and semver-range checks lack the mandatory check metadata. Annotating the enclosing class or its field does not annotate the check itself.
- fix: Annotate each custom filter with a stable identity, meaningful title, and description, retaining its existing predicate and failure message.

### sol-1-5

- file: scratchpad/effected/package-json/LenientManifest.ts:46
- class: schema   severity: required
- standard: AGENTS.md schema-first domain-model law; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D11.   evidence: `LenientFieldIssue` is a handwritten public data interface at lines 46–53, while `LenientFieldIssueSchema` separately restates all three fields at lines 55–59. `PackageValidator.ts:24` likewise declares `RuleFailure` as a plain domain-data interface without a schema. These are data records, rather than service contracts or overload declarations.
- failure: The issue model has two independently maintained definitions, and validation-rule failures have no runtime model. The port therefore retains parallel or absent schema definitions for reusable domain data.
- fix: Export the existing structural issue schema as `LenientFieldIssue` and derive its same-name type. Add an annotated structural `RuleFailure` schema and derive its type. Preserve the current plain-object construction contracts and list the added runtime exports in Port notes and the ledger.

### sol-1-6

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:215
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3 explicitly forbids direct `JSON.parse` / `JSON.stringify`; `standards/schema-first-development-prompt.md`, Pattern 6; D11.   evidence: Direct production calls remain at `PackageJsonFormat.ts:215`, `LenientManifest.ts:290`, `internal/format.ts:322`, `Person.ts:67`, `Repository.ts:119`, and `EntryPoint.ts:60`. The Effect reference provides `S.fromJsonString` with a `space` option for serialization. These surviving calls demonstrate that the green gates do not fully enforce EF-3.
- failure: Parsing, rendering, and wire-faithfulness comparisons still bypass the required schema JSON codecs. The synchronous formatter and lenient parser also retain separate native parsing paths alongside the schema-based paths introduced elsewhere in the port.
- fix: Replace these calls with explicitly synchronous Result-based schema JSON codecs where the public API is synchronous, using `space` to preserve formatting. Map failures to the existing boundary errors. If preserving the native `SyntaxError` cause or another observable failure detail is impossible with the required codec, record that law-forced deviation under section 14.

### sol-1-7

- file: scratchpad/effected/package-json/Repository.ts:169
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; D4; reviewer instruction deferring S2.   evidence: This public class uses `@remarks` and `@example`, and its example calls synchronous schema APIs. Legacy carriers recur across the module; source declaration documentation lacks canonical `@category` and `@since` tags, and many value exports have no example.
- failure: The documentation does not satisfy the required section grammar or export metadata and remains unfinished for S2.
- fix: Convert the existing bodies without dropping prose to `**Details**` and titled `**Example** (Title)` sections; add canonical categories, `@since 0.0.0`, and useful examples for undocumented value exports. Validate the examples during S2.

### sol-1-8

- file: scratchpad/effected/package-json/README.md:3
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3; D4; reviewer instruction deferring documentation work.   evidence: The README retains upstream npm/Node/TypeScript badges and the pre-1.0 stability block. Its examples still import `@effected/package-json` and the root `effect` barrel, including lines 73–74. Port notes’ attribution also contains source-search excerpts at lines 286–304 rather than vendored-engine notices.
- failure: The lab README continues to teach the upstream package’s installation and import surface, and the attribution section contains unrelated source snippets.
- fix: Apply the section 10.3 adaptation: remove the specified badges, installation/stability boilerplate, rewrite examples to lab imports and dedicated Effect paths, and retain actual provenance and license notices in Attribution.

### sol-1-9

- file: scratchpad/test/package-json/PackageName.test.ts:69
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL.md sections 11.4 and 11.5; reviewer instruction deferring S3.   evidence: The only `it.effect.prop` cases in the module are the two package-name validation properties at lines 69 and 75. Neither tests encode/decode round trips. No module test uses `Arbitrary.schema` or `fcRuns`, and the parser/formatter suites contain no fidelity or idempotence properties.
- failure: The retained tests do not meet the schema/codec round-trip and parser/formatter property floor. Example-based upstream tests leave cases such as the default-rendering key loss in sol-1-2 uncovered.
- fix: During S3, add generated round-trip properties for every exported schema/codec and fidelity/idempotence properties for parsers and formatters, using `Arbitrary.schema` and `fcRuns`. Retain the upstream example suites.

### sol-1-10

- file: scratchpad/test/package-json/Resolve.test.ts:31
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; EFFECTED_PORT_GOAL.md section 11.2; reviewer instruction deferring S3.   evidence: This `it.effect` case compares `HashMap.get(...)` directly to `O.some(...)` with `assert.deepStrictEqual`. The same pattern appears in the integration suite at `integration/PackageJsonFile.int.test.ts:51` and other module tests.
- failure: Option assertions inside Effect tests have not migrated to the canonical assertion helpers.
- fix: Replace these comparisons with `assertSome` / `assertNone` from `@effect/vitest/utils` during S3, preserving their expected values.

REQUIRED: 6
BACKLOG: 4