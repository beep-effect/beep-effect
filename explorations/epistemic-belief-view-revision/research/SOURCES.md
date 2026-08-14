# Epistemic Belief View Revision — Sources & Provenance

Date: 2026-08-13

## External sources

| Source | URL | Accessed | Use |
| --- | --- | --- | --- |
| Martin Fowler, “Event Sourcing” | https://www.martinfowler.com/eaaDev/EventSourcing.html | 2026-08-13 | Complete rebuild, temporal query, replay background. |
| Datomic, “See Historic Data” | https://docs.datomic.com/peer-tutorial/see-historic-data.html | 2026-08-13 | As-of/history distinction. |
| Franz Huber, “Belief Revision I: The AGM Theory” | https://doi.org/10.1111/phc3.12048 | 2026-08-13 | Belief-revision background; reference only, no donor code. |

No upstream repository or code donor was mined. Licenses are therefore not
applicable; all three sources are reference-only.

## In-repo bricks

- `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts`
- `packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts`
- `packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts`
- `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`
- `packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts`
- `packages/epistemic/domain/src/values/EvidenceVerification/EvidenceVerification.model.ts`
- `packages/epistemic/domain/src/values/ExecutionVerdict/ExecutionVerdict.model.ts`
- `packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts`
- `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts`
- `goals/epistemic-bitemporal-edge-core/SPEC.md`
- `goals/epistemic-contradiction-triage/SPEC.md`

## Research artifacts

- [`01-live-contracts-and-drift.md`](./01-live-contracts-and-drift.md)
- [`02-verdict-family-candidates.md`](./02-verdict-family-candidates.md)
- [`03-view-composition-and-revision.md`](./03-view-composition-and-revision.md)

