# Goal: time-to-certainty

Make the fleet's verification proof cheaper by removing redundant work, false-positive gate
round-trips, and silent process deaths, measured first. Read `goals/time-to-certainty/SPEC.md`
(metric, workstreams, acceptance) and `goals/time-to-certainty/PLAN.md` (order), then implement the
next unfinished item. Evidence lives in `goals/time-to-certainty/research/`.

The single number is the fleet-aggregated P50/P95 time-to-certainty per verification episode. Its
formal definition belongs to the beep-ci-operational-ontology exploration; this packet moves five
operational proxies: red-to-green episode duration (M1), time-to-first-actionable-failure (M2),
redundant lane executions per change (M3), false-red round trips per gate class (M4), and
unjournaled terminations (M5).

Four workstreams:

- **A Measure**: a reproducible economics report over the attempt journals (per-lane duration and
  share, runs per attempt across tiers, first failing lane, red-to-green episodes, false-red
  proxies), a ratified baseline, the same report as a yeet surface, and an ack ledger that records
  reasons so gate precision is computable.
- **B Hygiene**: package verification through the Turbo graph so stale upstream dist never raises a
  P0; semantic-delta stops reading branch names as paths; cheap precise gates run first and fail the
  wave; the cache plan resolves only its four references; proofs run as detached durable jobs in
  their own scope; every lease and submitter death is journaled.
- **C Proof reuse**: schema first (ProofFact keyed by lane input digest, epoch, env profile), a
  ProofLedger Context.Service, declared inputs per lane, shadow mode, then enforcement between
  pre-push and merged preview gated on zero shadow disagreements; must-fail fixtures for changed
  packages, epoch changes, and cross-profile reuse.
- **D Ordering**: order the pre-push wave by cost, red probability, and precision from the A
  numbers; hand the inputs to the ontology packet's planner seam rather than building a planner.

Rules: schema-first (Effect v4, LiteralKit, S.Class); services via Context.Service; validate v4
APIs against the Effect reference checkout; the ship-velocity C5 first-cold-lane law for any
cache accounting; changed-package tasks never reuse a proof; no merge queue before the recorded
flip condition; no hosted-tier reuse without parity-ledger evidence; no new lock or scheduler.
Heavy implementation and measurement run on Codex lanes; web research runs on Grok; the
orchestrator writes schemas and contracts and judges evidence. Record friction receipts in
`research/OPPORTUNITIES.md` at the moment they happen, redacted for a public repo. Update PLAN
checkmarks as items land; the status flip and closeout reflection ride the final PR.

Status (2026-09-25): P0, P1 and P3 complete. `research/baseline.md` is ratified (ruling 8: M1 P50
43.3 min / P95 3.95 h; pre-push wave 65.9% of local wrapper time; M3/M4 unmeasurable until journals
carry fingerprints and inner lanes). `research/decisions.md` holds seventy-seven rulings (1–70 and
73–79; 71–72 reserved for the C5 grill draft), the latest C4 shadow mode (61–64), D2 review
follow-ups (65–67), the C5 tripwire (68–70), the A3 economics surface (73–75) and the D1 ordering
handoff (76–79). Landed: A3, A4, A5/A5b/A5c, B1–B6, C1/C2, C3, C4a, C4.1, C5, D1 (the pre-push order
handed to the ontology packet as `research/gate-order-handoff.json`) and D2. Next: C4.2 enforcement
once the shadow report reads ready; then the P4 A1 close re-run.
