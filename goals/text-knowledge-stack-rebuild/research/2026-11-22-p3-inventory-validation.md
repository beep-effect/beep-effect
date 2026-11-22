# P3 L2 inventory validation

P0 base: f9982f3b5e65076be0cad0686deab3801cba99c9. P3 lane base: 525c61bb090. Local evidence only.

## New source coverage

Every new P3 source row is measured under Node/V8, at 100 percent on all four
measures with zero uncovered units. Law-practice used only the read-codec test
and coverage include; no whole-package law-practice or repo-cli coverage ran.

| Source | Lines | Statements | Branches | Functions |
| --- | --- | --- | --- | --- |
| packages/foundation/capability/langextract/src/Extraction/Extraction.result.ts | 100 | 100 | 100 | 100 |
| packages/foundation/capability/langextract/src/Handoff/Handoff.codec.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/AnnotationDocument.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/AnnotationId.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/Containment.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/Generation.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/Kind.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/Kinds.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/Merge.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/Restrict.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/index.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/internal/DocumentJson.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/annotation/src/rdf/OaCodec.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/text/src/Arbitrary.ts | 100 | 100 | 100 | 100 |
| packages/foundation/modeling/text/src/Capture.ts | 100 | 100 | 100 | 100 |
| packages/law-practice/use-cases/src/OfficeActionStructure/OfficeActionStructure.read.ts | 100 | 100 | 100 | 100 |

## S31 raw inventory comparison

Counts below are raw rows, not a claim that the P0 ceiling is met. The P3
lane inherited four schema-first rows and fourteen effect-vitest rows above
P0. Commit 4 explicitly records three schema-first exceptions in the binding
annotation-commit-4-surface decision; commit 9 removes the SpanFields row.
Commits 9 through 11 add no exception or allowlist debt. The remaining net
schema-first growth of two is attributable to those explicit commit-4 calls.

| Inventory | P0 | P3 lane base | Final local tree |
| --- | --- | --- | --- |
| standards/schema-first.inventory.jsonc | 282 | 286 | 288 |
| standards/effect-vitest.inventory.jsonc | 647 | 661 | 661 |
| standards/effect-laws.allowlist.jsonc | 36 | 36 | 36 |
| goals/schema-opaque-default/ops/codemod/keep-class.jsonc | 114 | 114 | 113 |

Coverage rows for new source are registration under the existing P2 decision
p2-coverage-rows-at-full-coverage-are-registration. The annotation package adds
eleven source rows, text adds two, langextract adds two and law-practice adds
one. Nlp retires four source rows. Existing per-file uncovered units did not
increase in the small-package writer. Nlp aggregate percentages can fall when
fully covered retired declarations leave the denominator; uncovered units fell.

Generated schema and instrumentation definitions and dependency-boundary rows
describe the production tree. They are not exception or suppression entries.
Cache review records configuration under local-linux-x64-bun1.4.5 and grants no
new qualification. The Biome hold continues under a superseding ledger claim.

## P0 census path-count reproduction

This reproduces the census method: count lines naming source paths under the
eleven program package names (including the provenance/text rename and the new
annotation home). These are raw path mentions, not new debt allowances. The
generated boundaries and catalog definitions are structural registration; new
coverage rows are the fully covered registrations listed above.

| Inventory or allowance surface | P0 path lines | Lane-base path lines | Final path lines |
| --- | --- | --- | --- |
| standards/coverage.regression-baseline.jsonc | 216 | 234 | 245 |
| standards/schema-first.inventory.jsonc | 10 | 10 | 12 |
| standards/effect-laws.allowlist.jsonc | 1 | 1 | 1 |
| packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts | 1 | 1 | 1 |
| standards/fallow.health.regression-baseline.jsonc | 3 | 3 | 3 |
| standards/fallow.boundaries.provenance.jsonc | 7 | 7 | 7 |
| standards/fallow.boundaries.generated.jsonc | 9 | 9 | 10 |
| .fallowrc.jsonc | 2 | 2 | 2 |
| .gitleaks.toml | 3 | 3 | 3 |
| _typos.toml | 1 | 1 | 1 |
| biome.identity.jsonc | 1 | 1 | 1 |
| packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts | 3 | 3 | 3 |
| standards/effect-vitest.inventory.jsonc | 0 | 0 | 0 |
| standards/fallow.dead-code.regression-baseline.jsonc | 0 | 0 | 0 |
| standards/fallow.pilot.inventory.jsonc | 0 | 0 | 0 |
| standards/check-census.regression-baseline.jsonc | 0 | 0 | 0 |
| standards/jsdoc-totals.regression-baseline.jsonc | 0 | 0 | 0 |
| standards/test-typecheck.blindspot-baseline.jsonc | 0 | 0 | 0 |
| standards/entity-kit-freeze.baseline.jsonc | 0 | 0 | 0 |
| goals/knowledge-doctor.baseline.jsonc | 0 | 0 | 0 |
| .gitleaksignore | 0 | 0 | 0 |
| biome.jsonc | 0 | 0 | 1 |
| .oxlintrc.json | 0 | 0 | 0 |
