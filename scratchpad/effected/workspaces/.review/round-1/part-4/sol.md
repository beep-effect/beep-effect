### sol-1-1
- file: scratchpad/effected/workspaces/internal/sourceText.ts:385
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `SourceBoundary.importsNode` and `check` promise to identify imported modules.   evidence: A read-only probe against both the port and the pinned oracle used `import p from "\u006eode:process";`. Both returned `["\\u006eode:process"]` from `importSpecifiers` and zero offences for `["node:process", { forbidImports: ["node:*"] }]`. Executing the equivalent dynamic import resolved to the actual `node:process` module.
- failure: Module specifiers reach rule matching with their escapes unprocessed. Valid JavaScript can therefore import a forbidden built-in while the scanner reports no offence. This limitation is absent from the documented scanner limits and recorded deviations.
- fix: Preserve the raw literals and source offsets produced by `lex`, but provide cooked ECMAScript string values for module-specifier matching. Add the escaped-import regression fixture and record the verified upstream-bug deviation under section 14.

### sol-1-2
- file: scratchpad/effected/workspaces/internal/sourceText.ts:351
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the `references` contract explicitly excludes longer identifiers.   evidence: Both the port and pinned oracle reported two `process` offences for each of `const 𝒙process = 1; 𝒙process;` and `const process𝒙 = 1; process𝒙;`. A read-only JavaScript execution probe successfully declared both identifiers and returned their sum, `3`.
- failure: Identifier-boundary checks pass individual UTF-16 code units to the Unicode regular expression. Each half of an astral identifier character fails that check, so the scanner incorrectly treats the embedded `process` substring as a separate identifier. Valid source consequently fails the boundary check.
- fix: Make identifier-boundary lookups and backward identifier scans operate on complete Unicode code points while retaining UTF-16 offsets for diagnostics. Add fixtures for astral characters on both sides of a forbidden identifier and record the upstream-bug deviation.

### sol-1-3
- file: scratchpad/effected/workspaces/internal/sourceText.ts:268
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the lexer promises to distinguish comments from subsequent executable code.   evidence: For each separator `\r`, `\u2028`, and `\u2029`, a read-only probe executed `// harmless<separator>process.touch();` with a harmless injected `process` object. JavaScript executed `touch` once, whereas both the port and pinned oracle returned zero `process` offences.
- failure: A line comment stops only at LF. With another valid JavaScript line terminator, the lexer blanks the following executable statement as part of the comment, allowing real forbidden references to pass undetected.
- fix: Recognize all four ECMAScript line terminators when ending line comments. Preserve those terminators in the lexed views and update location accounting consistently, treating CRLF as one line break. Add the three regression fixtures and record the upstream-bug deviation.

### sol-1-4
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:539
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-35; `AGENTS.md` requires schema-derived guards for named or structurally validated domain constraints.   evidence: `isStringRecord` manually establishes `Record<string, string>` through `P.isObject(value) && R.values(value).every(P.isString)`, and that guard controls all four dependency fields. The existing `WorkspacePackage` model already defines those fields through its `DependencyMap` schema.
- failure: The synchronous discovery boundary maintains a second handwritten definition of a dependency map instead of deriving validation from the schema that owns the model. The committed guard remains present despite the green gates; this is a semantic schema-modeling violation, not a claimed compiler diagnostic.
- fix: Derive the guard from the existing dependency-field schema, for example `S.is(WorkspacePackage.fields.dependencies)`, and remove the handwritten predicate. Preserve the current all-or-nothing fallback for malformed dependency maps.

### sol-1-5
- file: scratchpad/effected/workspaces/internal/traverse.ts:53
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-35; `standards/effect-laws-v1.md` law 17.   evidence: The named, shared `isValidMaxDepth` constraint is implemented as `Number.isInteger(maxDepth) && maxDepth >= 1` and is consumed by both synchronous and Effect enumeration. It has no owning schema.
- failure: A reused domain constraint remains an ad-hoc boolean helper rather than a schema-derived guard. Its accepted values, annotations, and validation behavior cannot be derived from one schema definition.
- fix: Define an annotated depth schema and derive `isValidMaxDepth` with `S.is`. Preserve the upstream predicate exactly: a read-only equivalence probe showed that replacing it with `S.Int.check(S.isGreaterThanOrEqualTo(1))` would newly reject `1e100`, which upstream accepts. Use an annotated `Number.isInteger` filter where needed to retain that contract.

### sol-1-6
- file: scratchpad/effected/workspaces/internal/configDependencyShared.ts:68
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b, EF-13, and EF-33; `AGENTS.md` schema-first domain-model rule.   evidence: `ManifestVersion` is a handwritten three-case domain union. Its cases are constructed by `manifestVersion`, represented by separate `ABSENT` and `UNVERSIONED` objects, and matched throughout config-dependency resolution and fetch verification. No schema owns the cases or payload.
- failure: The resolution state model exists only as a TypeScript declaration, with case construction and discrimination maintained separately. This named, reused domain model does not satisfy the required schema-first representation.
- fix: Define an identity-annotated `S.TaggedUnion` for `absent`, `unversioned`, and `version`, and derive the existing type from it. Preserve the current structural objects, tag strings, and version acceptance behavior.

### sol-1-7
- file: scratchpad/effected/workspaces/Workspaces.ts:315
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` hard requirements and carrier policy; EFFECTED_PORT_GOAL section 10.2. S2 is deferred by the review brief.   evidence: The `Workspaces.layer` block retains `@remarks` and `@example`, lacks canonical `@category` and `@since`, and its example at line 338 references `PlatformLayer` without declaring or importing it. Similar legacy carriers remain in the other focus-file API blocks.
- failure: These blocks do not satisfy the required documentation grammar, and the shown example is not independently compilable. This is S2 backlog, not a current required finding.
- fix: Convert the carriers while preserving the upstream prose, add canonical metadata, and make the example complete by importing and supplying an actual platform layer. Retain the example and verify it during S2.

### sol-1-8
- file: scratchpad/test/workspaces/importerVersions.test.ts:128
- class: test   severity: backlog
- standard: `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; `goals/effect-vitest-canon/SPEC.md` D5 assertion-helper doctrine. S3 is deferred by the review brief.   evidence: Lines 128–129 compare Option containers with `assert.deepStrictEqual(..., O.some(...))`; line 136 asserts `O.isNone(...)` through a boolean assertion. The suite does not use the canonical Option assertion helpers.
- failure: The suite retains container-equality and tag-predicate assertions instead of the canonical helpers that assert the expected variant and payload. This is deferred test-canon backlog.
- fix: Replace these assertions with `assertSome` and `assertNone` from `@effect/vitest/utils`, preserving the existing expected versions and disagreement cases.

REQUIRED: 6
BACKLOG: 2