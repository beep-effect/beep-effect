# time-to-certainty

Lifecycle: `active`

Created 2026-09-03 · Anchor: [SPEC.md](SPEC.md) · Order: [PLAN.md](PLAN.md)

Make the fleet's verification proof cheaper by removing redundant lane executions, false-positive
gate round-trips, and silent process deaths, and prove it on one number: the fleet-aggregated
P50/P95 time-to-certainty per verification episode. Successor to the completed-retained
[ship-velocity](../ship-velocity/README.md) packet, whose final closeout episode is the motivating
receipt: about 85 minutes of local proof for a 12-file change on an idle machine, the coverage lane
run three times, two full proof rounds lost to false-positive gates.

Workstreams: **A Measure** (economics report, ratified baseline, yeet surface, precision-bearing ack
ledger) · **B Hygiene** (six named false-red and cord-severing classes, one small PR each) ·
**C Proof reuse** (ProofFact keyed by lane input digest and epoch, ProofLedger service, shadow then
enforced) · **D Ordering** (cheapest-precise-first wave order handed to the ontology packet's planner
seam).

The KPI's formal definition and the eventual planner belong to the
[beep-ci-operational-ontology](../../explorations/beep-ci-operational-ontology/README.md)
exploration; this packet moves the operational proxies and feeds that packet's next corpus capture.
Evidence and receipts live under [research/](research/).
