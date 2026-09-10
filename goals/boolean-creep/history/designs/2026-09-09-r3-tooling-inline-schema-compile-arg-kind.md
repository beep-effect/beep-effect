# Instance

- id: `r3-tooling-inline-schema-compile-arg-kind`
- file:line:
  `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts:61`
- symbol: `reportMessage.argKind`
- members: `isStaticSchemaReference`, `isNestedStaticSchemaCall`
- evidence: E2 at `no-inline-schema-compile.ts:154-161` —
  `reportMessage` returns the high-severity message for a nested static schema
  call, otherwise the medium message for a static schema reference, otherwise
  no finding. A call expression cannot simultaneously be the identifier or
  member-expression reference shape, and there is no combined-true arm.

# Current shape

The rule classifies the first compiler argument with two mutually exclusive
predicates. `reportMessage` stores the nested-call result in `high`, then uses
an ordered boolean branch and ternary to choose one of two exact diagnostic
messages or no finding. This is one argument kind flattened into boolean
probes. The predicates also participate in the recursive
`Schema.fromJsonString(...)` recognition and remain useful independently.

# Cardinality gap

Four predicate pairs are representable, while three argument states are legal:
`nested-static-call`, `static-reference`, and `other`. The nested call is a
CallExpression; the static reference is an Identifier or MemberExpression
after unwrapping, so combined true is impossible.

# Target schema

Add a private named `InlineSchemaCompileArgumentKind` LiteralKit with
`nested-static-call`, `static-reference`, and `other`, imported from the narrow
`@beep/schema/LiteralKit` subpath. One classifier checks the nested call first
and the reference second. Match that literal exhaustively in `reportMessage`
to return the existing high message, medium message, or `Option.none`. Keep the
two lower-level predicates for recursive AST recognition; do not duplicate
their grammar inside the message function.

# Migration inventory

- `no-inline-schema-compile.ts:8-19` — add the narrow LiteralKit import. This
  co-lands with the direct `@beep/schema` dependency required by the sibling
  manual-runtime receiver design in the same `@beep/lint-rules` package.
- `no-inline-schema-compile.ts:58-72` — retain
  `isStaticSchemaReference`; it is the lower-level recognizer used both by the
  new classifier and recursive nested-call handling.
- `no-inline-schema-compile.ts:122-151` — retain `asSchemaMethodCall` and
  `isNestedStaticSchemaCall`, including `fromJsonString` recursion and current
  imported-schema provenance.
- `no-inline-schema-compile.ts:153-161` — add the single argument-kind
  classifier and replace `high` plus the ordered boolean/ternary reader with an
  exhaustive match over the literal.
- `no-inline-schema-compile.ts:163-224` — preserve import tracking,
  function-depth accounting, compiler-method recognition, occurrence order,
  and report locations.
- `src/rules/index.ts:11,61` and the package root export continue exposing the
  same default rule and rule id; the new literal and classifier stay private.
- `test/oxlint-sources.ts:186-237`, `test/oxlint-harness.ts`, and
  `test/oxlint-rules.test.ts` remain the product-facing test seams.

# Guard-deletion accounting

Delete the `high` boolean, its priority `if`, and the subsequent
`isStaticSchemaReference(...) ? ... : ...` message ternary from
`reportMessage`. One `InlineSchemaCompileArgumentKind` classifier owns the
mutual exclusion and one exhaustive match owns message selection. Retain the
recursive predicate guards because they recognize the grammar used to derive
the literal rather than storing a parallel state.

# Encoded-side impact

None. The literal is private derived AST state. Rule id, compiler method set,
import provenance, function-scope policy, finding count/order/location, and
the exact high and medium diagnostic strings remain unchanged.

# Test impact

Add table rows for a plain identifier schema, member-expression schema,
parenthesized forms, nested schema constructors, recursive
`Schema.fromJsonString(...)`, dynamic/non-static first arguments, missing first
arguments, and unrelated calls. Assert the exact high versus medium message in
addition to count, line, and rule id, extending the typed oxlint report test
codec only as needed. Retain module-scope and unrelated-import negative cases.
Run focused lint-rule tests and full `@beep/lint-rules` package verification.

# Risk and sequencing

Land in Tier 1E alongside
`r3-tooling-manual-runtime-receiver-kind`; both touch the lint-rules package
manifest. Preserve the existing special recursion for `fromJsonString` and do
not broaden the definition of a static schema while making its finite kind
explicit.
