### sol-1-1
- file: scratchpad/effected/toml/TomlEdit.ts:48
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and §14   evidence: A read-only `bun --no-cache -e` probe compared the port with the pinned oracle. `TomlFormat.formatToString("a=1\nb=2\n", TomlRange.make({ offset: 0, length: Infinity }))` returns `"a = 1\nb = 2\n"` upstream; the port throws `Error: Schema validation failed`. The port changed `Schema.Number` to `S.Finite`, and both the README and ledger record no deviations.
- failure: An upstream-supported range covering the remainder of the document now fails before formatting. Green parser tests do not establish parity for public schema construction.
- fix: Preserve the upstream numeric domain for `TomlRange.length` using a schema that accepts non-finite numbers without violating `schemaNumber`, following the approach already used for `TomlFloat`. Audit the other public `Number` → `Finite` replacements for the same narrowing.

### sol-1-2
- file: scratchpad/effected/toml/TomlEdit.ts:79
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; AGENTS.md Code Laws   evidence: `TomlEdit.applyAll` calls `[...edits].sort(...)`; `TomlVisitor.ts:156` calls `positioned.sort(...)`. These native sorts remain on the reviewed, gate-green commit. Neither file has a corresponding exception in `standards/effect-laws.allowlist.jsonc`.
- failure: Both production paths retain the explicitly forbidden native array sorting operation. This is a concrete omission from the green enforcement result, independent of sorting correctness or performance.
- fix: Use `A.sort` with explicit numeric projection orders: descending edit offsets and ascending event offsets. Preserve stable ordering for equal offsets.

### sol-1-3
- file: scratchpad/effected/toml/TomlDiagnostic.ts:25
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5; standards/effect-laws-v1.md law 19; standards/effect-first-development.md EF-12b   evidence: The four exported error-code domains use named, annotated `S.Literals` schemas. The same construction remains for `TomlKeyKind` at `TomlNode.ts:42`, `TomlStringStyle` at `TomlNode.ts:72`, and the named internal `NonFiniteSpelling` at `TomlNode.ts:18`.
- failure: Named literal domains retain `S.Literals` where the binding port contract requires `LiteralKit`. They therefore lack the required literal-kit surface, despite having already passed the green gates.
- fix: Replace these named `S.Literals` constructions with `LiteralKit`, retaining their existing literals, annotations, exported names, and derived types. Leave anonymous inline newline unions as `S.Literals`.

### sol-1-4
- file: scratchpad/effected/toml/TomlDateTime.ts:36
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18; standards/effect-first-development.md EF-12c   evidence: `isRealCalendarDate` is a reusable `S.makeFilter` shared by `TomlLocalDate`, `TomlLocalDateTime`, and `TomlOffsetDateTime`. Its metadata is only `{ title: "a real calendar date" }`; it has no `identifier` or `description`.
- failure: The shared calendar constraint lacks the mandatory identity and explanatory metadata for a reusable check. The containing classes’ annotations do not annotate this check.
- fix: Add a composer-derived `identifier` and a meaningful `description` to the existing filter metadata, preserving its predicate and current failure text.

### sol-1-5
- file: scratchpad/effected/toml/TomlNode.ts:183
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and the operator’s step 4; standards/effect-first-development.md EF-12   evidence: Exported `TomlValueNode` is an unannotated `S.suspend` schema. The new `IeeeNumber` declaration at `TomlNode.ts:29` and invariant-error schemas in `TomlEdit.ts:17`, `TomlFormat.ts:48`, `TomlVisitor.ts:39`, `internal/limits.ts:10`, `internal/semantic.ts:32`, and `internal/stringifyValue.ts:25` also lack canonical schema annotations. Shared date/time fields at `TomlDateTime.ts:44–55` lack the field annotations required by step 4.
- failure: Identity and schema metadata conversion is incomplete on the commit admitted to review. These are schema-contract omissions from the completed identity stage, rather than deferred JSDoc conversion.
- fix: Annotate the existing schema declarations with the file’s `$I.annote(...)` or `$I.annoteSchema(...)`, and annotate the shared date/time fields. Keep validation and construction behavior unchanged.

### sol-1-6
- file: scratchpad/effected/toml/TomlVisitor.ts:56
- class: schema   severity: required
- standard: AGENTS.md schema-first domain-model law; standards/effect-first-development.md EF-13 and EF-32; EFFECTED_PORT_GOAL.md D5   evidence: The public four-case event model is authored as a `Data.TaggedEnum` type literal, with `Data.taggedEnum<TomlVisitorEvent>()` as its runtime value. No schema defines these event payloads.
- failure: The event model has constructors and matchers but no schema source of truth from which to derive validation, codecs, or arbitraries. This pure-data tagged union remains outside the required schema-first conversion.
- fix: Define an annotated schema tagged union for the existing four event shapes and derive the event type from it. Preserve the current constructors, `$is`, and `$match` API through a compatibility façade.

### sol-1-7
- file: scratchpad/effected/toml/internal/diagnostics.ts:70
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 and Allowlist Contract; EFFECTED_PORT_GOAL.md D5   evidence: `RawTomlError` extends `Data.TaggedError`; so do `GuardExceeded` at `internal/limits.ts:25` and `ModifyFailure` at `TomlFormat.ts:532`. None has a registered low-level error exception in `standards/effect-laws.allowlist.jsonc`. Their payloads remain type literals or interfaces rather than schema fields.
- failure: These throw carriers retain the Data error construction that the binding law requires to be schema-backed or explicitly excepted. The green gates have not completed this error-model conversion.
- fix: Convert the carriers to annotated `S.TaggedError` schemas, defining the raw diagnostic payload as a schema as well. Retain their existing constructor arguments, tags, messages, names, and façade catch behavior.

### sol-1-8
- file: scratchpad/effected/toml/internal/semantic.ts:102
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-7; standards/effect-laws-v1.md law 11; EFFECTED_PORT_GOAL.md D11   evidence: The upstream provenance `switch` became an `if`/`else if` ladder over `existing.kind`. `internal/scanner.ts:164` similarly replaces escape-code dispatch with a conditional ladder. The green no-switch result therefore does not establish the required Match conversion.
- failure: Finite-case dispatch remains handwritten conditional branching, and the provenance ladder has no exhaustive-match obligation when the domain changes.
- fix: Express provenance dispatch through an exhaustive `Match` over the existing variants, and escape dispatch through `Match` with the existing undefined fallback. Preserve current returns, mutations, and error order.

### sol-1-9
- file: scratchpad/effected/toml/internal/parser.ts:47
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1   evidence: The production parser imports `effect/Schema` as `Schema` and uses `Schema.is` at lines 278–281. Law 1 explicitly requires the `S` alias. This occurrence remains on the gate-green commit.
- failure: The import conversion leaves a concrete production-source alias violation.
- fix: Rename the namespace import to `S` and update the four guard references.

### sol-1-10
- file: scratchpad/effected/toml/Toml.ts:173
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md Hard requirements and Carrier policy; EFFECTED_PORT_GOAL.md D4; operator deferral of S2   evidence: Public documentation still uses `@remarks` and `@example`, including `Toml.ts:173–181`, `TomlDocument.ts:58–70`, `TomlFormat.ts:852–866`, and `TomlVisitor.ts:192`. No source file in the module contains `@category` or `@since`; numerous exported schemas and classes have no Example.
- failure: The retained documentation has not reached the required section grammar, category/since metadata, or value-export example coverage.
- fix: During S2, convert the retained bodies into titled `**Example** (Title)` and `**Details**`/`**Gotchas**` sections, add canonical categories and `@since 0.0.0`, and supply meaningful examples for uncovered value exports without dropping upstream prose.

### sol-1-11
- file: scratchpad/effected/toml/README.md:70
- class: docs   severity: backlog
- standard: AGENTS.md dedicated Effect import rule; standards/effect-laws-v1.md law 2; operator deferral of documentation work   evidence: The adapted README still contains `import { Effect } from "effect"` at line 70 and root-barrel imports in its other TypeScript examples. The source examples were rewritten to dedicated imports, but the README examples were not.
- failure: The module’s public documentation teaches imports explicitly forbidden by the repository’s Markdown-example law.
- fix: Rewrite the README’s Effect imports to dedicated module paths while retaining the examples and their observable results.

### sol-1-12
- file: scratchpad/test/toml/oracle.property.test.ts:300
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and S3; operator deferral of coverage, test canon, and property-floor work   evidence: The only property registrations in the TOML tests are the two differential properties in this file. They use `{ runs: 250, seed: 20260710 }` directly, with no `fcRuns` use anywhere in the TOML tests. Their generators use test-local primitive/container schemas rather than the exported production schemas; no formatter-idempotence property is registered.
- failure: The retained oracle properties do not yet satisfy the module-wide production-schema round-trip, formatter-idempotence, and configured-run-count requirements.
- fix: During S3, retain the differential suites, route run counts through `fcRuns`, and add schema-derived round-trip properties plus parser/formatter fidelity and idempotence properties.

REQUIRED: 9
BACKLOG: 3

