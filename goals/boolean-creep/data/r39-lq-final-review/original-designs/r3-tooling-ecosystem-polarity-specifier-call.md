# Instance

- id: `r3-tooling-ecosystem-polarity-specifier-call`
- source/main: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`; P2 only.
- file:line: `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:273`
- symbol: `collectSourceViolations`
- members: `isDynamicImport`, `isRequire`
- evidence: E1 at `EcosystemPolarity.ts:273-275` — both flags derive from one
  expression node; an `ImportKeyword` cannot also be an identifier named
  `require`, so combined true is never written.

# Current shape

The runtime source-edge scan asks two mutually exclusive questions about each
call expression, returns early when neither matches, and sends both supported cases through the
same literal-specifier path. The domain is one call kind rather than two bits.

# Cardinality gap

Four boolean pairs are representable and three call kinds are legal:
`dynamic-import`, `require`, and `other`. SyntaxKind.ImportKeyword and an
Identifier node are disjoint AST kinds, so true/true is impossible independent
of observed producers. The private function accepts arbitrary source text via
the public lint entry, not only today's repository files. Preserve syntactic
classification: an identifier whose getText is exactly require qualifies even
if shadowed; property access, other casing, parenthesized callee or an alias
must follow the current AST result without semantic resolution/unwrapping.
The Boolean pair is private and has no public constructor or wire decoder.

# Target schema

Define a private named `RuntimeImportCallKind` LiteralKit and one classifier for
the call expression. Match `other` to return early and share the existing
specifier extraction for `dynamic-import` and `require`. Reuse `$I` and annotate
the named literal schema with same-name Type. Keep a bare LiteralKit base for
construction helpers and restore needed statics explicitly after annotations,
or use schema-derived guards; do not assume generic annotations preserve every
kit method. Classifier input is the expression Node already obtained after
Node.isCallExpression, not raw text or a new decoded request object. Do not collapse the
domain to an unnamed boolean or add stored state.

# Migration inventory

- `EcosystemPolarity.ts` imports/private source-scan helpers — add the named
  LiteralKit and classifier near `literalSpecifier`.
- `EcosystemPolarity.ts:258-287` — replace both local booleans and NOR guard
  with one exhaustive call-kind decision; preserve call traversal, argument
  selection, template/static literal handling, line numbers, and violation
  ordering. The visitor return skips processing only that node; it is not
  traversal.stop/skip. Nested supported calls inside an unsupported call must
  still be visited. Read only the first argument; additional arguments and
  import attributes do not change matching. String/no-substitution literals
  yield full literal text, template expressions yield only the head text,
  other expressions yield None. No evaluation, concatenation folding, trimming
  or symbol resolution is added. Prefix matching remains exact @beep/.
- `test/ecosystem-polarity.test.ts:41-75` already covers static import, export,
  dynamic import, require, and interpolated variants; add unrelated call and
  identifier-near-miss rows plus exact ordering.
- The owner remains private; `commands/Lint/index.ts:13` exports the module's
  public options/violation/summary/error/check/command, not either local bit.
  Preserve the public optional includePaths contract: omitted means all members,
  empty array means no changed members; normalization/member filtering is
  unrelated. Existing command registration and failure exit reporting remain.
- Preserve discovery/member and source-file sorting, manifest findings before
  source findings, then static imports, exports and descendant-call traversal
  order per file. Do not sort by source line or deduplicate identical findings.
  Retain full file/detail strings and current line-source choice: specifier
  start for imports/exports, call start for dynamic/require. Manifest runtime
  dependency/bundled-field rules are not part of this owner.

# Guard-deletion accounting

Delete `isDynamicImport`, `isRequire`, the impossible combined-true pair, and
`!isDynamicImport && !isRequire`. One literal classifier owns the early return.

# Encoded-side impact

None. Violation schemas, source paths/lines, details, command output, and
manifest checks remain byte-compatible. Preserve public schema field types and
optional-key behavior, typed filesystem error mapping and exact stdout/stderr
messages; do not tighten arbitrary source text or output payload strings. This is private lint traversal state.

# Test impact

Cover direct and interpolated dynamic imports and requires, unrelated calls,
shadowed/non-call identifiers as supported by the current AST policy, missing
arguments, non-literal arguments, duplicate/order behavior, and unchanged
violation details. Keep tests importing product source through
`@beep/repo-cli`; run focused ecosystem-polarity tests and full repo-CLI
verification under the current release/changeset policy; private-package status alone does
not create an unconditional patch obligation. Existing41–77fixture checks detail
order, not every AST near miss or exact line number. Add meaningful public-entry
fixtures for shadowed require, member/parenthesized/alias calls, nested supported
calls within other calls, missing/extra args and empty/interpolated heads.
This P2 refresh executed no parser, lint, package test or implementation.

# Risk and sequencing

Land in Tier 1E. Both supported call kinds intentionally share extraction; the
literal exists to make the impossible pair unrepresentable, not to fork their
behavior or broaden the lint's source-edge policy.
