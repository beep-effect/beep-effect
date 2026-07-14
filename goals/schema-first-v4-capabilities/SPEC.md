# Specification

## Objective

Make advanced Effect v4 Schema capabilities a first-class, enforced part of
schema-first development in this repo.

## Laws To Levers

| Capability | Repo law supported | Anti-pattern replaced | Example artifact | Enforcement route | Remediation phase |
| --- | --- | --- | --- | --- | --- |
| Schema defaults | Defaults belong at the schema boundary | fallback objects and parameter defaults | `scratchpad/index.ts` | `SFV4-defaults` advisory first | P4 defaults |
| Schema arbitraries | Schema is the source of test data truth | happy-path fixtures for domain-wide laws | `scratchpad/test/schema-arbitrary-fastcheck.test.ts` | `SFV4-arbitrary-tests` advisory first | P4 tests |
| Schema-derived static APIs | Schema values own their derived behavior | ad-hoc discriminant branching, literal constants, duplicate guards | `scratchpad/test/schema-static-apis.test.ts` | `SFV4-static-api` advisory inventory | P4 statics |
| Schema equivalence | Compare schema-modeled values by schema semantics | hand-written equality helpers | packet examples | `SFV4-equivalence` inventory-backed | P4 comparisons |
| Precise numbers | Business numbers should be finite/ranged where required | broad `S.Number` in timeout/count/limit fields | property scratch | `SFV4-numeric-domain` advisory first | P4 numerics |
| Schema precision | Domain schemas say what values are truly allowed | broad `S.String`, `S.Number`, arrays without domain bounds | packet examples | `SFV4-precision-audit` advisory inventory | P4 precision |
| Boundary codecs | Decode/encode at boundaries with Schema | ad-hoc JSON/form/query parsing | packet examples | `SFV4-boundary-codec` docs first | P1/P3 |
| Representation spike | Generated tooling should prove parity before replacement | direct generated driver rewrites | Box spike plan | no lint rule until spike proves value | P4 spike |

## Effect V4 Source Preflight

Before adding or enforcing nontrivial Schema patterns, inspect the local Effect
v4 docs/source rather than relying on memory:

- start with `.repos/effect-v4/packages/effect/SCHEMA.md`;
- confirm exported behavior in `.repos/effect-v4/packages/effect/src/Schema.ts`;
- use the adjacent source module for specialized work such as `SchemaAST`,
  `SchemaGetter`, `SchemaIssue`, `SchemaRepresentation`, or
  `SchemaTransformation`;
- cite the exact docs/source surface in packet updates, enforcement rule notes,
  or remediation PRs.

This preflight is intentionally local. The repo vendors the Effect v4 source so
agents can pick the most precise schema API before writing fallback plumbing.

## Required Capabilities

### Schema Defaults

Prefer schema-level defaults over fallback objects in function bodies or
parameter defaults.

- Constructor-time app defaults: `S.withConstructorDefault`.
- Decode-time wire defaults: `S.withDecodingDefault`,
  `S.withDecodingDefaultType`, `S.withDecodingDefaultKey`,
  `S.withDecodingDefaultTypeKey`.
- Shared helper: keep using or extend `SchemaUtils.withKeyDefaults` when the
  same default is valid as both the decoded `Type` and encoded `Encoded` value.
  For transformed schemas where those values differ, use
  `S.withDecodingDefaultType` or `S.withDecodingDefaultTypeKey`.

Reference: `scratchpad/index.ts`.

### Schema Arbitraries

Use `S.toArbitrary(schema)` for property-based unit tests where the behavior
should hold across the schema domain.

- Prefer schema-derived arbitraries over static fixtures for domain laws,
  codecs, normalization, generated API shapes, and edge-sensitive functions.
- Use schema annotations for custom domains:

```ts
const fake = <A>(
  gen: (fakerModule: typeof faker, context: S.Annotations.ToArbitrary.Context) => A
): S.Annotations.ToArbitrary.Declaration<A, readonly []> =>
  () => (fc, context) =>
    fc.nat().map((seed) => {
      faker.seed(seed);
      return gen(faker, context);
    });

const TimeoutMs = S.Int.check(S.isBetween({ minimum: 0, maximum: 60_000 })).annotate({
  toArbitrary: fake((faker) => faker.number.int({ min: 0, max: 60_000 })),
});
```

Static fixtures are still correct for exact golden payloads, regression
reproductions, snapshots, migrations, documentation examples, and external
compatibility contracts. Schema-derived properties are complementary coverage
for invariants that should hold across the schema domain.

Reference: `scratchpad/test/schema-arbitrary-fastcheck.test.ts`.

### Schema-Derived Static APIs

Prefer static helper surfaces already attached to schema values over parallel
constants, guards, branch helpers, and duplicated constructors.

Effect v4 tagged unions expose:

- `cases` for case constructors and case schemas;
- `guards` for discriminator-aware type guards;
- `isAnyOf` for grouped case checks;
- `match` for exhaustive branching on decoded union values.

Repo-local literal kits expose:

- `LiteralKit.Options`, `.Enum`, `.is`, `.pickOptions`, `.omitOptions`,
  `.$match`, `.thunk`, and `.toTaggedUnion`;
- `MappedLiteralKit.From`, `.To`, `.Pairs`, and directional literal helpers;
- `withLiteralKitStatics` when annotation or transformation rebuilds need those
  helpers reattached.

Class-local statics remain useful when they reduce repeated plumbing:

```ts
class MySchema extends S.Class<MySchema>($I`MySchema`)(
  { param1: S.String },
  $I.annote("MySchema", { description: "Example schema." })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(this);
  static readonly encodeUnknownEffect = S.encodeUnknownEffect(this);
  static readonly arbitrary = S.toArbitrary(this);
  static readonly equivalence = S.toEquivalence(this);
}
```

Reference: `scratchpad/test/schema-static-apis.test.ts`.

### Schema Equivalence

Use `S.toEquivalence(schema)` or repo wrappers for schema-modeled comparisons,
especially on `S.Class`, `S.ErrorClass`, `S.TaggedClass`, and
`S.TaggedErrorClass` models.

### Schema Precision

Treat broad primitives as a modeling smell in exported domain, boundary,
configuration, and persistence schemas.

- Prefer `S.NonEmptyString`, `S.String.check(...)`, brands, patterns, and
  length/range checks when a string domain is not literally any string.
- Prefer `S.Finite`, `S.Int`, `S.FiniteFromString`, and range checks when a
  number cannot legally be `NaN`, infinite, fractional, negative, or unbounded.
- Prefer non-empty arrays, bounded arrays, sets, or literal domains when the
  collection shape has business meaning.
- Keep broad primitives only when the domain truly accepts the whole primitive
  space, and record that reason when enforcement asks.

### Schema And Key Annotations

Use schema annotations for schema-level derivations such as `toArbitrary`,
identifier, title, description, documentation, formatter, and equivalence
metadata. Use key annotations when the schema appears as an object field or
tuple element and the metadata belongs to that position.

Examples:

```ts
const UserName = S.NonEmptyString.annotate({
  description: "Reusable user name value."
});

const User = S.Struct({
  name: UserName.annotateKey({
    description: "Display name for this specific payload field.",
    messageMissingKey: () => "name is required"
  })
});
```

### Boundary Codecs And Transformations

Document and gradually prefer schema-native codecs and transformations:

- `S.fromFormData`, `S.fromURLSearchParams`, `S.toCodecStringTree`;
- `S.fromJsonString`, `S.UnknownFromJsonString`;
- `S.toDifferJsonPatch`, `S.toIso`, `S.flip`, `S.toType`, `S.toEncoded`;
- `S.decodeTo` with `SchemaTransformation.transform` / `transformOrFail`;
- `SchemaGetter` for optional/default/omit/forbidden/property transforms.

### Representation And Codegen Spike — dropped 2026-07-14

Portfolio closeout dropped this spike. The constraints below are retained as
the historical safety record; no generated Box files were replaced.

Do not rewrite generated drivers immediately. First spike
`SchemaRepresentation` on a small generated API subset and compare:

- representation document quality;
- generated code stability;
- primitive/documentation and key annotation preservation, subject to upstream
  filtering;
- public API and wire shape parity.

`SchemaRepresentation` is an intermediate data representation, not a lossless
copy of every schema feature. Transformations do not round-trip as original
code, only supported checks are represented, annotations are filtered, and
declarations may need revivers. The Box generator currently starts from
`box-node-sdk` TypeScript declarations, so any replacement needs a validated
source conversion step before emitter parity is even on the table.

Candidate spike: compare a tiny Box subset such as `AccessToken` plus one
inherited model like `File`. The spike is side-by-side only and must not replace
generated files. Exit criteria: golden diff of generated output, public type
parity, optional/nullability behavior, annotation preservation, and runtime
decode parity.

### Diagnostics

Prefer standardized schema issue formatting at boundaries:

- `SchemaIssue.makeFormatterStandardSchemaV1`;
- format `SchemaError.issue`, not the outer error object;
- return typed diagnostics arrays with `path` and `message`;
- use `S.Redacted`, `S.RedactedFromValue`, or `SchemaIssue.redact` before
  formatting sensitive values.

## Enforcement

Add checks through `beep lint schema-first` first. Root quality already invokes
that command, and Yeet already turns failing quality steps into
`.beep/yeet/quality-issue-index.json` plus issue packets.

Current P2 behavior has one completed enforcement slice:

- `beep lint schema-first` emits machine-readable `[schema-first:issue]` JSON
  lines for current schema-first failures;
- `QualityIssueIndex.ts` parses those lines into structured Yeet issues with
  category `schema-first-policy`, rule id, file, line, remediation, and
  package attribution;
- focused tests cover both the lint emission and Yeet parser shape.
- the current Yeet closeout flow is read-first: packet closure should use
  `yeet verify`, `yeet verify --tier review-fix`, exact proof-reuse publish
  paths only when accepted, opt-in `publish --start-pr-early --monitor` only
  when remote check/reviewer overlap is desired, and `yeet closeout` on the PR
  branch before claiming hosted review readiness. Yeet failure packets also
  carry known sub-lane hints, hardware profile guidance, quality-lock behavior,
  and richer closeout artifacts for review-bot handoff.
- `SFV4-numeric-domain` is implemented as an AST advisory inventory rule with
  focused tests and currently reports zero live repo advisories.
- `SFV4-static-api`, `SFV4-boundary-codec`, `SFV4-defaults`,
  `SFV4-equivalence`, `SFV4-precision-audit`, and `SFV4-arbitrary-tests` each
  have first AST advisory slices with focused tests. Live inventory currently
  tracks zero boundary-codec `JSON.parse(...)` advisories after the Runpod
  generator pilot, zero exported manual
  `equals` equivalence advisories after the LocalDate/Timestamp Wave 5
  remediation, zero active broad email-field precision advisories after the
  HubSpot request-email, shared `EmailString`, and precision-exception review
  pilots, and 34 schema-heavy static-only test advisories after the
  `SFV4-arbitrary-tests` matcher was hardened from the async-only codec list to
  the full Effect v4 sync/async codec family. The earlier Sha256, Markdown,
  secure-header option, CSV, repo-configs route-predicate, LocalDate codec,
  Organization/identity/EntityKernel/shared-UI/Markdown-AST/file-processing/NLP
  value-schema, PatternCore, semantic-web DTO, JSON-LD DTO, form-builder,
  tooling agent-effectiveness/AI-metrics/files command, and Libpff/Tika/Venice
  AI/ACP/architecture-lab pilots cleared the async-only slice; the hardened rule
  re-surfaced the synchronous-codec backlog now tracked as advisory candidates
  for Wave 3.

The advisory rule cards below have first P2 slices. Future work should harden
or expand them only after reviewing false positives and remediation pilots.

Initial rule cards:

### SFV4-defaults

- Scope: functions and services that accept schema-modeled option objects.
- Matcher: fallback object literals or parameter defaults adjacent to
  `S.Class` / schema decode helpers.
- Severity: advisory first, hard-fail only after inventory review.
- Migration order: options/config/request schemas first, then broader optional
  field cleanup once tests and precision checks have hardened source schemas.
- Current P2 enforcement slice: non-empty object-literal defaults on
  option-like parameters in schema-modeled files.
- Rejected: `params = { timeoutMs: 5000 }`.
- Accepted: `timeoutMs: TimeoutMs.pipe(S.withConstructorDefault(...))`.
- Escape: rule-specific inventory entry with rule id, file, symbol, line, and
  reason.
- Yeet proof: failing fixture produces file, rule id, remediation, and category
  `schema-first-policy`.

### SFV4-numeric-domain

- Scope: exported schemas and schema class fields whose names contain
  `timeout`, `count`, `size`, `rate`, `limit`, `ms`, or `seconds`.
- Matcher: broad `S.Number` / `S.NumberFromString` without `S.Finite`, `S.Int`,
  or range checks.
- Severity: advisory first.
- Rejected: `timeoutMs: S.Number`.
- Accepted: `timeoutMs: S.Int.check(S.isBetween({ minimum: 0, maximum: 60_000 }))`.
- Escape: inventory entry for mathematical domains where `NaN` or infinity is
  intentional.

### SFV4-precision-audit

- Scope: exported/domain/boundary/config/persistence schemas.
- Matcher: broad `S.String`, `S.Number`, `S.Array`, and unbounded collections
  where naming or boundary position implies narrower domain semantics.
- Severity: advisory inventory only until pilot packages prove low noise.
- Current P2 enforcement slice: schema fields named exactly `email` whose
  initializer is broad `S.String`, `S.String.pipe(...)`, or
  `S.optionalKey(S.String...)`, excluding generated files and fields already
  using `Email`, `ContactEmail`, `S.NonEmptyString`, or checks.
- Rejected: `userName: S.String` when empty or whitespace-only names are invalid.
- Accepted: named precise schema such as `UserName = S.NonEmptyString.check(...)`.
- Escape: inventory entry explaining why the full primitive domain is allowed.

### SFV4-static-api

- Scope: modules with `S.TaggedUnion`, `S.toTaggedUnion`, `LiteralKit`,
  `MappedLiteralKit`, `S.Class`, or repeated schema-derived helper constants.
- Matcher: manual discriminator branching, hard-coded literal option arrays,
  duplicate guard maps, duplicate constructors, or duplicate decode/encode /
  arbitrary/equivalence helpers when schema static APIs are available.
- Severity: advisory inventory first.
- Current P2 enforcement slice: files with `S.TaggedUnion`, `S.toTaggedUnion`,
  `LiteralKit`, or `MappedLiteralKit` that still use `switch` on likely
  discriminators such as `_tag`, `kind`, `status`, `type`, `mode`, `profile`,
  or `family`.
- Rejected: switching on a schema tagged union discriminator in the same module
  instead of using `.match`.
- Accepted: `Event.match(value, cases)`, `Event.cases.created.make(...)`,
  `Status.Enum.ready`, `Status.is.ready(value)`, and class-local statics when
  they remove repeated plumbing.
- Escape: inventory entry when manual branching intentionally differs from
  schema semantics or a class static would create an import cycle.

### SFV4-equivalence

- Scope: helpers comparing schema-modeled values.
- Matcher: equality helpers near schema classes or repeated field-by-field
  comparisons where `S.toEquivalence(schema)` is available.
- Severity: inventory-backed warning.
- Current P2 enforcement slice: exported `equals` variable declarations in
  schema-modeled files whose initializer contains direct `===` / `!==` and is
  not already derived through `S.toEquivalence`, `SchemaUtils.toEquivalence`,
  or `S.overrideToEquivalence`.
- Rejected: custom equality for a schema class without schema equivalence.
- Accepted: `static readonly equivalence = S.toEquivalence(this)`.
- Escape: inventory entry when comparison intentionally differs from schema
  semantics.

### SFV4-arbitrary-tests

- Scope: tests for schema-modeled invariants, codecs, normalization, and domain
  laws.
- Matcher: static fixture-only coverage for behavior that claims to hold across
  a schema domain.
- Severity: advisory only until at least two pilot conversions are reviewed.
- Current P2 enforcement slice: test files with at least three Schema codec
  helper calls and no schema-derived (`S.toArbitrary` / `Schema.toArbitrary`)
  property coverage. The matcher counts the full Effect v4 codec family —
  Effect, Result, Option, Exit, Promise, and synchronous (`decodeUnknownSync` /
  `decodeSync` / `encodeUnknownSync` / `encodeSync`) variants — and counts both
  the namespace form (`S.decode*` / `Schema.decode*`) and the class-local static
  form (`MyModel.decodeUnknownResult(...)`), so neither sync codecs nor
  class-local statics are a blind spot. Coverage requires a schema-derived
  arbitrary; a bare `fc.property` / `fc.assert` / `fc.check` over a hand-rolled
  arbitrary no longer suppresses the advisory.
- Rejected: one happy-path fixture for a domain law.
- Accepted: fixture for a golden payload plus
  `fc.property(S.toArbitrary(Model), law)`.
- Escape: no finding for snapshots, migrations, regression repros, or external
  compatibility payloads.
- Constraint: tests import existing source schemas and their arbitrary
  annotations; they do not define weaker test-only schemas to make generation
  easier.

### SFV4-class-statics

- Scope: repeated decode/encode/arbitrary/equivalence helpers for the same
  `S.Class`.
- Matcher: duplicate exported helper constants in the same module or package.
- Severity: docs first, warning only after repeated patterns are proven.
- Accepted: class-local statics when they reduce actual duplicate plumbing.
- Escape: boundary modules may keep exported helpers when class statics would
  create import cycles.

### SFV4-boundary-codec

- Scope: JSON/form/query/string-tree boundaries.
- Matcher: ad-hoc parsing near schema definitions where `S.fromJsonString`,
  `S.fromFormData`, `S.fromURLSearchParams`, or `S.toCodecStringTree` is a
  direct fit.
- Severity: docs first, no hard-fail until examples land.
- Current P2 enforcement slice: direct `JSON.parse(...)` call expressions emit
  an advisory to prefer `S.UnknownFromJsonString` or
  `S.fromJsonString(schema)`.
- Escape: non-standard protocols or performance-sensitive paths with measured
  justification.

## Acceptance Criteria

- The packet remains valid and self-contained.
- Scratch examples compile and the scratch Vitest suite passes.
- Standards/skills/docs explain when and why to use defaults, arbitraries,
  static schema APIs, equivalence, class statics, precision checks, and
  boundary codecs.
- `beep lint schema-first` owns new enforcement.
- P2 proves structured schema-first issues with either a failing fixture test or
  a Yeet dry-run artifact containing file, rule id, remediation, and category.
- Remediation phases are scoped and can be resumed independently.
