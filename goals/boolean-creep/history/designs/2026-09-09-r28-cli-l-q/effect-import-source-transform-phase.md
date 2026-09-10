# Instance

- id: `effect-import-source-transform-phase`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:278`
- symbol: `EffectImportSourceTransformSummary`
- members: `affected`, `rewritten`
- evidence classes:
  - E4 at `EffectImports.ts:1488-1497` — `rewritten` is derived from nonzero
    rewrite counters; `affected` is the same predicate or nonempty manual
    reviews, so rewritten implies affected.
  - E2 at `EffectImports.ts:1537-1549,1731-1742` — fenced-source replacement
    reads the rewrite substate and executable aggregation reads the broader
    affected state; no reader handles rewritten-without-affected.

# Current shape

One internal source transformation stores `affected` and `rewritten`
alongside the rewrite counters and manual-review array that completely
determine them. The flags flatten clean, review-only, and rewritten states and
also duplicate upstream payload facts.

# Cardinality gap

Four pairs are representable. Three are legal: clean, affected only by manual
review, and rewritten (with or without manual reviews). Rewritten without
affected is impossible.

# Target schema

Define a private named
`EffectImportSourceDisposition = LiteralKit(["clean", "review-only", "rewritten"])`
and a pure derivation helper over `rootImportsRewritten`,
`rootExportsRewritten`, and `manualReviews`. Remove both fields from
`EffectImportSourceTransformSummary`; derive the literal only at the two
reader boundaries. This follows the campaign rule that derived state remains
derived rather than becoming a redundant stored literal.

# Migration inventory

- `EffectImports.ts:274-290` — remove both schema fields and add the private
  literal owner/helper next to this internal summary.
- `EffectImports.ts:1488-1497` — stop writing the two derived booleans.
- `EffectImports.ts:1537-1549` — derive disposition once and replace fenced
  content only for `rewritten`.
- `EffectImports.ts:1731-1742` — derive disposition once and append changed
  executable files for `review-only` or `rewritten`.
- `packages/tooling/tool/cli/test/effect-imports.test.ts` — retain clean,
  rewrite-only, review-only, and rewrite-plus-review behavior through public
  summaries and file results.

# Guard-deletion accounting

Delete both `affected`/`rewritten` schema fields, their sole writer
expressions, and both property guards. The helper exhaustively names the three
states from the existing payload facts; no redundant phase is stored.

# Encoded-side impact

None. The source-transform summary is private and not printed or persisted.
The public `EffectImportRulesSummary` counts, changed files, manual reviews,
and CLI JSON remain unchanged.

# Test impact

Table-test the four payload situations: no counts/reviews, reviews only,
rewrites only, and rewrites plus reviews. Prove the last two replace fenced
content, the last three mark affected source as appropriate, and all public
counts/file lists remain stable. Keep package-source imports through
`@beep/repo-cli/test/Laws`.

# Risk and sequencing

Tier 1E with the other Effect Imports internal changes. Preserve the
distinction between manual-review-only and actual rewritten content; never use
the broader disposition to decide whether to replace a fenced source.
