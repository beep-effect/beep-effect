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


The R28 request-boundary audit preserves the raw Effect Imports options and
both intentional conflict diagnostics. This private transformation migration
requires no raw-option migration and no FlakeQuarantine predicate refactor.
The public summary codec belongs to its separate Tier 2 singleton after the
ordered Tier 1 batches. Coordinate the shared EffectImports.ts file serially.
R28 source evidence is bound by data/r28-cli-l-q-integration.json; independent
P3 remains required.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Complete source byte-identical to baseline. Retain 4/3: clean, review-only, rewritten; rewrite-plus-review remains rewritten. Fenced replacement uses rewritten, aggregate affected includes reviews. No raw-option migration.

### Current named test locations

- `packages/tooling/tool/cli/test/effect-imports.test.ts:142` — keeps the promoted-family ratchet empty after the P2 stop
- `packages/tooling/tool/cli/test/effect-imports.test.ts:146` — validates candidate CLI flags and renders text and JSON summaries
- `packages/tooling/tool/cli/test/effect-imports.test.ts:206` — is a no-op before a family is promoted
- `packages/tooling/tool/cli/test/effect-imports.test.ts:226` — plans aliases, Function bindings, and type-only namespaces in candidate mode without writing
- `packages/tooling/tool/cli/test/effect-imports.test.ts:255` — rejects candidate writes at the exported runner boundary
- `packages/tooling/tool/cli/test/effect-imports.test.ts:278` — scans the union of explicit files and include prefixes
- `packages/tooling/tool/cli/test/effect-imports.test.ts:305` — leaves generated source files to their owning generators
- `packages/tooling/tool/cli/test/effect-imports.test.ts:334` — rewrites promoted roots to per-module imports and never reverses stable submodules
- `packages/tooling/tool/cli/test/effect-imports.test.ts:380` — keeps executable shebangs ahead of newly emitted imports
- `packages/tooling/tool/cli/test/effect-imports.test.ts:434` — routes side-effect-only root imports to manual review
- `packages/tooling/tool/cli/test/effect-imports.test.ts:463` — keeps manual-review line numbers anchored after a shebang prefix
- `packages/tooling/tool/cli/test/effect-imports.test.ts:498` — leaves an entire declaration unchanged when any binding is unmapped
- `packages/tooling/tool/cli/test/effect-imports.test.ts:525` — derives foundation mappings from source barrels and both export maps
- `packages/tooling/tool/cli/test/effect-imports.test.ts:566` — refuses a foundation target missing from the published export map
- `packages/tooling/tool/cli/test/effect-imports.test.ts:592` — refuses foundation targets when a private package has no published export map
- `packages/tooling/tool/cli/test/effect-imports.test.ts:619` — queues an ambiguous review when two public leaves expose the same source module
- `packages/tooling/tool/cli/test/effect-imports.test.ts:646` — merges compatible destination imports and preserves declaration comments
- `packages/tooling/tool/cli/test/effect-imports.test.ts:682` — merges a comment-bearing declaration without deleting unrelated unused imports
- `packages/tooling/tool/cli/test/effect-imports.test.ts:720` — preserves aliases instead of inventing collision-prone canonical names
- `packages/tooling/tool/cli/test/effect-imports.test.ts:754` — rewrites named root re-exports and preserves their exported aliases
- `packages/tooling/tool/cli/test/effect-imports.test.ts:792` — routes dynamic, import-type, and import-equals roots to structured manual review
- `packages/tooling/tool/cli/test/effect-imports.test.ts:832` — rewrites imports inside JSDoc TypeScript fences without touching executable imports
- `packages/tooling/tool/cli/test/effect-imports.test.ts:892` — keeps the Markdown gate advisory until explicitly enforced and supports promoted writes

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.
