# P3 commits 9 through 11 validation

Implementation is local to the P3 annotation lane. No push, GitHub operation,
parent merge or PR opening is part of this receipt.

## Commits 9 and 10

- bfb8fbddad5: refactor(nlp)!: delete the Handoff contract, the Ontology kinds and the Graph float span
- 53b2d03038b: docs(goals,standards): land the L2 doctrine and hand off the design module

Commit 9 removes the nlp contract and kinds without aliases. Graph entities and
relation participants carry optional Position values; wink returns a position
only for a unique quote. Missing, non-UTF-16 and mismatched pattern spans degrade.
Graph node carriers stay for P6. Commit 10 removes the L2 prototype and OA design
sketch, keeps only claim-log generators, and updates the doctrine and law ledger.
The plan and checkpoint say content-complete in the lane, with no P3 PR open.

| Commit 9 gate | Result |
| --- | --- |
| Retired nlp Handoff/Ontology package and app import search | Empty |
| Full package-verify: nlp, wink, nlp-processing, langextract | Passed: lint, audit, docgen |
| Package tests in that order | 152, 63, 87, 115 passed |
| Package lint:jsdoc and test typecheck in all four | Passed; result artifacts exitCode 0, empty output |
| Semantica full tests and canonical check | Passed |
| Changed-file Biome and oxlint | Passed |
| schema-tag-idioms, schema-first, effect-vitest | Passed; zero introduced effect-vitest findings |

| Commit 10 gate | Result |
| --- | --- |
| Both goal design and operations tsconfig checks | Passed |
| goals doctor | Passed against its inherited baseline |
| decisions check | 150 decisions, zero invalid or projection drift |
| manifest write and check | Passed |
| explore --check and lint roadmap-refs | Passed |
| Design-file Biome and explicit-file oxlint | Passed |
| schema-tag-idioms, schema-first, effect-vitest | Passed |

Goal files are normally excluded from oxlint. Its explicit-file proof used the
same plugin and rules in a temporary configuration with only that exclusion
removed. No workspace package source changed in commit 10, so package docgen and
package test typecheck do not apply to it; both goal compiler checks do.

## Commit 11 proof

The companion inventory-validation report lists all 16 new P3 source rows and
the P0/lane/final S31 counts. Every new source row has measured Node/V8 coverage
of 100 percent on lines, statements, branches and functions. The small-package
writer measured annotation, text, langextract and nlp serially. The law-practice
read codec used only its own test and coverage include, then the existing
additions-only writer with the exact five measured package names; existing
floors were retained. No whole-package law-practice or repo-cli coverage ran.

The full JSDoc inventory exposed a missing same-name type alias on the commit-7
OfficeActionStructureAttemptRead export. Commit 11 includes that minimal type
and documentation fix. It changes no runtime behavior. Full use-cases package
verification, explicit JSDoc, the actual test-typecheck artifact and targeted
Node coverage pass after the fix. The JSDoc baseline does not admit the finding.

| Commit 11 gate | Result |
| --- | --- |
| Scoped small-package Node coverage and baseline writer | Passed; all new rows at 100 percent |
| Targeted law-practice read-codec Node coverage and additions-only writer | Passed; all four measures 100 percent |
| Schema catalog write and full check, plus read-codec scoped check | Passed |
| Instrumentation catalog write and check | Passed |
| Fallow boundaries writer | Passed |
| Schema-first inventory writer and final lint:schema-first | Passed |
| laws allowlist-check | Passed |
| Policy fingerprint writer and final check | Passed |
| Cache-baseline request | Passed with local-linux-x64-bun1.4.5; eight subjects, no dropped reviews |
| cache audit and quality cache-policy | Passed; zero blocking findings, no qualification granted |
| Full JSDoc inventory, totals writer and ratchet | Passed; original totals retained, schema annotation findings zero |
| Biome and oxlint on the read-codec fix, Biome on JSON inventory inputs | Passed |
| Full use-cases package-verify and lint:jsdoc after alias fix | Passed, including docgen |
| Use-cases package-test-typecheck | Artifact exitCode 0 and empty diagnostics |
| schema-tag-idioms and effect-vitest | Passed; zero tag findings and zero introduced test-law findings |
| Offline semantica relation preview | Byte-for-byte match with the frozen report |
| Hold ledger lint | Passed |
| Goal doctor, decisions and final manifest checks | Passed |
| Upstream build for repo-cli and law-practice-domain | Passed: 87 tasks, then census measured |
| check-census --write-baseline and --gate-only | Passed on the built tree; instantiation counts exactly repeated |
| S31 comparison against P0 and lane base | Measured and attributed in the companion report; raw P0 ceiling not claimed met |

The preview and frozen report SHA-256 are both
296bcd0d919d49b4ad6b7ef9299b82c763a24fc0489e3245e81ea2691aaa9ae6.
The census's literal-kit tagged-union timing rose 5.3 percent in the verification
sample; that is an advisory, with unchanged instantiation count, not a failed gate.

Heavy commands ran serially through nice -n 19 while five-minute load was below
128. The initial oxlint exclusion, missing alias and cache-fingerprint ordering
failures were corrected and rerun; no failed attempt is counted as proof.

## Deviations and limits

- Commit 9 also migrates nested nlp-processing JSDoc examples and the pinned
  C0Slice pattern report digest. Live and replay agree; repeated surfaces now
  correctly lack first-match spans. Hosted frozen batches remain unchanged.
- The stale SpanFields schema-first and keep-class rows leave in commit 9,
  rather than waiting for commit 11, to keep its required schema-first gate green.
- The effect-vitest writer refreshes occurrence metadata; existing exception
  reasons are preserved, including the unchanged scoped C0Slice runtime provision.
- Commit 11 includes the read-codec type alias found by its inventory gate.
- Raw S31 totals retain inherited debt above P0. The three commit-4 schema-first
  exceptions are now removed under S31, along with the retired SpanFields row.
  The corrected inventory has 285 rows; no exception or allowlist growth is admitted.

The commit-8 rulings remain: semantica grounds historical unmapped-predicate
residuals without registry additions, the Tika scaffold is text-scaffold/1, and
over-cap candidates remain residuals with reason over-extraction-cap. The PR
opening arrangement remains unchanged: P2 opens against main after PR C merges;
P3 waits for P2 and the orchestrator.

These are local deterministic and offline proofs. They establish no live-provider,
hosted-CI, publication or deployment result. Parent integration, Yeet final-check,
PR review and the later program phases are outside this task.
