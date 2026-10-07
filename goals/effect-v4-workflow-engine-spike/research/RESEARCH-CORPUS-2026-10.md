# Workflow boundary evidence — research corpus attachment

Date: 2026-10-06. Derived evidence note; existing SPEC, lifecycle, owners and phase gates remain authoritative.

The active packet remains at P0 feasibility; its latest implementation evidence is still not started. The retained tool-boundary anomaly catalogue is a coverage aid for the existing fourteen normative constraints, not a second workflow runtime or evidence-approval engine. Effect interruption/teardown changes do not establish rollback of an external write. A tool request, observed acknowledgment and durable workflow outcome are separate facts.

## Anomaly-to-P0 proof map

Constraint numbers below refer to the unchanged `SPEC.md` P0 checklist. These are proposed test obligations, not passed proofs.

| Retained anomaly | Existing constraints | Evidence to lock in P0; present gap |
| --- | --- | --- |
| A1 Duplicated effect | 1–4, 9–11 | Kill after external effect before durable acknowledgment, resume/reissue with retained logical key; count physical effects. Deterministic replay alone is not idempotency. |
| A2 Missing committed effect | 4–5, 8–10, 14 | Lose acknowledgment without effect; require authoritative reconciliation or explicit unknown outcome before cursor/terminal success. Never infer success from request acceptance. |
| A3 Orphaned compensation | 3–4, 9–10, 13 | Unknown outcome cannot authorize blind compensating mutation. Retain action-time uncertainty and bound reconciliation ownership. |
| A4 Uncompensated residue | 1, 4, 9–10, 13 | Cancel/kill after visible effect; observe surviving effect and actual compensation limits. Finalizers or graceful teardown do not prove neutralization. |
| A5 Premature externalization | 4–5, 9, 13–14 | Trace approval/state resolution before irreversible effect. Name compensation-safe versus staged/approval-gated profile; engine persistence is not human approval. |
| A6 Contaminated speculation | 4–5, 9, 12–13 | Synthetic concurrent branches: surviving result must not silently depend on canceled branch's temporary effect. Record dependency limitation if engine has no such contract. |
| A7 Conflicting externalization | 2–3, 9, 11–13 | Competing workers over one resource; prove lease/version/ordering boundary or explicit unsupported external mediation. |
| A8 Phantom compensation | 4, 9, 13 | Compensated managed effect may leave an unobserved third-party reaction. Bound open-world visibility; no claim of universal rollback. |

Constraints6–7 additionally preserve clock recovery versus legal-calendar meaning; constraint8 requires fresh-process discovery; constraint14 covers duplicate/late deferred acknowledgment and consistent terminal observation. The anomaly rows supplement rather than replace their proofs. The catalogue is a coverage conjecture and its tool census did not execute tools; planning, security and liveness are outside its completeness claim.

## Owner intake and next evidence

Attach this map to the P0 fourteen-row parity matrix. The existing owner chooses store, exact controlled kill points, negative/control lanes and unsupported limits before P1. One synthetic trace is needed for each uncovered row, within the representative workflow scope; a gap produces a bounded handoff, not a bespoke checkpoint layer. Docketing adoption still depends on actual persistence-backed kill/restart proof and its legal-calendar/approval consumer owners. No adapter or experiment has been started by this attachment.

## Async coordination receipt

2026-10-06: attached by the research-corpus-synthesis lane for asynchronous owner review. Packet current state was reread; the previously checked session ledger had no matching active named owner row. No owner acknowledgment or consent is asserted. This visible packet attachment and manifest research link are the handoff; any new execution must enter the existing owner intake and preserve current phase/dependency gates. Parent reconciliation may narrow the route.

## Source-bound reading references

The finding rows below retain source/capture/artifact hashes, inspected locators and limitations. Report assertions remain distinct from primary evidence; selected reading is not an independent replication. Originals remain in the external library and are not copied into this public packet.

- [R0-007](../../../explorations/research-corpus-synthesis/research/readings/parent/findings.jsonl): Effect streaming tool interruption and cluster teardown changes do not establish rollback of an external effect.
- [R0-010](../../../explorations/research-corpus-synthesis/research/readings/parent/findings.jsonl): A successful tool request and a durable workflow outcome are different facts; recovery needs explicit unknown outcomes and observed boundaries.
- [R1-245](../../../explorations/research-corpus-synthesis/research/readings/reading-1/findings.jsonl): The requested workflow durability experiment already has an active feasibility packet with no started evidence; publication or compilation cannot establish process-kill recovery.
- [R3-005](../../../explorations/research-corpus-synthesis/research/readings/reading-3/findings.jsonl): Separate durable workflow orchestration from evidence approval; validate restart behavior before deadline adoption.
