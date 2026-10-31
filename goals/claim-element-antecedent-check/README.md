# Claim Element Antecedent Check

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give every patent claim a span-anchored element tree and run an advisory
§112(b) antecedent-basis and dependency self-check over it. The tree, the pure
decomposer and the checker live in `@beep/law-practice-domain`; the
`ClaimSelfCheck` service lives in `@beep/law-practice-use-cases`. Findings
reach the attorney as `claim-finding` review items, and the checker is
measured on public USPTO claims with a strict structural metric.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/claim-element-antecedent-check/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phases, dependencies, blockers.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - sources this goal needs.
6. [`history/`](./history/) - evidence and closeouts, if present.

Provenance: graduated from
[`explorations/claim-element-graph`](../../explorations/claim-element-graph/README.md)
on 2026-10-14. Read its
[`BRIEF.md`](../../explorations/claim-element-graph/BRIEF.md),
[`DECISIONS.md`](../../explorations/claim-element-graph/DECISIONS.md) and
[`MAP.md`](../../explorations/claim-element-graph/MAP.md) for the shaped pitch,
the rulings and the gated re-entry points.

Sibling goals:

- [`review-verdict-envelope`](../review-verdict-envelope/README.md) - owns
  `ReviewItem` / `VerdictRow`; its P1 schema gates this goal's P3.
- [`patent-document-schema`](../patent-document-schema/README.md) - owns
  `PatentClaim`, which this goal reads and does not change.
- [`epistemic-claim-lifecycle-gate`](../epistemic-claim-lifecycle-gate/README.md) -
  owns `CandidateClaim` and the lifecycle findings enter.
- [`patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) -
  paused; a later consumer of ordered limitations.

## Current Phase

P2/P3 are measured under autonomous acceptance v1. The fixed benchmark is **37/538**, retaining every protected pass. Independent source reviews and the current-runtime allowed sample are complete with uncertainty retained. Findings remain advisory; alert noise and structural recovery remain poor. P4 publication/readiness and P5 closeout are in progress; attorney attendance is optional.

## Current Acceptance Authority

The user explicitly requires autonomous completion without attorney presence. [Autonomous acceptance v1](research/AUTONOMOUS-ACCEPTANCE-v1.md) governs current work: independent automated review/adjudication, immutable references/results, explicit uncertainty and optional later attorney review. Historical human-hold records remain intact and are superseded for current completion.

## Latest Evidence

- [Review repairs and retained evaluation](history/2026-10-31-review-repair-evaluation.md): rejects and preserves the 35/538 attempt; the refined v22 scores 37/538 with all 34 protected and all 37 prior passes. It corrects component defining-clause boundaries, binds review identities, bounds tool responses and uses canonical documentation categories. The original 30-claim automated judgments carry forward only because their exact prediction reports and evidence remain unchanged; no fresh or attorney review is claimed.

- [App integration repair and full package proofs](history/2026-10-31-delivery-integration-repair.json): preserves every assertion and extends the all-tools telemetry canary to the new tool. MCP and app audit/docgen pass; generated identity profile freshness and cache audit pass.

- **Primary delivery PR:** [#2411](https://github.com/beep-effect/beep-effect/pull/2411) is published as a draft. Its first hosted checks exposed missing app tool metadata and telemetry registration, a pipe-style diagnostic in an MCP regression test, and a stale generated identity lint profile. The current delivery wave repairs those integration gaps while retaining the fixed 37/538 measurement and every protected pass. Hosted readiness and closeout remain pending; earlier unpublished checkpoints below are historical.

- [Schema inventory reconciliation](history/2026-10-31-schema-inventory-refresh.json): the first publication collection passed 24/25 checks in over ten minutes. Accepted main #2409 removes its five obsolete inventory rows; the fresh standalone check passes with no new exceptions. Publication proceeds through the documented hosted-first route, retaining every failed and successful receipt.

- [Accepted-main replay](history/2026-10-31-current-base-replay-2.json): consumes #2399 at f16d82e9f1, closes the competing #2402 unmerged with its recovery branch retained, and proves both full results and all 251 reports unchanged. All 34 protected passes and all prior evidence remain intact; all three current-base package verifications pass.

- [Shared delivery repair coordination](history/2026-10-31-delivery-coordination.json): #2399 is the designated repair to land first. The tested alternative is retained locally; claim publication waits for accepted main. Strict37/538 and all34 protected passes remain unchanged.

- [Isolated repository repair ready for review](history/2026-10-31-delivery-unblocker-ready.json): upstream PR #2402 has a passing content-final receipt with explicit local skips and an identical-tree review-trigger head. Hosted checks, its review window and merge remain pending; the claim delivery PR is still unpublished.

- **Current full strict public slice (2026-10-31):** [audit and regression](history/2026-10-31-current-strict-public-slice.md) distinguish the original legacy foot subset from a full current claim 9 comparison for US20110074901A1. Both tests pass; the unchanged scorer accepts the full frozen tree and the checker reproduces the examiner-cited “the brush roller” at 44–60. Source labels/results and 37/538 remain unchanged. This is a post-measurement regression witness, not new held-out accuracy.

- **Current autonomous evaluation (2026-10-31):** [report](history/2026-10-31-autonomous-evaluation.md) records **37/538**, all 34 protected claims retained and three gains, with unchanged references/results. Independent automated reference review yields 33 agree/3 revise/14 uncertain out of 50; seven of eight conventions reach consensus. Current-runtime allowed review yields 21 erroneous-alert claims, seven negative and two unknown in the original 30-claim sample: 70.0–76.7% identification bounds and a conditional 52.1–88.2% Wilson envelope. Actual attorney flags remain false. 99 focused tests and all three package verifications pass. Historical human holds below are superseded by the current authority.

- **User-directed structural repair while attorney review is unavailable (2026-10-31):** [comparison](history/2026-10-31-quantity-comparison.md) records **34/538 exact structures (6.32%)**, retaining all 31 previous passes with three gains and zero losses. Edge F1 rises to 29.5816%; 446 mismatches/58 input failures remain. Predicate/quantity-context fixes have three new regressions, 94 focused tests and all package verifications passing. Every reference label, prior result and review packet is intact. Existing allowed review/results remain v13 evidence; no v14 adjudicated FP estimate is claimed.

- **Execution blocked on actual attorney evidence (2026-10-31):** [full-scope hold audit](history/2026-10-31-human-acceptance-blocker.md) revalidates the operator-confirmed unavailable-review condition across three consecutive goal turns. Independent pre-gate implementation/evaluation/import work is ready. Missing actual 50-claim reference agreement, eight convention decisions and 30-claim allowed adjudication prevent P2/P3 acceptance and later Yeet/closeout completion. All 31 positive passes, current allowed coverage, source labels and historical results remain intact. Conversation goal execution is blocked; the retained unfinished repository initiative stays active.

- **Durable reference-review import (2026-10-31):** [report](history/2026-10-31-reference-review-import.md) checks in the previously scratch-only main/addendum validators, retaining the six-family/50-claim denominator and separate convention questions. Current immutable packets/source versions pass a read-only audit; seven new synthetic tests and all eight allowed-review controls pass. Operator-confirmed attorney unavailability remains the actual-human acceptance hold. Runtime, labels, packets and prior scores remain unchanged; no actual agreement or adjudicated FP estimate is recorded.

- **Attorney authority guard (2026-10-31):** the operator reports attorney review unavailable. [The import-boundary repair](history/2026-10-31-adjudication-authority-guard.md) suppresses adjudicated point estimates/intervals without explicit actual-attorney submission confirmation, rejects preview/non-attorney promotion and validates complete question ownership/denominators. Eight synthetic boundary tests pass. Existing review v2, all 31 positive passes, 196-set allowed coverage and every previous result/label remain intact. No human verdict or adjudicated metric is recorded; the goal remains active/incomplete.

- **Implicit dependent-limitation repair (2026-10-31):** [comparison](history/2026-10-31-implicit-dependent-comparison.md) retains **31/538** exact positives with identical per-claim scores and all 31 passes. Allowed coverage rises **2,951 → 3,108/3,184 claims**, with 196/200 sets checked and 76 input-failed claims retained. All 188 previous successful allowed reports are byte-identical. The [new blank review version](history/allowed-review-v2/index.html) keeps the same 30 sampled claims and makes all 30 readable; 111 findings/five confirmations await actual attorney judgments. No FP estimate is claimed. All previous labels, results, freezes and review packets remain intact.

- **Current allowed replay and adjudication preparation (2026-10-31):** [report](history/2026-10-31-allowed-v12-report.md) records 188/200 sets and 2,951/3,184 claims checked, with 233 input-failed claims retained. 20,807 raw findings are unadjudicated. A pre-replay random 30-claim review sample contains 28 checked/two failed claims; [blank review packet](history/allowed-review-v1/index.html) and validated import/interval machinery are ready. No false-positive estimate or human agreement is claimed. The same non-US smoke is rerun; positive 31/538 and all prior labels/results remain intact.

- **Contextual predicate repair with 29-claim retention (2026-10-31):** [comparison](history/2026-10-31-predicate-comparison.md) records **31/538 complete structures (5.76%)**, retaining all 29 baseline passes with two gains and zero losses. Edge F1 is 29.3067% (previously 29.2580%). Frozen labels, sources, scorer and all historical results remain unchanged. 449 structural mismatches and 58 input failures remain. Two new regression tests and all package verifications pass. The goal remains active and human acceptance incomplete.

- **Discourse-role repair with pass retention (2026-10-28):** [the comparison](history/2026-10-28-discourse-comparison.md) records **29/538 complete matches (5.39%)**, retaining all previous 21. Final [paired gate](history/2026-10-28-v10-retention.json) has eight gains and zero losses. Edge F1 is slightly lower at 29.26%; recall improves but precision declines. All old labels/results/scorer remain unchanged. 451 structural mismatches and 58 input failures remain; eight new regressions and all package checks pass. Full goal/human acceptance remain incomplete.


- **Next closest-match repair (2026-10-28):** [the comparison](history/2026-10-28-next-closest-comparison.md) records **21/538 strict matches (3.90%)**, retaining all previous 11, and exact typed-edge F1 **29.31%**. All labels, earlier results and the scorer remain unchanged; the intermediate 19-match source/result is preserved at 007427078c. 459 mismatches and 58 input failures remain. This is development-set remediation; human agreement and full-goal acceptance are still open.


- **Closest-match repair (2026-10-28):** [the new comparison](history/2026-10-28-closest-comparison.md) records **11/538 complete matches (2.04%)**, up from zero, and exact typed-edge F1 **25.98%**. The intermediate 10-match checkpoint, all prior results, labels and scorer remain unchanged. 469 structural mismatches and 58 input failures remain; [nearest unresolved diagnostics](history/2026-10-28-closest-remaining.json) are retained without waivers. Domain/use-cases/server verification passes. This is development-set remediation, not full-goal acceptance.


- **User-directed repair and rerun (2026-10-28):** [the comparison report](history/2026-10-28-repair-comparison.md) preserves the original and all references. Final strict recovery remains **0/538**; input failures fall **186 → 58**, undecomposed **8 → 0**, and diagnostic typed-edge F1 rises **5.70% → 21.88%**. Functional relationships and conservative ancestor links are now implemented. All three affected package verifications pass. This is a development-set comparison; attorney agreement and adjudicated FP remain pending.


- **Poor-floor stop (2026-10-28):** [the first frozen positive replay](history/2026-10-28-positive-evaluation.md) measured **0/538 strict matches**: 186 input failures, eight undecomposed claims, 344 structural mismatches. The 517 current-convention accepted claims also scored zero. The explicit GOAL/SPEC poor-floor condition now stops further implementation and publication pending a new direction. The actual attorney agreement and adjudicated FP interval remain absent; this goal is not complete. The full-corpus scorer self-comparison passes all 538 references.


- **Evaluator and non-US smoke (2026-10-28):** the strict structural scorer
  passes seven regression tests and full server verification. Its
  [pre-prediction protocol](research/EVALUATION-PROTOCOL.md) declares exact
  source-node alignment, typed-edge diagnostics, reporting groups and the full
  denominator. The first positive benchmark replay is recorded above; this earlier protocol evidence predates it. The pinned
  [IPRally smoke](history/2026-10-28-iprally-smoke.md) used one non-US mechanical
  token reconstruction and returned one tree / 61 unreviewed findings. It is
  explicitly non-gold and supplies no accuracy or false-positive estimate.


- **Read-only review tool verified (2026-10-28):** `claim_self_check` is now
  declared in the practice toolkit and served by its actual MCP handler. It
  returns full source quotes, `claim-finding` review items, candidate/evidence
  envelopes and unchecked claims without source fetching or persistence.
  Tests prove generated-item schema round-trip, document-distinct identities,
  verdict projection and real MCP dispatch. Full MCP-kit, use-case and server
  package verification passes. See
  [P3 evidence](history/2026-10-28-p3-read-tool.md). Actual attorney acceptance
  remains open while independent P3 evaluation work continues under root
  `AGENTS.md` Autonomy.


- **Pending human acceptance (2026-10-28):** all 60 reference drafts / 538 claims
  pass integrity, and independent review accepts 57 families / 517 claims.
  Three exhausted-round families retain eight explicit attorney decisions.
  Actual six-family spot-check agreement is not yet recorded. Full package
  verification passes for domain, use-cases, server and the USPTO driver.
  See the [operator gate receipt](history/2026-10-28-operator-attorney-gate.json)
  for evidence, review artifacts and the remaining P3/Yeet/closeout work.


- **Implementation baseline recorded (2026-10-28):** the exact 18 P2 source
  files are hashed in [implementation freeze](research/implementation-freeze.json)
  before positive semantic benchmark predictions. This retains the rules being
  measured while independent source labels continue. The earlier allowed-input
  coverage replay remains separately disclosed; this is not a claim that no
  allowed findings have been produced.


- **Qualified source freeze and label checkpoint (2026-10-28):** all 60
  positive source families passed independent source criticism. Failed source
  versions were retained in the exclusion history and replaced within CPC;
  selection did not use checker output. See
  [source freeze](research/positive-source-freeze.json) and the current
  [review snapshot](research/source-audit-summary.json). Semantic drafts remain
  under bounded review. A source-grounded term/connecting-text convention was
  clarified independently of production rules; affected references are being
  checked consistently. Eight post-round-limit representation decisions (one connective and seven
  lexical heads) are reserved for actual attorney review. The
  [self-contained review packet](history/attorney-review/index.html) now
  contains the frozen six-family, 50-claim spot-check and those seven
  questions, with version-bound export and no prefilled verdicts. A separate
  [one-question addendum](history/attorney-review/addendum.html) retains the
  subsequently identified `each edge` head question without changing the
  original review or agreement denominator. No human agreement or accuracy/FP result is claimed.

- **Historical initial corpus audit (2026-10-28; superseded by source freeze):** all 60 source
  proposals were audited by extractors: 39 eligible proposals (359 selected
  claims), 18 unresolved and 3 ineligible at that checkpoint. Independent source
  review and replacements subsequently qualified all 60 active families.
  Earlier labels copied parser heuristics into references, so 14 family drafts
  are preserved as auxiliary conformance evidence and excluded from semantic
  accuracy. Fresh source-grounded labeling uses
  [semantic-reference/v2](research/LABEL-PROTOCOL.md). The native vertical slice
  remains a tested contract fixture; semantic-reference acceptance is separate.
  The frozen allowed sample contains 200 sets / 3,184 source claims. Latest
  full server package verification passes audit and docgen. No attorney
  agreement, semantic accuracy or false-positive estimate is complete.

- **First slice and source collection:** the final claim-1 tree was accepted
  by independent extractor and critic in two bounded rounds; the public
  replay test checks strict structural equality and both the examiner's
  missing-antecedent phrase and an unsupported possessive span. All four
  full package verifications pass. The expanded source acquisition retrieved
  286 native grant claim sets / 3,960 claims; scope screening, stratification
  and adjudication are still pending, so these are not clean negatives.

- **Native live pipeline (2026-10-28):** `US20200109732A1` produced
  16 normalized claims and 16 trees, no undecomposed claims, and 191 advisory
  findings. Claim 1 includes `missing-antecedent` for the examiner-quoted
  `the foot` at `[356, 364)`. Structural gold review and attorney sampling
  remain separate acceptance gates.

- **Access restored (2026-10-28):** after the operator updated the existing
  secret, both status-only ODP probes returned HTTP 200. The live listing for
  public application `16123456` supplies PDF then XML options for claims and
  the non-final office action. Real parsing and provenance remain to be verified.

- **2026-10-28 resumption:** authenticated USPTO application and document-list
  probes both returned HTTP 403. The XML-option selection repair is implemented
  locally with synthetic regression coverage; this does not satisfy the real
  rejection slice or labelled corpus. See
  [resumption evidence](history/2026-10-28-resumption.md).


- **P0:** `values/ClaimElement/` in `@beep/law-practice-domain`, in four files: `ClaimElement.model.ts`,
  `ClaimElement.edge.model.ts`, `ClaimElement.tree.model.ts` (with coherence checks) and
  `AntecedentFinding.model.ts` (each finding carries its `chain`; candidates are distinct). Tests
  are in `test/ClaimElement.test.ts`.
- **P1:**
  - The `ClaimElementDecomposer` and `AntecedentPolicy` function types.
  - The `ClaimSelfCheck` `Context.Service` (`check`, `checkPublished`, `candidates`), with
    per-claim `undecomposed` failures.
  - The `UsptoClaims` port and the `UsptoClaimsError` / `ClaimSelfCheckError` split.
  - Independent review found 2 P1 and 7 P2 issues. All are applied or recorded in the SPEC
    Decision Log.
  - `package-verify` passes for `@beep/law-practice-domain` and `@beep/law-practice-use-cases`.
    The repo-wide docgen run is left to hosted Docgen on the publish PR.
- **P2a:**
  - `decomposeClaim` and `antecedentPolicy`, following `research/P2-DESIGN.md`. Deviations and
    known limits are in its "P2a as built" section.
  - 22 synthetic rule fixtures, plus failure fixtures, a participle regression test and a
    determinism property test.
- **P2b:**
  - `ClaimSelfCheckLive` (`check`, `checkPublished`, `candidates` with term evidence).
  - `UsptoClaimsLive`, which reads the latest `CLM` document's XML claims, tested over a recorded
    synthetic fixture.
  - Shared claim and term evidence helpers.

## Notes

- Binding order: schema, then `Context.Service` contract, then implementation.
- Findings are advisory. Nothing blocks a draft.
- Fixtures are public USPTO record only. NC-licensed data stays outside the
  repo.
- If the deterministic floor measures badly, the goal stops at the measurement.
