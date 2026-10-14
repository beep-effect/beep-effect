# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `claim-element-antecedent-check` (promised now) | A span-anchored claim-element tree, a pure decomposer, and an advisory §112(b) antecedent and dependency checker. Findings reach the attorney through the review queue. Measured on public USPTO claims. | `review-verdict-envelope` P1 (`ReviewItem` / `VerdictRow` schema) for P3 only | `@beep/law-practice-domain` `PatentClaim`, `PatentDocument.normalizer`, `PatentClaimDependencyIssue` pattern; `@beep/provenance` `TextAnchor`; `@beep/epistemic-domain` `CandidateClaim`, `ClaimDisposition`; `@beep/law-practice-use-cases` `PatentClaimCandidate`; `@beep/uspto` `getDocuments` / `downloadDocument`; element schema, decomposer, checker, USPTO claims adapter, strict graph metric are NET-NEW |
| Gated: drafting support set | Feed ordered limitations into `goals/patent-drafting-episode-ledger`'s `ClaimLimitationSupportSet` | Gate: `claim-element-antecedent-check` P2 lands **and** the drafting ledger resumes | drafting ledger SPEC |
| Gated: OA element mapping | A per-element Disclosed / Not / Partially record with a pinpoint `TextAnchor` per cited passage (FiNE/ToC shape) | Gate: the element tree is stable **and** examiner pinpoint parsing exists; coordinate with `goals/oa-evidence-consumer-conformance` | `Rejection`, `Distinction` |
| Gated: `missing_limitation` element reference | `Distinction.missing_limitation` points at an element instead of free text | Gate: elements exist for office-action claims | `DistinctionDetail` |
| Gated: LLM decomposition | An LLM proposes extra candidate elements through a driver port | Gate: the deterministic floor is measured and a gap class is named | epistemic candidate lifecycle |
| Gated: IPRally interop | An adapter to and from invention-graph JSON | Gate: a consumer needs their data beyond the smoke test | `iprally/invention_graph_eval` (MIT) |
| Gated: Markush / chemistry | Typed alternatives and chemistry | Gate: the practice takes chemical or pharma matters | — |

## Sequencing

`claim-element-antecedent-check` comes first; every other row is gated. Inside the goal:
1. P0 schema (`values/ClaimElement/`).
2. P1 the `ClaimSelfCheck` `Context.Service` contract.
3. P2 the deterministic decomposer and checker, the USPTO claims adapter, and the labelled set
   (about 60 families plus about 200 allowed sets).
4. P3 findings as `claim-finding` ReviewItems, plus the evaluation. P3 waits for
   `review-verdict-envelope` P1.

## First Vertical Slice

One public US claim family with a known §112(b) antecedent rejection travels from the USPTO adapter
through `PatentClaim` normalization to a `ClaimElementTree`. The checker emits a
`missing-antecedent` finding whose spans match the examiner's recited phrase. A strict-equality
test compares the tree against its hand-labelled fixture.

## Open Risks Inherited From The Brief

- USPTO claim text may be PDF-only; prefer XML and exclude OCR-only claims.
- Allowed claims are weak negatives; adjudicate a sample before counting false positives.
- Determiner edge cases are handled as one rule per fixture, with a `pattern-not-covered` fallback.
- Antecedents resolve only through the dependency chain, and each chain of a multiple-dependent
  claim must resolve.
- P3 depends on `review-verdict-envelope` P1.
