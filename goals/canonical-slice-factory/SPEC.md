# Canonical Slice Factory Specification

## Status

**V1 CLOSED**

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-05-12
- **Updated:** 2026-05-14

## Mission

Replace the drifted repo architecture automation proof with a new staged
canonical proof and derive a modular `beep architecture` factory from it.

The goal is not only to create new slices from scratch. The factory must also
support granular creation of architecture parts: domain kinds, concepts, role
modules, tables, protocol modules, foundation packages, drivers, and future
architecture units without duplicating generation logic.

## V1 Closure Scope

V1 closes around the implemented `architecture-lab` proof, not an expanding
archetype catalog. The sufficient V1 archetypes are `aggregates/WorkItem`,
`entities/Worker`, and `values/WorkPriority`.

The V1 closure preserves the public `beep architecture` command grammar
and `architecture-operation-plan/v1` schema. Internal modularization,
operation execution hardening, review-loop fixes, and documentation/status
updates are in scope. New domain-kind archetypes, standalone foundation
package factories, and standalone driver package factories remain future
operation-plan extension points.

## Operation Plan V1 Replay Contract

`architecture-operation-plan/v1` is a real replay contract, not an informal
label. The plan output is version-tagged, decoded through the schema before
apply/check, and rejected before execution when the schema version is not
supported.

V1 permits additive optional metadata and behavior already accepted or ignored
by the v1 executor only when existing v1 fixtures still decode and replay
identically. New actionable architecture operation variants require
`architecture-operation-plan/v2` unless a documented v1 capability-extension
rule proves both old-plan replay and new-plan compatibility across supported
executors. Breaking structural changes, required fields, renamed fields,
removed fields, or semantic changes that alter replay behavior require v2
alongside v1. V1 removal follows the deprecation discipline in
`standards/architecture/11-evolution-and-deprecation.md`.

The intended future extraction path is therefore a topology move, not a plan
migration: a later repo-operation-plan kernel can republish or alias the stable
v1 substrate while keeping architecture operation variants intact until a real
second producer proves a broader vocabulary.

## Non-Negotiable Contract

- This initiative supersedes the prior repo architecture automation packet.
  Retained lessons live in
  `history/repo-architecture-automation-reference.md`, and git history is the
  archive.
- `fixture-lab/Specimen` is reference material only and must not remain an
  executable or documented canonical proof after implementation.
- The new proof target is a normal `architecture-lab` slice with `WorkItem` as
  the concept inside it:
  `packages/architecture-lab/{domain,use-cases,config,server,tables,client,ui}`
  and package names `@beep/architecture-lab-*`.
- `WorkItem` lives at `aggregates/WorkItem` and is a synthetic lifecycle task,
  not product roadmap code.
- The first proof must start from the smallest legal slice and add optional
  parts through explicit stages.
- `beep architecture` owns the future CLI command group.
- Every ergonomic command must compile to one schema-backed architecture
  operation plan before writing files.
- Commands write by default, support `--dry-run`, and expose schema-versioned
  JSON operation plans.
- `beep architecture plan` emits JSON; `beep architecture apply` consumes JSON;
  `beep architecture check` validates the plan and idempotency.
- Idempotency is failsafe: skip identical files, perform structured
  idempotent config or TypeScript updates, and fail on differing existing
  source files unless a future explicit overwrite mode is added.
- Top-level `create-package` remains compatible as a separate
  non-architecture scaffolding surface. Architecture-native slice role package
  creation lives under `beep architecture create package`.
- The persistence proof must include db-admin migration generation and live
  Drizzle-backed repository tests when test database settings are available.

## Proof Matrix

The `architecture-lab/WorkItem` proof is staged:

1. **Core slice:** minimal legal domain, use-cases, and server package set.
2. **Persistence adapter:** config, tables, db-admin migration target, live
   Drizzle-backed server repository, and slice Layer.
3. **Protocol adapters:** driver-neutral HTTP/RPC/AI declarations in
   use-cases plus server handlers and tests.
4. **Client experience:** client facade, UI surface, and dedicated synthetic app
   contract harness for app-local Layer composition.

Each stage must be a valid target state. Optional packages or role files are
created only when the stage requires meaningful behavior.

`WorkItem` should stay boring and useful: title, status, optional assignee,
create/assign/complete/reopen/archive commands, one get/list query path, domain
transition failures, server-only repository failures, public action failures,
and protocol translation tests.

The protocol stage proves contracts and handlers, not live transports:
driver-neutral `.http.ts`, `.rpc.ts`, `.tools.ts`, package composers, server
handler modules, and tests are in scope; a runnable HTTP/RPC server and real AI
provider are out of scope.

The synthetic app is a contract harness like `apps/professional-runtime-proof`.
It proves app-local Layer composition and package imports over public slice
boundaries, not a browser product.

## Factory Proof Loop

The factory must prove it can reproduce the canonical shape:

1. Hand-shape the accepted staged `architecture-lab/WorkItem` slice.
2. Teach `beep architecture` to produce the same staged operation plan.
3. Generate the staged shape into a temp fixture.
4. Compare the generated shape against the accepted proof shape.
5. Apply the same plan twice and prove the second apply is a no-op.

V1 generation must cover every package and role used by the WorkItem proof.
Foundation-package and driver-package creation remain explicit operation-plan
extension points unless the WorkItem proof itself needs them.

## CLI Architecture

The command group should use this shape:

- `beep architecture create slice`
- `beep architecture add concept`
- `beep architecture add role`
- `beep architecture plan`
- `beep architecture apply`
- `beep architecture check`

The public command grammar may evolve, but the internal model must not: every
`beep architecture` path normalizes into a decoded operation plan, then flows
through writer selection, template rendering, structured writers, and semantic
TypeScript writers when required.

The plan model should include action identity, target path, write mode,
conflict status, operation source, and enough metadata for dry-run output,
fixture comparison, and idempotency checks.

Use Handlebars for reviewable source/docs leaves, structured writers for JSON,
JSONC, package metadata, docgen, and manifests, and ts-morph only for semantic
TypeScript mutations such as identity composers, imports, exports, and stable
generated indexes.

## Db-Admin Reference

The Effect v3 repo contains the richer db-admin precedent at
`packages/_internal/db-admin` in the machine-local `beep-effect4` checkout. Treat it as a
capability reference, not a topology template. Inspect these files before
designing the current package:

- `drizzle.config.ts`;
- `src/schema.ts`;
- `src/tables.ts`;
- `src/db/AdminDb.ts`;
- `test/container.ts`;
- `src/scripts/inject-extensions.ts`;
- `drizzle/**`;
- `AGENTS.md` and `README.md`.

Port the concepts that fit current doctrine:

- db-admin owns migration aggregation and generated migration artifacts;
- a schema barrel feeds drizzle-kit;
- migration scripts live with db-admin;
- admin DB access is internal tooling/test infrastructure, not app runtime API;
- live repository tests can run against migrated test databases.

Do not copy Effect v3 APIs, old slice names, old shared-server `DbClient`
shapes, broad RLS/extension policy, or production app dependencies on
`_internal/db-admin` unless the current repo independently requires them.

## Artifact Homes

- Human initiative contract: `goals/canonical-slice-factory`.
- Agent launch prompt: `goals/canonical-slice-factory/ops/codex-handoff-prompt.md`.
- Machine-readable initiative manifest:
  `goals/canonical-slice-factory/ops/manifest.json`.
- Executable repo-cli fixtures: repo-cli test fixtures under
  `packages/tooling/tool/cli/test/fixtures`.
- Runtime proof app: `apps/architecture-lab-proof`, not
  `apps/professional-runtime-proof`.
- Migration aggregation and generated SQL:
  `packages/_internal/db-admin`.

## Documentation And Agent Guidance

Implementation must update agent-facing guidance so future agents use the new
commands instead of hand-authoring canonical architecture parts. Root guidance,
relevant architecture standards, and repo-cli docs should describe the command
group once it exists.

Implementation must also add a `standards/architecture/DECISIONS.md` entry that
supersedes the old fixture-proof target while preserving the strict action-error
doctrine. Binding proof references in `standards/ARCHITECTURE.md`,
`standards/architecture/README.md`, `08-testing.md`,
`09-errors-across-boundaries.md`, and related onboarding guidance must point to
the new proof once it exists.

## Required Verification

Use targeted tests while building and full gates when the replacement is
coherent:

- focused repo-cli factory tests;
- proof-package runtime and type tests;
- round-trip generation and idempotency tests;
- live database tests for WorkItem repository behavior when
  `BEEP_TEST_DATABASE_URL` or
  `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers` is set, with clean skips
  otherwise;
- fixture/reference search audits proving `fixture-lab/Specimen` is deleted or
  no longer active canonical guidance;
- package/config sync checks required by generated packages;
- final attempts of `bun run check`, `bun run lint`, `bun run test`,
  `bun run docgen`, and `bun run audit:full`.

If a full gate is blocked by unrelated existing repo state, record the exact
command, failure, and follow-up.

## Out Of Scope

- Turning `architecture-lab/WorkItem` into product behavior.
- Building every granular factory in v1.
- Keeping `fixture-lab/Specimen` as a parallel canonical proof.
- Making `@turbo/gen` the generator core; it can become a later wrapper only.
- Moving app-level Layer composition into a monorepo runtime package.
- Building a full db-admin product CLI beyond the migration generation and
  execution surface needed for the proof.
- Requiring Docker or an external database for normal test runs.

## Source-Of-Truth Order

When sources disagree, use this order:

1. this `SPEC.md`;
2. `standards/ARCHITECTURE.md`;
3. `ops/manifest.json`;
4. `PLAN.md`;
5. `ops/codex-handoff-prompt.md`;
6. the Effect v3 db-admin reference for migration capability shape;
7. `history/repo-architecture-automation-reference.md` as historical reference.
