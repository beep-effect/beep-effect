# Instance

- id: `r3-tooling-ecosystem-polarity-specifier-call`
- file:line: `packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:273`
- symbol: `collectSourceViolations`
- members: `isDynamicImport`, `isRequire`
- evidence: E1 at `EcosystemPolarity.ts:273-275` — both flags derive from one
  expression node; an `ImportKeyword` cannot also be an identifier named
  `require`, so combined true is never written.

# Current shape

The runtime source-edge scan asks two mutually exclusive questions about each
call expression, rejects neither, and sends both supported cases through the
same literal-specifier path. The domain is one call kind rather than two bits.

# Cardinality gap

Four boolean pairs are representable and three call kinds are legal:
`dynamic-import`, `require`, and `other`.

# Target schema

Define a private named `RuntimeImportCallKind` LiteralKit and one classifier for
the call expression. Match `other` to return early and share the existing
specifier extraction for `dynamic-import` and `require`. Do not collapse the
domain to an unnamed boolean or add stored state.

# Migration inventory

- `EcosystemPolarity.ts` imports/private source-scan helpers — add the named
  LiteralKit and classifier near `literalSpecifier`.
- `EcosystemPolarity.ts:258-287` — replace both local booleans and NOR guard
  with one exhaustive call-kind decision; preserve call traversal, argument
  selection, template/static literal handling, line numbers, and violation
  ordering.
- `test/ecosystem-polarity.test.ts:41-75` already covers static import, export,
  dynamic import, require, and interpolated variants; add unrelated call and
  identifier-near-miss rows plus exact ordering.
- Whole repo-CLI source and barrel search found no consumer of the private
  locals or need for a public export.

# Guard-deletion accounting

Delete `isDynamicImport`, `isRequire`, the impossible combined-true pair, and
`!isDynamicImport && !isRequire`. One literal classifier owns the early return.

# Encoded-side impact

None. Violation schemas, source paths/lines, details, command output, and
manifest checks remain byte-compatible. This is private lint traversal state.

# Test impact

Cover direct and interpolated dynamic imports and requires, unrelated calls,
shadowed/non-call identifiers as supported by the current AST policy, missing
arguments, non-literal arguments, duplicate/order behavior, and unchanged
violation details. Keep tests importing product source through
`@beep/repo-cli`; run focused ecosystem-polarity tests and full repo-CLI
verification with the required changeset policy.

# Risk and sequencing

Land in Tier 1E. Both supported call kinds intentionally share extraction; the
literal exists to make the impossible pair unrepresentable, not to fork their
behavior or broaden the lint's source-edge policy.
