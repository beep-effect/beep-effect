# Canonical Slice Factory Codex Handoff Prompt

Use this prompt in a fresh Codex session rooted in this repo.

```text
You are working in the beep-effect repo. First confirm the repo root with
`pwd`, `git rev-parse --show-toplevel`, and targeted file reads. Do not assume
the checkout is clean.

This is an implementation session. Audit first, then implement. Ask the user
only when a decision is genuinely missing from the initiative packet and cannot
be resolved from the repo.

Use Graphiti memory for beep-effect context if the `graphiti-memory` MCP is
available. If it is unavailable, continue from repo-local docs and code search.

## Mission

Implement the `goals/canonical-slice-factory` initiative.

Replace the drifted `fixture-lab/Specimen` proof with a normal
`architecture-lab` slice containing a synthetic `WorkItem` aggregate, then
systemize creation of canonical architecture parts through a modular
`beep architecture` command group in `@beep/repo-cli`.

This is not merely a scaffold CLI. It must prove the canonical parts, make
their creation repeatable, and leave agents with clear commands to use instead
of hand-authoring architecture boilerplate.

## Source Of Truth

Read these first:

- `goals/canonical-slice-factory/README.md`
- `goals/canonical-slice-factory/SPEC.md`
- `goals/canonical-slice-factory/PLAN.md`
- `goals/canonical-slice-factory/ops/manifest.json`
- `standards/ARCHITECTURE.md`
- `standards/architecture/README.md`
- `standards/architecture/GLOSSARY.md`
- `standards/architecture/01-hexagonal-vertical-slices.md`
- `standards/architecture/03-driver-boundaries.md`
- `standards/architecture/05-layer-composition.md`
- `standards/architecture/07-non-slice-families.md`
- `standards/architecture/08-testing.md`
- `standards/architecture/09-errors-across-boundaries.md`
- `standards/architecture/13-onboarding-the-minimum-viable-slice.md`

Use these as references only:

- `goals/canonical-slice-factory/history/repo-architecture-automation-reference.md`
- `packages/tooling/tool/cli/test/fixtures/repo-architecture-automation`
- `packages/fixture-lab/specimen`
- `packages/_internal/db-admin` in the machine-local `beep-effect4` checkout

The old automation packet and `fixture-lab/Specimen` are superseded. The Effect
v3 db-admin package is a capability reference for migration aggregation and live
DB proof; do not copy its old Effect APIs, old slice names, or old topology
blindly.

Treat architecture docs as target doctrine. If current code disagrees with
doctrine, classify the disagreement as current drift, transitional
compatibility, cleanup-on-touch, missing decision, or doctrine gap.

## Audit Before Editing

Before changing files:

1. Inspect the current git status.
2. Inventory active references to:
   - `fixture-lab/Specimen`
   - `fixture-lab`
   - `Specimen`
   - `@beep/fixture-lab-specimen`
   - `$FixtureLabSpecimenId`
   - `repo-architecture-automation`
3. Inspect `@beep/repo-cli` command patterns, especially:
   - `packages/tooling/tool/cli/src/commands/Root.ts`
   - `packages/tooling/tool/cli/src/commands/CreatePackage`
   - command groups with nested subcommands
   - existing file/plan/config writer helpers
4. Inspect package identity, config-sync, tsconfig, syncpack, docgen, tstyche,
   workspace, and inventory surfaces touched by the old proof packages.
5. Inspect current persistence surfaces:
   - `packages/_internal/db-admin`
   - `packages/drivers/drizzle`
   - `packages/drivers/postgres`
   - `packages/tooling/test-kit/test-utils`
   - existing `shared` or `workspace` table packages
6. Inspect the Effect v3 db-admin reference:
   - `drizzle.config.ts`
   - `src/schema.ts`
   - `src/tables.ts`
   - `src/db/AdminDb.ts`
   - `test/container.ts`
   - `src/scripts/inject-extensions.ts`
   - `drizzle/**`
   - `AGENTS.md`
   - `README.md`

After the audit, make a short implementation checklist and execute it.

## Required CLI Design

Build toward this public shape:

- `beep architecture create slice`
- `beep architecture add concept`
- `beep architecture add role`
- `beep architecture plan`
- `beep architecture apply`
- `beep architecture check`

The exact public grammar can evolve if repo constraints demand it, but the
internal model is fixed:

- every ergonomic command compiles into one decoded schema-versioned JSON
  architecture operation plan;
- `plan` emits JSON;
- `apply` consumes JSON;
- `check` validates the plan and idempotency;
- write commands write by default and support `--dry-run`;
- dry-run output must expose planned operations;
- writer selection happens from the normalized plan;
- Handlebars may render reviewable source/docs leaves;
- structured writers own JSON, JSONC, package metadata, docgen, and manifests;
- ts-morph is used only for semantic TypeScript mutations such as identity,
  imports, exports, and stable generated indexes.

Idempotency is failsafe: skip identical files, perform structured idempotent
config or TypeScript updates, and fail on differing existing source files
unless a future explicit overwrite mode is added.

Do not build separate one-off scaffold scripts for each command. The point is a
modular factory that can later create tables, protocol modules, foundation
packages, drivers, and other architecture parts through the same plan model.

Keep top-level `create-package` compatible as non-architecture scaffolding.
Architecture-native slice role package creation lives under
`beep architecture create package`.

## Proof Target

Replace the old proof with a normal `architecture-lab` slice:

```txt
packages/architecture-lab/
  domain/
  use-cases/
  config/
  server/
  tables/
  client/
  ui/
```

Package names use `@beep/architecture-lab-*`. Do not append the concept name
to the package prefix.

`WorkItem` lives under the aggregate domain-kind folder, not the entity
domain-kind folder.

`WorkItem` is a synthetic lifecycle task. Keep it boring and useful:
title, status, optional assignee, create/assign/complete/reopen/archive
commands, one get/list query path, enough domain transition failures,
server-only repository failures, public action failures, and protocol
translation to prove the boundaries.

The proof is staged:

1. Minimal legal slice core: domain, use-cases, server.
2. Persistence adapter: config, tables, db-admin migration target, live
   Drizzle-backed repository, package/slice Layer.
3. Protocol adapters: driver-neutral HTTP/RPC/AI declarations in use-cases and
   server handlers/tests.
4. Client experience: client facade, UI surface, and
   `apps/architecture-lab-proof` as an app contract harness.

Each stage must be valid on its own. Do not create packages or files only for
symmetry. Optional packages and role files exist only when they carry meaningful
behavior, contract, adapter, config, persistence, migration, or tests.

The protocol stage proves contracts and handlers, not live transports. Do not
build a runnable HTTP/RPC server or real AI provider just for this proof.

The app proof is a contract harness like `apps/professional-runtime-proof`, not
a browser product. It proves app-local Layer composition and package imports
over public slice boundaries.

## Db-Admin And Persistence

`packages/_internal/db-admin` should become the migration aggregation home for
the new proof.

Use the Effect v3 db-admin reference for concepts:

- db-admin-owned `drizzle.config.ts`;
- schema barrel consumed by drizzle-kit;
- table aggregation from slice table packages;
- generated `drizzle/**` SQL and journal artifacts;
- migration scripts in the db-admin package;
- internal admin/test DB access surface;
- live repository tests against a migrated database.

Adapt to the current repo:

- prefer current `@beep/postgres`, `@beep/drizzle`, and `@beep/test-utils`
  primitives;
- make `architecture-lab` the first db-admin migration target;
- use `@beep/architecture-lab-tables` as the WorkItem table source;
- do not make production apps depend on `_internal/db-admin`;
- do not copy old RLS/extension policy unless WorkItem independently needs it;
- do not copy old Effect v3 import/API style.

Live DB tests must self-skip unless `BEEP_TEST_DATABASE_URL` or
`BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers` is set.

## Factory Proof Loop

Prove the factory against the canonical slice:

1. Hand-shape the accepted staged `architecture-lab/WorkItem` slice.
2. Teach `beep architecture` to produce the same staged operation plan.
3. Generate the staged shape into a temp fixture.
4. Compare generated output with the accepted proof shape.
5. Apply the same plan twice and prove the second apply is a no-op.

V1 factory coverage must include every package and role used by the WorkItem
proof, including config, tables, protocol declarations, server handlers, client,
UI, app harness, and db-admin target.

Standalone foundation package and driver package creation are explicit planner
extension points, not required v1 public wrappers unless the WorkItem proof
needs them.

## Old Proof Replacement

Supersede and remove active canonical reliance on:

- the prior repo architecture automation packet
- `packages/tooling/tool/cli/test/fixtures/repo-architecture-automation`
- `packages/fixture-lab/specimen`
- `@beep/fixture-lab-specimen-*`
- `$FixtureLabSpecimenId`
- docs that name `fixture-lab/Specimen` as the executable proof

Mine lessons before deleting or rewriting references. Do not leave both proofs
as parallel canonical examples. After replacement is green, delete the old live
proof packages, old fixture registry/tests, old root wiring, old identity refs,
and the old initiative packet unless a reference is clearly historical and
non-canonical.

## Documentation And Agent Guidance

Update agent-facing guidance once the command group exists. Agents should learn
to use `beep architecture` for canonical slices and architecture parts instead
of hand-authoring boilerplate.

Add a `standards/architecture/DECISIONS.md` entry superseding the old fixture
proof target while preserving strict action-error doctrine.

Update only the surfaces that own the decision:

- root agent guidance for "use this command";
- relevant architecture docs for proof-target and generated-default updates;
- db-admin package guidance for migration aggregation;
- repo-cli README/docs for command usage;
- initiative docs/manifest for implementation status.

Do not create generic context files or ADR folders.

## Verification

Use targeted checks while building:

- operation-plan, wrapper, writer, conflict, and idempotency tests for
  `@beep/repo-cli`;
- runtime and type tests for staged `architecture-lab/WorkItem` packages;
- db-admin drizzle-kit migration generation/execution tests or documented
  clean skips;
- live WorkItem repository tests gated by `BEEP_TEST_DATABASE_URL` or
  `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers`;
- round-trip generation comparison and second-apply no-op proof;
- search audits for stale `fixture-lab/Specimen` canonical references;
- package/config sync checks needed by generated workspaces.

When coherent, attempt:

- `bun run check`
- `bun run lint`
- `bun run test`
- `bun run docgen`
- `bun run audit:full`

If a full gate fails because of unrelated pre-existing state, record the exact
command, failure, and remaining follow-up.

## Final Response

Report:

- what changed;
- where the new proof, CLI factory, app harness, and db-admin migration target live;
- which old fixture references were removed or intentionally left historical;
- exact verification commands and results;
- any unresolved blockers.
```
