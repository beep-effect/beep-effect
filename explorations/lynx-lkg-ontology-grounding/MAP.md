# Map — Lynx LKG Ontology Grounding

Status: OPERATOR-RATIFIED 2026-08-13; lead goal graduated.

## Candidate Goal

| Order | Slug | Mission | Depends on | Capability boundary |
| --- | --- | --- | --- | --- |
| 1 | [`attributed-multi-claim-span`](../../goals/attributed-multi-claim-span/README.md) | Ship attributed, supersedable multi-claim annotations over the TextAnchor/EvidenceSpan seam and prove the LangExtract-to-ClaimGate loop. | Existing verified-anchor, EvidenceSpan, LangExtract, and ClaimGate contracts. | Reuse `packages/foundation/modeling/provenance/src/TextAnchor.ts`, `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`, and the current ClaimGate service. NET-NEW: per-claim attribution/supersession annotation shape. |

## Gated Re-entry

| Candidate | Gate | Scope |
| --- | --- | --- |
| `schema-shacl-projection` (not yet created) | Semantic-foundation M4. | Generate bounded SHACL from the post-M4 schema contract; Lynx's contradictory published shapes are rationale/fixtures, not source truth. |
| `multilingual-concept-language-discipline` (not yet created) | A multilingual competency question and real consumer. | Shape language maps/one-value-per-language discipline and validate relevant licenses. |

`lkg.ttl` is not a separate goal here. Its vetted artifact is consumed by the
now-created `folio-lynx-taxonomy-browse` goal, while this packet owns the Lynx
license and vetting record. The ELI donor profile remains a research asset for
`legal-rule-time-identity` (not yet created).

## Sequencing

Operator sign-off covered the BRIEF and MAP, and the attributed-span goal
graduated on 2026-08-13. SHACL and language candidates remain dormant until
their named gates fire, at which point this packet reopens at `decompose`.

## First Vertical Slice

Attach two independently attributed claims to one verified TextAnchor span,
send both through the existing ClaimGate seam, and prove that confidence,
provenance, disposition, and supersession remain claim-specific. Include one
lexicog competency question in the fixture/design record.

## Inherited Risks

- Annotation records must not become a second claim authority.
- No unlicensed file adoption.
- M4 and multilingual gates are hard boundaries, not sequencing suggestions.
