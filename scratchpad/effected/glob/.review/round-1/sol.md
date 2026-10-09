### sol-1-1
- file: scratchpad/effected/glob/GlobPattern.ts:39
- class: bug   severity: required
- standard: D9; section 14; `GlobPattern.compileResult` totality contract   evidence: A read-only Bun probe against the pinned oracle used `source = "{1.." + "9".repeat(310) + "}"`. Oracle `compileResult` returned `Failure`, reason `ExpansionBudgetExceeded`, actual `Infinity`; the port threw `Schema validation failed`. `Effect.runSyncExit` confirmed that both `GlobPattern.compile(source)` and `GlobSet.compile([source])` changed from a `Fail` containing `GlobPatternError` to a `Die` containing the schema validation exception.
- failure: Valid string input can escape the documented typed failure channel. Brace-expansion arithmetic can overflow to `Infinity`, but the new `actual: S.Finite` rejects that guard measurement while constructing the error.
- fix: Restore a schema for `actual` that accepts the oracle’s overflow measurement. The `schemaNumber` rule explicitly permits a documented line exception when non-finite values are intentional; use that exception for this field rather than narrowing its behavior. Retain finite validation for `limit` and add the reproducer for both public compile boundaries.

### sol-1-2
- file: scratchpad/effected/glob/internal/limits.ts:40
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-1; D5; `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”   evidence: `GuardExceeded` extends `Data.TaggedError`, although it is exported and thrown across engine/facade module boundaries. A read-only runtime probe returned `false` for `"ast" in GuardExceeded`, confirming that this cross-module error has no schema contract despite the green gates.
- failure: The guard error’s reason and numeric payload exist only as TypeScript declarations. This leaves a cross-module failure outside the required `S.TaggedError` modeling and identity conventions.
- fix: Define `GuardExceeded` with `S.TaggedError` and `$I` identity/annotations. Preserve its positional constructor, message, `name`, and guard measurements, including the intentional non-finite measurement identified in sol-1-1.

### sol-1-3
- file: scratchpad/effected/glob/internal/ast.ts:82
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` laws 17 and 19; `standards/effect-first-development.md` EF-12b   evidence: The same named domain is declared three times: the `ExtglobType` literal union, the `HashSet` literal list at line 83, and the handwritten narrowing predicate at line 84. The predicate then controls AST adoption, usurpation, and regular-expression generation.
- failure: A named, repeatedly matched runtime domain has no owning schema. Its type and membership predicate can drift independently, contrary to the requirement to derive domain guards from schemas.
- fix: Introduce one annotated `LiteralKit` for `ExtglobType`, derive its same-name type, and derive membership with the kit’s guard or `S.is`. Remove the parallel literal set and handwritten membership predicate.

### sol-1-4
- file: scratchpad/effected/glob/internal/ast.ts:42
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12; D5; the identity-stage requirement for schema and field annotations   evidence: `ASTError` receives an identity constructor argument but no `$I.annote(...)` metadata, and its `message` field has no field annotation. The same incomplete declaration occurs in `InvalidCap` (`internal/limits.ts:12`), `InvalidPattern` (`internal/assertValidPattern.ts:18`), `BraceExpressionError` (`internal/braceExpressions.ts:17`), and `MinimatchError` (`internal/minimatch.ts:48`). A runtime probe of `InvalidCap.ast.annotations` showed only `identifier` and sentinel metadata, with no title or description.
- failure: The newly introduced error schemas lack the meaningful schema metadata required by the completed identity stage. Their identifiers alone do not describe the error contracts to schema consumers.
- fix: Add meaningful `$I.annote(...)` metadata to each new error schema and annotate its payload fields. Complete the corresponding unannotated public fields `GlobPattern.source` and `GlobSet.patterns` while applying the same field-annotation requirement.

### sol-1-5
- file: scratchpad/effected/glob/GlobPattern.ts:180
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18; `standards/effect-first-development.md` EF-12c   evidence: The reusable `GlobPattern` compilability check supplies only `{ title: "compilable glob pattern" }`. The corresponding `GlobSet` check at `GlobSet.ts:85` also supplies only a title. Both checks run through construction and decoding of exported, reusable classes; the enclosing class annotations do not annotate these check nodes.
- failure: The reusable validation contracts have no check identifier or description, despite the explicit metadata requirement. The green gates have left both incomplete filter declarations in place.
- fix: Supply check metadata through `$I.annote(...)` with distinct identifiers, meaningful titles, and descriptions. Preserve the existing guard-message behavior.

### sol-1-6
- file: scratchpad/effected/glob/internal/braceExpansion.ts:43
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-21, “Runtime execution stays at the boundary”   evidence: Lines 43–47 execute five `Effect.runSync(Random.next)` calls during library-module initialization. These calls are reached by importing the public glob entry point, before any caller-owned Effect runs.
- failure: Importing a pure matching library starts Effect runtimes internally. Random initialization is detached from caller composition and violates the explicit restriction of `Effect.run*` execution to application entry points and tests.
- fix: Generate the salts through the synchronous Random service interface without running an Effect—for example, obtain the default service once with `Random.Random.defaultValue()` and use its `nextDoubleUnsafe()` method. This preserves the current default random source and synchronous API while removing the five internal runtime executions.

### sol-1-7
- file: scratchpad/effected/glob/README.md:192
- class: docs   severity: backlog
- standard: D9; section 14 deviation protocol; operator instruction placing documentation findings in backlog   evidence: Port notes say `Deviations: None`, and the glob ledger row has `deviations: []`. However, the oracle’s `TypeError` behavior became `InvalidCap` and `InvalidPattern`. Tests were explicitly adjusted to expect the new classes, including `braceExpansion.test.ts:229` and `engine.test.ts:105`.
- failure: The port’s recorded behavior contract omits observable, law-driven error-class changes. A future reviewer cannot distinguish these intended changes from regressions using the required deviation records.
- fix: Record the error-class changes with their `law:7` justification, affected boundaries, and adjusted upstream tests in the ledger and README Port notes.

### sol-1-8
- file: scratchpad/effected/glob/GlobPattern.ts:166
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; S2 deferral   evidence: `GlobPattern.ts` retains `@remarks` at lines 166, 213, 291, and 331 and `@example` at line 220. `GlobSet.ts` retains the same legacy carriers. The public class documentation also lacks canonical `@category`, `@since 0.0.0`, and required examples for several value exports.
- failure: The documentation does not meet the required rendering grammar or export documentation rubric.
- fix: During S2, preserve the existing prose while converting carriers to `**Details**` and titled `**Example** (Title)` sections. Add canonical categories, version tags, and compilable examples for the owning value declarations.

### sol-1-9
- file: scratchpad/effected/glob/README.md:52
- class: docs   severity: backlog
- standard: `standards/effect-laws-v1.md` law 2; operator instruction placing documentation findings in backlog   evidence: The quick-start example imports `{ Effect }` from the root `"effect"` barrel. The later examples repeat root-barrel imports for `Effect` and `Schema`.
- failure: The carried Markdown examples teach an import form explicitly forbidden by the repository’s Effect import law.
- fix: Rewrite the examples to dedicated module imports, such as `import * as Effect from "effect/Effect"` and `import * as S from "effect/Schema"`, preserving their behavior.

### sol-1-10
- file: scratchpad/test/glob/GlobPattern.test.ts:330
- class: test   severity: backlog
- standard: `.patterns/testing-patterns.md`, “Never use Effect.runSync in tests” and specialized Result assertions; `goals/effect-vitest-canon/SPEC.md` D5; S3 deferral   evidence: A regular `it` executes the Effect compilation path with `Effect.runSync`, then asserts Result tags using predicates and manual branches. `GlobSet.test.ts:310` repeats the runtime-execution pattern.
- failure: These Effect comparisons bypass the canonical Effect test runner and Result assertion helpers.
- fix: Convert the comparisons to `it.effect`, yield the Effect result, and use `@effect/vitest/utils` Result assertion helpers that retain both the expected variant and payload checks.

### sol-1-11
- file: scratchpad/test/glob/GlobPattern.test.ts:280
- class: test   severity: backlog
- standard: D10 property floor; S3 deferral   evidence: The existing generated tests check oracle matching and escape fidelity, while schema encode/decode checks are fixed examples. No generated encode/decode round-trip property covers `GlobPattern`, `GlobPattern.FromString`, `GlobPatternOptions`, `GlobPatternError`, or `GlobSet`. Property counts are also literal values, including `runs: 200` at `GlobPattern.test.ts:305` and `runs: 500` at `compliance.test.ts:298`, rather than `fcRuns(...)`.
- failure: The current property suite does not yet establish the required schema/codec round-trip floor or use the repository’s configurable run-count policy.
- fix: During S3, add schema-derived round-trip properties for each exported schema and codec, preserving the existing differential properties. Route all property run counts through `@beep/fc-runs`.

REQUIRED: 6
BACKLOG: 5