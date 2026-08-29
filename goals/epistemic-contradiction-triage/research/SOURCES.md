# Epistemic Contradiction Triage — Sources & Provenance

Provenance ledger stub, seeded at graduate (2026-07-25). Links, not copies: the
source exploration's ledger stays primary, and the implementation-relevant
corpus is reproduced here only when P0 actually consumes it.

- **Source exploration:** `explorations/agent-memory-tiers-bitemporal-edges` —
  primary ledger:
  [`research/SOURCES.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md).
- **Substrate packet:**
  [`goals/epistemic-bitemporal-edge-core`](../../epistemic-bitemporal-edge-core/README.md)
  and its ledger
  [`research/SOURCES.md`](../../epistemic-bitemporal-edge-core/research/SOURCES.md)
  (Graphiti Apache-2.0 donor duties already discharged there; this packet adds
  no donor dependency).

## 1. Contract sources

| Source | What it fixes for this packet | Location |
| --- | --- | --- |
| Deferred spike B — contradiction-triage fixtures (2026-07-14) | The five P0 hard-gate assertions and the "detection alone never changes authoritative validity" acceptance sentence | [`explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md) |
| MAP order-2 row | Mission one-liner, dependency on the finalized core, and the P0 gate boundary | [`explorations/agent-memory-tiers-bitemporal-edges/MAP.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/MAP.md) |
| P0→P1 handoff, item 3 | Claim disposition remains claim-admission state; triage resolves the naming conflict with its own `ContradictionDispositionStatus` instead of widening that vocabulary | [`goals/epistemic-bitemporal-edge-core/ops/handoffs/p0-to-p1-handoff.md`](../../epistemic-bitemporal-edge-core/ops/handoffs/p0-to-p1-handoff.md) |
| Core reflection (2026-07-25) | The named head-disambiguation-over-supersession fixture this packet owes | [`goals/epistemic-bitemporal-edge-core/history/reflections/2026-07-25-claude.md`](../../epistemic-bitemporal-edge-core/history/reflections/2026-07-25-claude.md) |

## 2. Evidence inputs (unconsumed dispatch note)

[`goals/epistemic-bitemporal-edge-core/research/2026-07-25-academia-corpus-mining-note.md`](../../epistemic-bitemporal-edge-core/research/2026-07-25-academia-corpus-mining-note.md)
— a bounded dispatch note from the parked
[`academia-corpus-mining`](../../../explorations/academia-corpus-mining/README.md)
packet. It proposes, never amends, a target's SPEC.

Three of its seven boundary-fixture candidates fold into this packet's P0
(competing lineages, revision ordering, restart boundary). The other four
(interpretation/adoption, qualifier-complete assessment,
correction/dependent-invalidation, policy/model-trust revision) are recorded
evidence inputs only; they graduate with the packets that own those records. The
note also carries the master align Q1 context on keeping typed verdict families
separate, and master align Q3 (retention), which stays open and out of scope
here.

## 3. Upstream repositories & licenses

None new. This packet composes existing `@beep/*` bricks and the substrate
packet's already-discharged donor duties; it introduces no donor runtime
dependency and copies no upstream code.

## 4. In-repo capability references

To be completed during P0 with exact `file:line` citations. Expected shape,
from the exploration's capability check:

| Capability | Package | Expected disposition |
| --- | --- | --- |
| Logical edge identity, symmetric-endpoint ordering, bounded endpoints | `packages/epistemic/domain` | reuse — no second symmetric-encoding scheme |
| `ClaimDisposition` / `ClaimDispositionStatus` | `packages/epistemic/domain` | reuse unchanged; add slice-local contradiction disposition |
| Atomic close-and-insert supersession, typed conflict mapping | `packages/epistemic/server` | reuse through the existing repository path |
| Candidate entities, tables, ports, approval command | `packages/epistemic/{domain,tables,use-cases,server}` | NET-NEW, additive only |
| Migration registration + PGlite proof lane | `packages/_internal/db-admin` | reuse/extend |

## 5. Cross-links

- Exploration: [`README`](../../../explorations/agent-memory-tiers-bitemporal-edges/README.md) · [`MAP`](../../../explorations/agent-memory-tiers-bitemporal-edges/MAP.md) · [`DECISIONS`](../../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md) · [`primary ledger`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md)
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
- Sibling composition over the same core:
  [`explorations/epistemic-belief-view-revision`](../../../explorations/epistemic-belief-view-revision/README.md)
  (belief views select among open lineages; triage resolves them).
- Still-queued sibling from the same map: `epistemic-memory-retention-projections`
  (owns retention/tier/decay; master align Q3).
