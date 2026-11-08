# Autonomous evaluation and structural repair — 2026-10-31

The fixed benchmark improves from 34/538 to **37/538 exact claim structures (6.8773%)**. All 34 protected passes remain; claims 9, 10 and 11 in `11575704-root-1` are the three gains. The original 0/538 measurement and every intervening result remain separate records. No reference label, selected claim, equality criterion or failed-input denominator was changed.

## Recurring gap repaired

The closest headlamp-family predictions already matched their terms, spans and functional clauses but lacked result-refinement dependencies. An ancestor introduces a result through “to form”; a dependent claim then starts a functional limitation with that result's referring term. The decomposer now links that refinement to the unique immediate-parent element, including through a parent refinement. It requires a unique source-defined result, exact normalized head and antecedent identity. Proper introductions retain precedence. Generic bare terms, ambiguous definitions and sibling-only definitions do not qualify. This is a structural relation: existing advisory antecedent warnings remain independently visible.

The intermediate v15 checkpoint added quantified-object predicate and “to form” boundaries and measured 34/538. It is retained separately. v16 adds the conservative result dependencies above; it has 99 focused domain tests, including direct/transitive and ambiguity/branch controls. Independent code review found no actionable defect in this bounded repair; it did not certify general parsing correctness.

## Same benchmark, same labels

| Version | Exact structures | Typed-edge F1 | Input failures | Structural mismatches |
| --- | ---: | ---: | ---: | ---: |
| v14 protected baseline | 34/538 | 29.5816% | 58 | 446 |
| v15 intermediate | 34/538 | 29.7755% | 58 | 446 |
| v16 | 37/538 | 29.8169% | 58 | 443 |

v16 has 1,840 matching typed edges, 5,432 predicted edges and 6,910 reference edges: precision 33.8733%, recall 26.6281%. Exact structures remain the primary metric. There are no undecomposed selected claims among successfully normalized inputs. The score remains poor; these improvements do not establish general reliability or held-out accuracy. The full evaluation and summary retain rule/CPC/feature slices. The paired retention receipt lists every retained and gained claim and an empty lost set.

## Acceptance without mandatory attorney attendance

The user explicitly superseded mandatory attorney presence. `research/AUTONOMOUS-ACCEPTANCE-v1.md` defines independent automated source review and bounded unresolved outcomes. Two separate GPT-6.1-Sol sessions at medium effort reviewed the frozen six-family, 50-claim reference sample without runtime predictions or parser rules. Original extractor/critic labels remain untouched; review proposals are overlays only.

After two bounded rounds, both reviewers agree at self-assessed confidence at least 0.95 on **33 existing references**, **three proposed revisions**, and leave **14 uncertain**. Agreement with the existing reference is 33/50 (66%); it is neither attorney agreement nor calibrated accuracy. The three revision proposals concern selector heads in `13575735-root-1` claims 1/3 and same-clause nominal antecedence in `11299450-root-1` claim 6. Seven of eight convention questions reach consensus; the distributive “each” edge remains unresolved. The summary validates 154 literal source quotations. Self-assessed confidence and separate sessions do not remove shared-model error. All unresolved claims remain in the benchmark denominator.

## Current allowed-claim automated review

The same 200-set/3,184-claim cohort yields 196 checked sets and 3,108 checked claims; four sets/76 claims fail input normalization and remain reported. There are 21,531 raw advisory findings and no undecomposed checked claims. Counts are coverage and alert volume, not false-positive labels.

The original random 30-claim sample is unchanged. A versioned v16 input includes full canonical source and dependency context for all 30, with **109 findings and six no-finding confirmations (115 questions)**. Two separate source-grounded automated reviewers independently answered all questions. The importer verifies authority, runtime/input hashes, exact question ownership, confidence thresholds and literal source quotations; 605 quotations pass. Consensus has 69 wrong, 30 right and 16 uncertain statements. Fourteen uncertain statements concern chain-work-limit warnings whose runtime event cannot be verified from source alone.

At claim level, 21 sampled claims have at least one agreed erroneous advisory finding, seven have all statements agreed right, and two remain unknown. The fixed-cohort erroneous-alert proportion is therefore identified between **70.0% and 76.7%**. The conditional 95% Wilson envelope is **52.1%–88.2%**, spanning the lower bound's lower interval and upper bound's upper interval. No point estimate substitutes a value for unknown outcomes. The interval approximates sampling uncertainty conditional on automated judgments; it does not cover correlated model error. This is not finding-level precision, legal-defect prevalence, specificity on independently clean claims, or all-USPTO prevalence. Prior predictions informed repairs, so this is not fresh held-out validation.

This high alert noise is a material limitation. Findings remain advisory review items and do not block drafts or pipelines. The [USPTO MPEP §2173.05(e)](https://www.uspto.gov/web/offices/pac/mpep/s2173.html) explains that a missing explicit antecedent does not by itself establish indefiniteness when context or inherent features supply an ascertainable basis. Automated source judgments here do not determine the ultimate legal outcome. Actual-attorney agreement and adjudication flags remain false throughout.

## Verification and preserved evidence

All three law-practice package verifications pass for v16 (domain, use-cases, server). The four automated-adjudication boundary tests pass, covering disagreement, low confidence, ownership, invalid provenance, source evidence and prevention of human-authority promotion. The separate human import paths retain their authority guards. The same IPRally smoke remains explicitly non-US/non-gold: one claim/tree, 523 tokens, 78 findings, 16 coverage warnings, no undecomposed claim; no licensed source data is committed.

`autonomous-review-v1/` contains byte-preserved reviewer receipts, the v16 allowed input, and reproducible derived summaries. Round-one and round-two reference reviews remain separate. `2026-10-31-v16-retention.json`, `2026-10-31-allowed-v16-coverage.json`, versioned runtime/sample freezes and evaluation outputs bind this measurement. Historical review packets and original labels/results are retained. Independent automated review satisfies the revised P2/P3 measurement procedure with explicitly unresolved outcomes; it does not repair gold or certify legal validity. Yeet publication, hosted readiness and final reflection remain separate delivery gates.

## Post-main compatibility replay

The delivery merge changes only the normalizer's JSDoc import within the 20 frozen runtime paths. A new v17 freeze retains v16 untouched. The fixed positive and allowed replays are semantically identical except their implementation digest; all 55 successful positive-family and 196 successful allowed-set prediction reports are byte-identical. All 287,638 source-anchor occurrences match UTF-16 source slices. The same 99 focused tests pass after synchronization. The v16 automated judgments remain attributed to v16; the post-main receipt establishes prediction/source identity rather than inventing new judgments.

Reproduce in fresh output directories:

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v17-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-v17-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v17-freeze.json \
CLAIM_ALLOWED_OUTPUT=.beep/allowed-v17-reproduction \
  bun packages/law-practice/server/test/evaluation/allowed.main.ts
python goals/claim-element-antecedent-check/research/test-automated-reference.py
python goals/claim-element-antecedent-check/research/test-automated-adjudication.py
```

Both automated summaries reproduce exactly from their committed input and reviewer receipts. Seven new boundary tests cover the two automated import paths. A separate provenance receipt verifies 120 reference-review input hashes against the recorded review commit and byte-identical public copies of prior-round receipts. The on-demand reflection passes the reflection-artifact validator; publication and hosted readiness remain active.

## Delivery policy cleanup

The current main policy gates required stable module-level schema expressions, `S.tag` for fixed protocol fields, explicit resource hook budgets and reviewed inventories. These fixes cover this branch's law-practice and named-fragment MCP regression tests; no new schema shape or scoring rule is introduced. After a fresh frozen-lockfile install, the full positive and allowed results are identical to the post-main replay, as are all 251 successful prediction reports. The delivery receipt pins the evaluation/scorer files. All 12 targeted server, nine use-case and 21 MCP regression tests pass; repository-wide oxlint passes. Native-source integrity and CLI evaluation entrypoints retain explicit owner/reason/removal-condition exceptions in the generated policy inventories. This does not remove or weaken tests. The current JSDoc/hosted delivery gates remain active.

Smoke narrative correction: the raw smoke receipt records 523 tokens; F15 is the IPC section. Its original result bytes are unchanged.

## Equivalent quality refactor and v19 replay

The Fallow audit identified overly nested token predicates, source-integrity checks and offline replay programs. The delivery refactor names the existing predicate/head guards, shares exact regex-capture matching, splits integrity assertions and uses explicitly sequential per-input evaluation effects. The standalone evaluation entrypoints are registered, and the unused public score-schema export becomes private. Structural scoring comparisons and all reference data remain unchanged. Fallow now reports zero dead-code issues, zero complexity findings and zero introduced duplicate groups; its four inherited adjacent clone groups remain attributed separately.

The v19 freeze precedes its replay. All full positive/allowed results are semantically identical to v18 except implementation digest, and all 251 successful prediction reports are byte-identical. Strict recovery remains 37/538 with all 34 protected passes retained. The initial refactor measurement is retained at its own checkpoint; subsequent test-helper typing and allowed-runner cleanup has a separate identity receipt with all 196 allowed predictions unchanged. Domain verification and 99 focused domain tests pass; all 12 selected server integrity/slice tests pass. The corrected server audit/docgen verification also passes (81.0s/28.0s). The generated inventory and hosted publication/readiness gates remain separate.

The final generated JSDoc inventory is refreshed for the refactored source, and its baseline tightens five decreased totals rather than permitting growth. The non-generated zero-legacy documentation check passes. All 631 originally protected historical/fixture files and all 20 current runtime pins are rechecked; raw v19 results and prediction reports are retained in the durable local cache. Publication and hosted readiness remain active delivery steps.

## Completion-audit correction: full current public slice

[The current strict public-slice audit](2026-10-31-current-strict-public-slice.md) records a completion gap that the earlier local summary did not distinguish: the original foot test now preserves a legacy subset, not full current-tree equality. An additional regression uses unchanged frozen US20110074901A1 claim 9, whose full tree passes the unchanged scorer and whose missing “the brush roller” finding matches the recorded examiner phrase at characters 44–60. Both public-slice tests pass. It is a post-measurement witness using existing labels, with no added benchmark claim or changed 37/538 result. Publication was stopped before push to include this stronger evidence; hosted readiness remains pending.

## Current smoke, real MCP dispatch and publication checkpoint

The current v19 runtime repeats the same external IPRally sample with the original input hash and an identical result to v16: one claim/tree, 523 tokens, 78 unreviewed findings, 16 coverage warnings and no undecomposed claim. The versioned receipt retains its non-US/non-gold status, null accuracy and external raw data.

A selected current native MCP integration test passes, proving actual tool dispatch returns source-quoted advisory items and candidate evidence while the stored `kg_candidate_claims` response remains identical before/after. One selected test passes; the other 38 cases are explicitly skipped, not counted as passed. Tool hints are read-only, non-destructive, idempotent and closed-world.

The publication attempt on `dca7a95972` passes 24 collected gates, including regenerated documentation, schema/test policies, static analysis, Fallow and packet checks. It stops before push solely because two generated schema-catalog shards are stale. That failed attempt is retained in a separate receipt. Catalog regeneration changes generated metadata only; final publication, hosted checks and closeout remain pending.

The canonical schema-catalog writer updates only the two named shards (five added lines/one removed line). The subsequent full catalog check passes with 9,352 entries across 173 shards. All 20 v19 runtime file hashes remain unchanged; the measured implementation, labels and previous results are preserved.

## Base synchronization and dependency replay

Publication catches five newly landed main commits before push, overlapping the generated JSDoc and schema-first inventories. The feature branch merges the new base rather than rebasing. Both generated-inventory parents are preserved locally and the canonical writer rebuilds the combined inventories. All 20 v19 runtime files retain their exact hashes. After the new frozen-lockfile install, both full positive/allowed result files and all 251 successful prediction reports are identical to the previous v19 measurement. The adjacent current-base receipt binds the merged main, feature parent, merge commit and lockfile hash; strict recovery remains 37/538 with all 34 protected passes. This is dependency compatibility evidence, not new accuracy. The immutable earlier benchmark and review artifacts remain unchanged.


## Inherited policy publication checkpoint

The publication attempt on `74d81eaff6` completes 23 of 25 collected checks but stops before push on two violations reproduced on clean main `b30cd9e6dd`: five exported internal graph records fail schema-first, and eight new Option/data assertions fail effect-vitest. The [separate checkpoint](2026-10-31-inherited-policy-checkpoint.json) preserves the failure and clean-main attribution. A separate repair lane keeps graph records private, derives reader types from capability signatures, uses exact Effect assertions and canonically refreshes stale policy fingerprints. Both repository policy scans, the fingerprint consistency check and all 10 focused policy tests pass there; its package and documentation verification are still running. This repair has not yet landed and is not merged into this branch.

All 20 frozen runtime hashes and all 631 protected historical/fixture hashes are rechecked with zero changes. The measured result remains 37/538, retaining all 34 protected passes. Attorney attendance is optional under the recorded user authority; publication and closeout remain incomplete delivery work.


The scope acceptance audit confirms that production self-check references are confined to its service/tool registration, USPTO adapter and read-only practice MCP dispatch; no draft or pipeline gate invokes findings as a blocking condition. The current MCP dispatch receipt proves unchanged candidate storage. The IPRally-specific additions consist of derived receipts and the offline smoke runner; raw sample bytes remain external. All changed paths reviewed at this checkpoint are text source, public USPTO XML/JSON fixtures, packet evidence or required integration/generated metadata; no PDF, archive, document or dataset binary is present. `PatentClaim` remains byte-identical to main. These scoped criteria are checked in SPEC; hosted delivery and final closeout are still pending.


## Isolated delivery repair ready for repository review

The [upstream repair](https://github.com/beep-effect/beep-effect/pull/2402) is now ready for review. It resolves the inherited schema/test policies, documentation and deprecated TypeScript API use, and all 11 complexity findings. Its current-base focused suite passes 115 tests in seven files; type-checks, JSDoc, deprecated-API coverage, Fallow health/audit, policy fingerprints and cache policy pass. Original and refactored import parsers match on 942 identical CLI TypeScript inputs from before the tooling retirement. No complexity suppression or threshold increase is introduced.

The [versioned checkpoint](2026-10-31-delivery-unblocker-ready.json) records the passing content-final receipt on `f9549af429` and its four explicit local skips. The ready workflow creates review-trigger commit `cf7267cca4`; both commits have identical Git trees. Required hosted checks and the repository review window remain pending. The repair is not yet merged or consumed by this claim branch. It is isolated so the claim PR can consume one landed main fix without carrying unrelated CLI implementation changes.

All 20 claim runtime hashes and 631 protected historical hashes remain unchanged. The carried claim result is still 37/538 with all 34 protected passes; this delivery checkpoint is not a new accuracy measurement. Attorney attendance remains optional, and actual-attorney flags remain false. P4/P5 remain active.
