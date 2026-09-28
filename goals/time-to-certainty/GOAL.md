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
Sub-agents follow the AGENTS.md volume pools (Opus 5.5 by default); the orchestrator writes
schemas and contracts and judges evidence. Record friction receipts in
`research/OPPORTUNITIES.md` at the moment they happen, redacted for a public repo. Update PLAN
checkmarks as items land; the status flip and closeout reflection ride the final PR.

Status (2026-09-28): `paused`. P0, P1 and P3 complete; P2 complete except C4.2 enforcement;
the P4 A1 close re-run landed as `research/economics-close.md`. `research/decisions.md` holds
eighty rulings (1-80). Round 25 moved the proof ledger to the owning clone (71), made a red run's
digest observable (72), and set C4.2's flip condition (80). Resume when
`bun run beep yeet proof-report --since <round-25 merge instant>` in the owning clone reads ready
with zero malformed rows, every C5 fixture is green, and the ruling-69 root-input gap is closed.
That flip PR turns reuse on, deletes the legacy lane-proof store, re-runs
`economics.py --run close`, and carries the status flip and closeout reflection. B9 lives in
`explorations/github-merge-queue`, gated on E8.
