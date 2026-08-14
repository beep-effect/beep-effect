# Epistemic Memory Retention Projections Spec

## Objective

Accepted bitemporal authority records can be projected into a standalone
operator tier/memory-pressure report with as-of and disposition-aware views,
deleted completely, and rebuilt identically. Tier, decay, and threshold policy
is schema-validated data and cannot become active without calibration evidence.

## Non-Goals

- Mutation, expiry, deletion, or reclassification of authoritative facts.
- External graph or memory vendors in the authority path.
- Agentmemory code or constants; it is citation-only reference material.
- RRF arithmetic or integration in the first slice.
- Product/operator memory coupling or use of product tables as dev memory.
- Semantic extraction, contradiction detection, or IP-law vocabulary.

## Source Hierarchy

1. The 2026-08-13 ceremony request.
2. Repo instructions and required skills.
3. [`DECISIONS.md`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md),
   [`BRIEF.md`](../../explorations/agent-memory-tiers-bitemporal-edges/BRIEF.md),
   and [`MAP.md`](../../explorations/agent-memory-tiers-bitemporal-edges/MAP.md).
4. This SPEC, PLAN, then GOAL.

## Target Surfaces

- Epistemic domain/use-case/server projection contracts
- Rebuildable projection storage/reporting selected in P0
- Schema-validated retention policy data and calibration receipts
- Focused as-of/disposition/delete-and-rebuild fixtures

## Constraints

- Postgres bitemporal records remain sole durable truth.
- Projection outputs are disposable and derived only from accepted authority.
- Mechanism ships now; policy values remain inert behind an explicit
  calibration-evidence phase gate.
- The algorithm is repo-native. Agentmemory may be cited for comparison only.
- Views must accept valid/known as-of coordinates and show dispositions.
- Delete-and-rebuild must be deterministic and leave authority untouched.
- RRF weights wait for `hybrid-retrieval-fusion-core`; that goal owns math.

## Acceptance Criteria

- [ ] A standalone operator report shows tier and memory-pressure summaries.
- [ ] Report rows can be queried as-of and filtered/grouped by disposition.
- [ ] Policy data validates through schemas and cannot activate before the
      recorded calibration gate passes.
- [ ] Deleting every projection artifact and rebuilding produces identical
      canonical output.
- [ ] Authority rows are unchanged by report generation or rebuild.
- [ ] Agentmemory is cited as reference-only and no donor code/constants land.

## First Vertical Slice

Generate the operator tier/memory-pressure report from a fixed accepted-edge
fixture, exercise two as-of coordinates and dispositions, delete its projection
store/output, rebuild, and compare canonical bytes and query answers.

## Decision Log

| Date | Decision |
| --- | --- |
| 2026-08-13 | Spin the optional lane now: mechanism now, policy-as-data behind calibration evidence, repo-native algorithm, agentmemory cite-only. |
| 2026-08-13 | First slice is the standalone operator report plus delete/rebuild drill; RRF weights are a later integration. |
| Program | Product Postgres authority is immutable from this projection; retrieval consumers do not own truth. |

## Stop Conditions

- The mechanism requires mutating authoritative facts.
- Policy would become active without calibration evidence.
- RRF work would need to land before its owning goal is ready.
- A donor algorithm cannot be reproduced without impermissible code reuse.
