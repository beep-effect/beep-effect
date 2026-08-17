# Canonical Slice Factory

## Status

V1 closed

## Mission

Create the next architecture-automation packet for proving and systemizing
canonical slice creation. This initiative supersedes the prior repo
architecture automation packet: its retained lessons and `fixture-lab/Specimen`
are reference material only, not the active contract.

The new proof target is the synthetic `architecture-lab` slice with a
`WorkItem` aggregate. It must prove the smallest legal slice first, then add
optional canonical parts through the same modular factory model that future
`beep architecture` commands will use.

## V1 Closure State

The V1 proof surface is fixed for closure:

- `aggregates/WorkItem` proves full slice topology.
- `entities/Worker` proves persisted domain entity topology.
- `values/WorkPriority` proves domain-only value-object topology.
- `packages/_internal/db-admin` proves migration aggregation for the
  architecture-lab table packages.
- `beep architecture` owns the schema-backed plan/apply/check path plus the
  first ergonomic wrappers.

The V1 closure preserves the current public command grammar and
`architecture-operation-plan/v1` schema. New domain-kind archetypes,
foundation-package factories, and driver-package factories are future
extension work, not V1 blockers.

`architecture-operation-plan/v1` is treated as a replay contract. Compatible
additions are limited to optional metadata or behavior already accepted by the
v1 executor while existing v1 fixtures still decode and replay identically. New
actionable operation variants require v2 unless a documented capability
extension proves old-plan replay and new-plan compatibility across supported
executors. Breaking structural or semantic changes require v2 alongside v1
under the repo's evolution/deprecation discipline.

## Current Contract

- `architecture-lab/WorkItem` replaces `fixture-lab/Specimen` as the intended
  executable architecture proof.
- `architecture-lab` is a normal slice package family:
  `@beep/architecture-lab-*`, with `WorkItem` at `aggregates/WorkItem`.
- The active proof now includes three domain-kind archetypes:
  `aggregates/WorkItem` for full slice topology, `entities/Worker` for
  persisted domain entities, and `values/WorkPriority` for domain-only value
  objects.
- `beep architecture` is the command group for slice and architecture
  part creation.
- The CLI must use one schema-backed operation-plan core with ergonomic
  wrappers, not independent one-off scaffold scripts.
- The first ergonomic wrappers should prove whole-slice creation, concept or
  domain-kind creation, role/module creation, JSON plan/apply/check flow, and
  round-trip idempotency.
- Top-level `create-package` remains a separate compatibility surface for
  non-architecture scaffolding. Architecture-native slice role packages are
  created through `beep architecture create package`.
- `packages/_internal/db-admin` should own the migration aggregation proof for
  `architecture-lab`, using the Effect v3 db-admin package as reference
  material only.

## Reading Order

- [SPEC.md](./SPEC.md) - binding contract and acceptance rules
- [PLAN.md](./PLAN.md) - ordered implementation path for the next Codex session
- [ops/manifest.json](./ops/manifest.json) - machine-readable initiative
  routing and proof metadata
- [ops/codex-handoff-prompt.md](./ops/codex-handoff-prompt.md) - launch prompt
  for the implementation Codex instance

## Reference Material

- [history/repo-architecture-automation-reference.md](./history/repo-architecture-automation-reference.md) -
  compact retained lessons from the deleted prior packet
- Deleted `repo-architecture-automation` fixtures and `packages/fixture-lab/specimen`
  remain available through git history only
- `packages/_internal/db-admin` in the machine-local `beep-effect4` checkout - Effect v3
  db-admin capability reference for drizzle-kit migration aggregation
