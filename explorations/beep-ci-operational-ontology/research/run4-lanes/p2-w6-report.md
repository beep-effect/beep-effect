# P2 lane report — W6 S7-v2 seam and `planEpisode` body (2026-10-06)

Briefs: `p2-w6-seam-brief.md` (phase A) and `p2-w6-body-brief.md` (phase B) beside this report; common
rules in `p2-common-brief.md`. Rulings: graduation Ruling 11; P2 Rulings 1–7 and calls u–z in
`goals/ciops-ontology-pipeline/research/decisions.md`. Deliverables: S7 contract §8 (the amendment that
supersedes the §3.2 `planEpisode` bullet and the first §6 bullet, with the §3.1/§3.3/§3.4/§3.5/§5 notes
and the stale-prose corrections), the lab schemas (`GateOrderHandoffRef`, the widened `PlanEpisodeInput`
`{episodeId, repoRoot, handoff}`, `HandoffLane`, `GateOrderHandoffView`, `LaneScope`, `LaneOrderRule`,
`LaneStep`, `LanePlanProposal`, the three `Handoff*Error`s), `LanePlan.ts` (the pure core: subset decode,
`rankChain`, `planLanes` over `Graph.directed` with `Graph.findCycle` before `Graph.topo`), the
`planEpisode` body and `emitLanePlan` in the service, the pinned fixture
`test/fixtures/gate-order-handoff-v1.json` (sha256 `705f3e75…`, 33 lanes), the lane-plan golden
`test/fixtures/lane-plan-v1.ttl` (sha256 `58e9061ebbaa…`, 177 lines), `scripts/generate-lane-plan-golden.ts`
(`evidence:lane-plan` check-by-default), `scripts/check-lane-plan-cq.py` (the CQ-020 sibling), and
`test/lane-plan.test.ts`.

## Build protocol

Phase A (the seam): one implementer, a rulings-and-ontology lens (with the ontology-foundational-auditor
skill) and an Effect-v4 mechanics lens, one fixer, one skeptic: 24 findings, 23 fixed with regression
tests, one deferred to the orchestrator (the schema catalog, regenerated for the lab's entries only).
Phase B (the body): one implementer, the same two lenses, two fix rounds (the charter's cap) with a
skeptic after each: 8 findings in, 0 blockers or majors left in W6 after round 2.

| Stage | Lab tests | Outcome |
| --- | --- | --- |
| phase A implementer | 30 | seam + fixture + drift test |
| phase A fix / skeptic | 33 | 23 fixed, 1 deferred (catalog) |
| phase B implementer | 43 | body, emission, golden, CQ sibling |
| phase B fix 1 / skeptic 1 | 60 | 6 remaining (3 W6 minor, 3 W5-owned) |
| phase B fix 2 / skeptic 2 | 60 | 0 W6 major; 3 W6 minor follow-ups |

## Numbers (from the lab's own run)

- 33 lane steps from the decoded pinned handoff, 32 `precedesLaneStep` edges (count − 1); the step order
  equals the handoff's rank order with nodes inserted in `declarationIndex` order (the agreement check
  is not a tautology).
- Admission golden `emission-v2.ttl` unchanged (sha256 `117dc04a1470…`).
- CQ-020 sibling: `PASS: amended CQ-020 admission rows unchanged (2 rows, idx 0, 1; lane episode 0 rows);
  lane plan 33 lane steps in rank order, 32 precedesLaneStep edges (count - 1), 0 ratified ordering terms
  on 36 lane-plan nodes, 0 schedulesWorkUnit/hasScope/Scope IRIs`.
- `lane-plan.test.ts`: 21 tests, two property tests (permutation byte-determinism over the pure core at
  32 runs; codec round-trip at 64 runs); the cyclic must-fail asserts a typed `Fail` with the
  `cycleNodes` witness; the non-chain acyclic precedence self-check asserts a `Die`; the digest mismatch,
  read failure, episode-node disjointness and `LanePlanProposal.make` enforcement are each covered.

## Follow-ups (tracked, minor)

- `check-lane-plan-cq.py` §4 (ordering terms/types) has no planted-violation self-test.
- `generate-lane-plan-golden.ts` parses its mode with `A.contains(process.argv, "--write")` rather than the
  lab's `decodeEvidenceMode`.
- CT §8.1's "Transitional" bullet carries a dated note that the body landed in the same PR.
