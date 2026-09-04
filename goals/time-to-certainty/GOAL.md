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

Status (2026-09-03): P0 complete. `research/baseline.md` is ratified (ruling 8: M1 P50 43.3 min /
P95 3.95 h; pre-push wave 65.9% of local wrapper time; hosted-wait 19.4%; M3/M4 unmeasurable until
journals carry fingerprints and inner lanes). `research/decisions.md` holds eighteen ratified rulings: seven on the
ProofFact schema, baseline ratification, A5 first, coverage-first migration, six from the A5
journal-facts review (terminal tags, durable inner-lane reports, ticket death, forward-compatible
eviction variant, atomic claims, stage and profile via the C1 vocabulary), and two from the A5b
compaction review (retention budget over terminal attempts only; economics left-censored from
compaction receipts). Landed: A5, A5b and A5c (journal facts complete and admission claims
crash-recoverable), A4, B1, B2, B4, C1/C2, C3 coverage and tsgo tests; B6 is complete with
protocol-disabled eviction sinks retained until exactly-once emission (PR #1005). Next: B3, A3 and
C3 lint-policy.
