# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape

The September 4 pinned synthesis is maintained in
[`research/report-source.md`](./research/report-source.md). Production
authority is Turbo `2.10.12`; the exact published `2.10.13-canary.1` is an
isolated experiment; upstream `main@SHA` is a non-scoring appendix. The
published canary and main histories currently diverge, although the targeted
Remote Cache wire code and OpenAPI are unchanged across the inspected pins.

The official OpenAPI and actual client require separate interpretation. The
client mounts the unversioned specification under `/v8`, does not use the
optional batch-query endpoint, accepts successful upload statuses beyond the
documented set, and can collapse several remote failures into task-level
misses. The conformance lab therefore reports strict OpenAPI, exact stable, and
exact canary verdicts independently and requires direct backend receipts.

The backend scan remains evidence-neutral. Beep's incumbent has the strongest
checked-in read/write and IAM split, Bruno has useful streaming/tag/OTLP
primitives, and Ducktors most closely matches the incumbent lineage. Every
option still has a hard-gate gap or missing runtime proof, so no backend is
selected. An evolved incumbent is a first-class candidate.

The installed Turborepo skill exactly matches the official upstream skill tree
at the inspected source snapshot, and the one live-main commit beyond that
snapshot does not touch it. No skill edit is needed.

## In-Repo Capability Inventory

The task and reuse-layer census is maintained in
[`research/task-census.md`](./research/task-census.md), with the
machine-readable companion at
[`research/task-census.json`](./research/task-census.json). It resolves 142
workspaces, 21 root task definitions, and 1,503 matching workspace scripts.
Turbo dry-run's 2,840 configured nodes are not executable-task evidence; it
creates nodes for missing scripts.

Current cache declarations are production posture only. All executable
computations begin unassessed per reuse layer and environment profile in
[`research/cache-qualification.json`](./research/cache-qualification.json).
The evidence gate is three fresh/fresh plus three true fresh/remote-hit pairs
per profile, independent semantic-input perturbations, portability,
concurrency, and log-safety proof, at least ten representative shadow
decisions, and zero unexplained divergence.

Five reuse/proof concepts remain distinct: Turbo task results, GitHub Actions
transport of `.turbo/cache`, Quality lane proofs, Yeet full-proof state, and
hosted required statuses. The intended ProofLedger successor remains owned by
`time-to-certainty`; current timings/ruleset/placement remain owned by
`ci-lane-economics`; KPI/planner semantics remain owned by the CI operational
ontology.

[`research/opportunity-disposition.md`](./research/opportunity-disposition.md)
reconciles historical leads with HEAD. Notable surviving issues include
configured-without-script dry hashes, swallowed auth faults, cross-root
compiler artifacts, coverage shared-path collisions, child-config identity,
and the reusable Heavy workflow's `@main` provenance boundary.

## Constraints Discovered

This research stage was read-only with respect to Turbo configuration, CI
behavior, Yeet behavior, cache writes, production infrastructure, credentials,
and backend selection. Source and local static evidence answered the research
questions, so no production probe was needed. That session stopped at
alignment. The September 8 continuation advanced to shape review with a
draft [`BRIEF.md`](./BRIEF.md) and pre-seeded [`MAP.md`](./MAP.md).

The recommended post-alignment program has four active candidates:
`turborepo-task-qualification`, `turborepo-cache-conformance`,
`turborepo-cache-trust-observability`, and
`turborepo-quality-cache-adoption`. A backend-migration goal remains
conditional on a passing frozen rubric and material-win result.

The binding architecture and current-symbol grill is recorded in
[`research/architecture-grill.md`](./research/architecture-grill.md). It
recommends existing homes for the first slice: reviewed pure policy in
`@beep/repo-configs/cache`, operational cache behavior in the repo CLI Cache
group, enforcement/rendering in Quality and CI, read-only consumption in Yeet,
and deployed adaptation in infra. A new library or driver remains conditional
on demonstrated multi-consumer pressure.

## 2026-09-08 - shaping refresh

[`refresh-2026-09-08.md`](./research/refresh-2026-09-08.md) records the current
checkout and targeted upstream checks. Stable/canary tags remain unchanged.
Upstream main has advanced and corrected dependency-only filter syntax in the
skill; that reference and the Turborepo lock entry are now synced. The API JSON
is semantically unchanged. Root dependency changes still require fresh task
experiments. Backend runtime and deployed parity remain untested.

## 2026-09-08 - graduation

The user approved the brief and map. Four implementation packets inherit this
research and its source corpus; [MAP.md](./MAP.md) defines their handoffs.
See the [graduation receipt](./research/graduation-2026-09-08.md) for readiness
and validation. Graduation does not turn source inspection into runtime or
production evidence.
