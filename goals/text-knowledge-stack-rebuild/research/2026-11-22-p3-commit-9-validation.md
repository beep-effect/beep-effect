# P3 commit 9 validation

Retired the nlp Handoff contract and Ontology kinds and replaced the Graph float
span with an optional text Position. Wink resolves a quote uniquely; repeated or
missing surfaces have no span. Semantica degrades missing, non-UTF-16 and
width-mismatched pattern spans. Graph node carriers remain for P6.

Local proof: full package verification (lint, audit and docgen) passes for nlp,
wink, nlp-processing and langextract. Their tests pass, as do their explicit
JSDoc checks and package-test-typechecks; every result artifact has exitCode 0
and empty output. Semantica's full tests and canonical check pass. Changed-file
Biome and oxlint pass. Schema-tag-idioms and schema-first pass; effect-vitest
passes after refreshing stale occurrence metadata, preserving existing reasons.
The required package/app search for the retired nlp subpaths is empty.

The pattern live/replay digest changes together because repeated surfaces now
have no span. Hosted batch fixtures remain unchanged. Additional affected
JSDoc examples in nlp-processing migrated with the consumers. SpanFields' stale
schema-first and keep-class rows were removed here so the required pre-commit
schema-first check can pass. Broader inventories remain commit 11.

No new source file, push or GitHub operation. These are local deterministic
checks and do not establish hosted CI or live provider behavior.
