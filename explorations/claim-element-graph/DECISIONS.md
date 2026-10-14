# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-14 — element-placement

**Question:** Should claim elements live inside `PatentClaim`, or in a sibling projection?

**Answer:** In a separate `ClaimElementTree` value in `@beep/law-practice-domain`, keyed by
`claimNumber`, with every element carrying a `TextAnchor` span. `PatentClaim` stays unchanged.
Pure decomposition and checking live in role files next to the value (`.behavior.ts` for
transformations, `.policy.ts` for decision rules), following
`standards/architecture/04-rich-domain-model.md` and the existing
`PatentDocument.normalizer.ts` precedent. Extracted elements enter the epistemic layer as
candidates.

**Rationale:** The completed `patent-document-schema` keeps a stable public shape, and elements
get their own lifecycle. Rejected:
- an optional `elements` field on `PatentClaim`, which couples every claim decode to element
  extraction and changes a completed schema;
- a `shared/*` promotion now, which fails the promotion gate because only law-practice consumes
  elements.

## 2026-10-14 — extraction-order

**Question:** Deterministic-first or LLM-first decomposition?

**Answer:** Deterministic first. Pure domain rules carry the floor:
- punctuation and transition words;
- `<claim-text>` nesting when the source is XML;
- `a/an` introducing a term and `the/said` referring back to it, per FLAN-Graph, PHAGE and the
  2012 FSM paper.

An LLM pass comes later as a use-case behind a driver port. It only proposes candidate elements,
which never become facts without passing the epistemic lifecycle.

**Rationale:** ACE, PANORAMA and PEDANTIC all locate failures in structure and in category
assignment, not in surface parsing. Deterministic output is reproducible and free per claim.
Rejected:
- LLM-first with rule validation: non-reproducible, and pays a model call on every claim;
- deterministic-only: misses implicit elements and functional relations.

## 2026-10-14 — primary-metric

**Question:** What is the primary quality metric for an extracted element graph?

**Answer:** Strict structural equality under one consistent node mapping, with typed edges and
exact spans. IPRally-style teacher-agreement IoU is reported only when comparing with their
released data.

**Rationale:** MarkushGlyph (2607.28532) shows that lenient per-feature scoring accepts outputs
that strict equality rejects: 541 of 566 disagreements. IPRally's IoU ignores edge type and
measures agreement with its teacher parser, not correctness. Rejected:
- typed-edge F1 as primary: its partial credit hides near-miss graphs, though it may be reported
  as a diagnostic;
- IoU as primary.

## 2026-10-14 — first-consumer

**Question:** Which consumer does the first graduated goal serve?

**Answer:** A deterministic §112(b) antecedent-basis and dependency self-check on the practice's
own drafts. It produces typed diagnostics, built the same way as `PatentClaimDependencyIssue`.

**Rationale:**
- It has immediate value to the attorney and needs no external data or examiner pinpoint parsing.
- It targets the miss class ACE measured: 38 of 69 missed cases (55.1%) were cross-claim or nested
  antecedent chains.
- It exercises the element tree end to end.

Deferred to later goals, in rough order: the drafting ledger's `ClaimLimitationSupportSet`
(unblocks its paused P0); the per-element office-action mapping record; and pointing
`Distinction.missing_limitation` at an element.

## 2026-10-14 — nc-licensed-data

**Question:** May NC-licensed datasets (PANORAMA CC BY-NC 4.0, PatClaimEval) be used for
evaluation?

**Answer:** Internal evaluation only. They stay in the external research library and are never
committed to this public repo, shipped, or redistributed. The repo records only derived metrics
and stable source IDs.

**Rationale:** PANORAMA is the only large, expert-validated US per-claim office-action set.
Excluding it would leave US office-action evaluation to our own labelling. Rejected: excluding NC
data entirely.

## 2026-10-14 — markush-scope

**Question:** Are chemical and Markush claims in scope for the first slice?

**Answer:** Deferred. The first slice covers mechanical, electrical and software claims. Only the
strict-metric lesson from MarkushGlyph is kept. Reopen if the practice takes chemical or pharma
matters.

**Rationale:** The practice's current work does not need it. R-GroundBench (2610.00700) shows
general LLMs fail R-group instantiation, so the cost is large. Rejected: a typed Markush
alternatives node now, and full chemistry.

## 2026-10-14 — labelled-set-source

**Question:** Where does the labelled US claim set come from? It is needed to measure how much the
deterministic rules recover and the checker's false-positive rate on allowed claims, which no
paper measures.

**Answer:** Public USPTO claims. Published applications and granted patents are fetched through
the existing `@beep/uspto` driver (`getDocuments` / `downloadDocument`) and stratified across CPC
sections. Positives are claims that drew real §112(b) rejections; negatives are allowed claims.
Because they are public record, the fixtures may be committed.

**Rationale:** Public material keeps client data out of the public repo, and the driver already
exists. Rejected:
- adding the practice's own published filings now (possible later through the corpus pipeline);
- PEDANTIC/ACE alone: PEDANTIC covers G06F40 only and has no allowed-claim negatives, and ACE has
  not released its data.

## 2026-10-14 — labelled-set-size

**Question:** How large is the first labelled set?

**Answer:**
- About 60 independent-claim families (~500 claims) labelled to element level, to measure the
  deterministic floor.
- About 200 allowed patents' claim sets (~3,000 claims) scanned for checker false positives.

**Rationale:** About 3,000 negative claims pin a ~1% false-positive rate to roughly ±0.4%, and 60
families give a usable per-rule floor. Rejected: a 20-family pilot first (slower to a usable
number) and 500 families (labelling cost before the schema is exercised).

## 2026-10-14 — labeller

**Question:** Who labels the element trees?

**Answer:** An extractor/critic agent loop with a bounded number of rounds and a confidence
threshold. Anything unresolved is flagged for review. The attorney spot-checks about 10% of the
labels.

**Rationale:** This follows the 2026-10-06 docket-intake ruling, which found two-agent review
insufficient and required a bounded loop with attorney escalation. Rejected: attorney labels
everything (expensive hours) and agents only (would measure agreement between models, not
correctness).

## 2026-10-14 — finding-severity

**Question:** How do antecedent-basis findings reach the attorney?

**Answer:** As advisory typed diagnostics. Each carries its span and the rule that fired, and none
blocks a draft. The attorney confirms or dismisses each finding, and those verdicts become the
labelled false-positive data.

**Rationale:** The checker's false-positive rate is unknown until measured. Advisory output gives
the attorney value now and produces the measurement data. Rejected: a blocking gate (unsafe
before false positives are measured) and silent logging (no attorney value).

## 2026-10-14 — finding-surface

**Question:** Where does the attorney run the antecedent self-check and see its findings?

**Answer:** A new tool in the existing practice MCP toolkit
(`packages/law-practice/use-cases/src/PracticeKg.tools.ts`, alongside `KgCandidateClaimsTool`),
used from Claude Code on the attorney's PC. Findings come back in plain lawyer language with the
claim text quoted, following the 2026-10-09 lawyer-facing defaults.

**Rationale:** The attorney already works in Claude Code with these tools. Rejected: a
per-draft review page (more surface before the first useful finding) and a `beep` CLI command
(the attorney will not use it, so no verdict data would arrive).

## 2026-10-14 — verdict-storage

**Question:** Where are the attorney's confirm and dismiss decisions stored?

**Answer:** In the epistemic lifecycle. Each finding is a `CandidateClaim`. A decision is a
`ClaimDisposition` (`packages/epistemic/domain/src/entities/ClaimDisposition/`) whose `status`
is one of `active`, `rejected` or `superseded`, with `reason`, `resolvedBy` (a `Principal`) and
`resolvedAt`:
- Confirm: `status: active`, resolved by the attorney.
- Dismiss: `status: rejected`, with the attorney's reason.

Dismissed findings form the false-positive set.

**Rationale:** The machinery already exists, so no shared-kernel change is needed: `ClaimLifecycle`
stays `candidate → shape_valid → consistency_checked → admitted`. Rejected: a separate
law-practice verdict table, which would duplicate the disposition entity.

## 2026-10-14 — first-slice-inputs

**Question:** Which inputs must the first slice accept?

**Answer:** Normalized `PatentClaim` values. Drafts arrive through the existing Markdown and
document pipeline (`PatentDocument.normalizer.ts`). Public USPTO claims get one adapter from
`@beep/uspto` documents into `PatentClaim`, which the labelled set needs anyway.

**Rationale:** The decomposer stays independent of document format. Rejected: parsing DOCX
directly in this slice, which would duplicate the document pipeline
(`explorations/docx-roundtrip-interop` is graduated and owns that path).

## 2026-10-14 — iprally-interop

**Question:** What do we do with IPRally's invention-graph format?

**Answer:** It becomes a later re-entry point in `MAP.md`, with no adapter in the first slice.
Their 5,000-document training sample, which has typed labels, serves only as a non-US robustness
smoke test for the deterministic rules.

**Rationale:** Their JSON drops edge types, so an adapter would lose information. Their data is
mostly CN/JP claims and labelled by their teacher parser, not gold. Rejected: an adapter in the
first slice, and ignoring their data entirely.

## 2026-10-14 — shape-review

**Question:** Does `BRIEF.md` match the operator's picture, and how does verdict capture work now
that the practice MCP is read-only?

**Answer:** Yes. Findings leave the practice MCP read tool as `claim-finding` `ReviewItem`s. The
attorney judges them in the `practice-claude-mod` review queue. Verdicts are `VerdictRow`s that the
`review-verdict-envelope` projector maps to `ClaimDisposition`. The `finding-surface` decision stands
for computing findings; the queue is where they are rendered and judged.

**Rationale:** This was decided in
[attorney-review-workspace](../attorney-review-workspace/DECISIONS.md) (verdict-envelope, handoff).
It keeps the practice MCP read-only and gives every producer one review surface. Rejected: a new
narrow MCP write tool, and a separate review page.

## 2026-10-14 — graduation-shape

**Question:** One goal or two?

**Answer:** One goal, `claim-element-antecedent-check`, phased:
- P0 schema;
- P1 service contract;
- P2 deterministic implementation plus the USPTO adapter;
- P3 review items plus evaluation, which is the acceptance gate.

**Rationale:** Schema changes in P0 would churn a parallel evaluation goal. Rejected: two parallel
goals.
