# Canonical Slice Factory Plan

This plan executes [SPEC.md](./SPEC.md). It starts by replacing the drifted
proof target, then systemizes the creation path through `@beep/repo-cli`.

## V1 Closure Update

As of 2026-05-14, the V1 closure scope is fixed to the implemented
`architecture-lab` proof and current public `beep architecture` grammar. The
closure does not add more domain-kind archetypes. It hardens and modularizes
the current operation-plan implementation, runs the comprehensive
quality/review loop over the initiative surface and touched code paths, merges
the closure PR into `main`, and syncs local `main`.

Future work after V1:

- add new domain-kind archetypes only when a real architecture rule needs a new
  proof shape;
- promote foundation-package and driver-package factories from extension
  points to public wrappers only after their ownership rules are proven;
- replace accepted-proof copy rendering with richer structured/semantic writer
  primitives where doing so removes duplication or drift risk.

## A. Audit Current Drift

- Read the architecture standards, this initiative packet, and the retained
  automation reference note in `history/repo-architecture-automation-reference.md`.
- Inspect the Effect v3 db-admin reference at
  `packages/_internal/db-admin` in the machine-local `beep-effect4` checkout, especially
  `drizzle.config.ts`, `src/schema.ts`, `src/tables.ts`,
  `src/db/AdminDb.ts`, `test/container.ts`,
  `src/scripts/inject-extensions.ts`, and `drizzle/**`.
- Inventory all active references to `fixture-lab/Specimen`,
  `@beep/fixture-lab-specimen-*`, and `$FixtureLabSpecimenId`.
- Classify references as old proof implementation, generated inventory, docs
  guidance, identity/config wiring, or unrelated historical evidence.
- Inventory current db-admin, postgres, drizzle, and test-utils surfaces before
  adapting any Effect v3 pattern.

## B. Replace The Proof Target

- Create the staged `architecture-lab` proof as normal slice workspaces:
  `domain`, `use-cases`, `config`, `server`, `tables`, `client`, and `ui`.
- Put the synthetic lifecycle concept at `aggregates/WorkItem`.
- Start with the smallest legal slice and add optional package roles only when
  a stage needs meaningful behavior.
- Add `apps/architecture-lab-proof` as a contract harness for app-local Layer
  composition.
- Add a db-admin migration target for `architecture-lab` and prove a live
  Drizzle-backed WorkItem repository when database test settings are enabled.
- Remove active canonical references to `fixture-lab/Specimen`, delete the old
  live proof packages/fixture registry after replacement, and use the retained
  automation note instead of the deleted prior packet.

## C. Build The Factory Core

- Add the `beep architecture` command group in `@beep/repo-cli`.
- Model architecture creation as decoded schema-versioned JSON operation plans.
- Implement writer selection over the shared plan model.
- Route ergonomic wrappers through that planner.
- Implement `plan` output, `apply` input, `check` validation, dry-run output,
  and failsafe conflict reporting.
- Keep top-level `create-package` compatible as non-architecture scaffolding
  while moving architecture-native slice package creation to
  `beep architecture create package`.

## D. Prove Granular Creation

- Support whole-slice creation for the staged `architecture-lab` packages.
- Support adding the `aggregates/WorkItem` concept and canonical role modules.
- Support domain-kind archetypes beyond aggregates:
  `entities/Worker` proves persisted entity topology and `values/WorkPriority`
  proves domain-only value-object topology.
- Generate every role used by the WorkItem proof, including tables, protocol
  declarations, server handlers, client, UI, app harness, and db-admin target.
- Reject role requests that do not belong to the selected domain kind, such as
  server/UI/db-admin requests for a `values` concept.
- Leave standalone foundation package and driver package creation as explicit
  operation-plan extension points.
- Add a round-trip fixture lane: accepted proof shape, generated temp shape,
  comparison, and second-apply no-op check.

## E. Update Guidance

- Update root agent guidance and repo-cli docs so agents discover and prefer
  the architecture commands.
- Add a decision-log entry superseding the old fixture proof target while
  preserving strict action-error doctrine.
- Update architecture docs where canonical proof references or generated
  defaults changed.
- Update db-admin agent guidance with the current migration aggregation role.

## Required Checks

Run targeted checks first:

- repo-cli tests for operation planning and idempotency;
- proof package tests and type tests;
- db-admin migration generation/execution tests or documented clean skips;
- WorkItem live database tests gated by `BEEP_TEST_DATABASE_URL` or
  `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers`;
- round-trip generation comparison and second-apply no-op proof;
- search audits for stale canonical `fixture-lab/Specimen` references.

Then attempt the coherent repo gates:

- `bun run check`
- `bun run lint`
- `bun run test`
- `bun run docgen`
- `bun run audit:full`

Record exact unrelated blockers instead of hiding them.
