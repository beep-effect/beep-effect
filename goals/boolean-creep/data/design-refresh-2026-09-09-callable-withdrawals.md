# Round 26 callable-value withdrawals

Source: `7440cb8c4302ce64b87860069a464bafbf65f576`; packages/apps corpus main:
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

The twelve records audited in
[`design-refresh-2026-09-09-callable-eligibility.md`](./design-refresh-2026-09-09-callable-eligibility.md)
are withdrawn from the active census. Their named members are callable
predicates, with no corresponding sibling Boolean value carrier. This corrects
eligibility; it does not assert that every mathematical combination of their
return values is possible.

The same correction applies to
`r3-domains-legal-position-opposition-facts`. In
`packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts`,
`overlapsOnEveryAxis` is a function declared at line 90 and
`isPrimaFacieOpposed` is a function declared at line 114. `candidateFor` calls
both inline at line 137 and returns an `Option<LegalOppositionCandidateInput>`.
It never binds, stores, or returns the two Boolean results together. The old
D1 row conflated the two callable policies with a two-member state carrier.

All thirteen original rows are preserved unchanged in
[`2026-09-09-r26-callable-value-withdrawals.jsonl`](../history/inventory/2026-09-09-r26-callable-value-withdrawals.jsonl).
No qualified record or product code changes in this correction. The canonical
inventory becomes 928 records: 159 qualified and 769 disqualified, comprising
602 D1 and 167 D2 records. The qualified set remains 125 Tier 1 and 34 Tier 2,
with 123 designed and 36 historically reviewed cases awaiting replacement P3
review.
