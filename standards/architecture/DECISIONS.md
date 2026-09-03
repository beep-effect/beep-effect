# Architecture Decision Log

This log records closed architecture decisions for the hexagonal vertical slice
standard. Amend this file when the standard changes.

## 2026-04-21: Adopt Hexagonal Vertical Slice Architecture

- **Status:** Active

Decision:

beep-effect uses slice package families with domain, use-cases, optional config,
server, client, tables, and UI. Technical wrappers live outside slices in the
repo-level `drivers` family.

Rationale:

The repo needs fast experimentation without topology drift. Slice families keep
domain work modular while hexagonal boundaries prevent driver details from
leaking inward.

## 2026-04-21: Treat `shared` As A DDD Shared Kernel

- **Status:** Active

Decision:

The `shared` package family is cross-cutting shared-kernel language, not a
dumping ground.

Rationale:

Shared code is expensive because every slice can depend on it. It must stay
small, deliberate, and driver-neutral where possible.

## 2026-04-21: Add `use-cases` As A Canonical Slice Package

- **Status:** Active

Decision:

Use-cases are first-class. Product ports live in use-cases by default.

Rationale:

Domain should not own application ports, and server should not define the
product language it implements. Use-cases are the correct application boundary.

## 2026-04-21: Keep `tables` Canonical

- **Status:** Active

Decision:

`tables` remains a canonical package for product-specific persistence schema and
mapping.

Rationale:

Drivers own generic Drizzle/Postgres safety wrappers. Tables own slice-specific
persistence shape.

## 2026-04-21: Drivers Own Technical Capability Only

- **Status:** Active

Decision:

Driver packages expose dev-safe technical wrappers and low-level runtime
capabilities. Product port implementations belong in `server` by default.

Rationale:

Putting business repository implementations inside `drivers/drizzle` or
`drivers/postgres` makes drivers product-aware and leaks infrastructure
names into product topology.

## 2026-05-06: Allow Narrow Tooling-To-Driver Operational Adapters

- **Status:** Active

Decision:

Tooling packages may depend on driver packages when the tooling package is the
operational adapter for repository analytics, generation, migration, fixtures,
or CLI workflows that need a product-neutral external engine.

Rationale:

Some repo-operational workflows, such as durable AI metrics projections into
DuckDB, need a technical engine without becoming product runtime code. The
driver still owns the external API boundary; the tooling package owns the
repo-operational semantics and must declare the direct dependency/reference it
imports.

## 2026-04-21: Use Domain-Kind Folders

- **Status:** Active

Decision:

Domain concepts are grouped by `aggregates/`, `entities/`, and `values/`.
`policies/` and `services/` are escape hatches.

Rationale:

Domain-kind folders preserve DDD meaning and keep concept topology expressive
without flattening everything into one root.

## 2026-04-21: Use Concept-Qualified Role Suffixes

- **Status:** Active

Decision:

The canonical grammar is:

```txt
<package>/src/<domain-kind>/<Concept>/<Concept>.<role>.ts
```

Rationale:

The path tells readers the concept. The role suffix tells reviewers what the
file may do.

## 2026-04-21: Split Access From Policy

- **Status:** Active

Decision:

Use both `.access.ts` and `.policy.ts` where needed.

Rationale:

`access` means who may attempt an action on a resource. `policy` means what the
domain permits to be true.

## 2026-04-21: Prefer Hybrid Rich Domain Models

- **Status:** Active

Decision:

Domain models should own shape, validation, and pure behavior. Behavior can live
as model methods, exported functions, `*.behavior.ts`, and pure `*.policy.ts`.

Rationale:

Pure behavior near the domain concept reduces duplicated rules across use-cases,
handlers, client state, and UI.

## 2026-04-21: Reduce Runtime God Layers

- **Status:** Active

Decision:

Favor slice-local Layer composition over central runtime packages that merge all
similar slice dependencies.

Rationale:

Effect v4 memoized Layers make local composition practical. Slice-local Layers
preserve ownership and reduce cross-slice coupling.

## 2026-04-21: Keep Codegen And Linting Downstream

- **Status:** Active

Decision:

This standard defines architecture. Repo-cli, codegen, codemods, package
constraints, and lint rules are downstream enforcement mechanisms.

Rationale:

The architecture needs to be clear before enforcement is designed.

## 2026-04-21: Restrict Client-Safe Use-Case Imports

- **Status:** Superseded
- **Superseded-by:** [2026-04-23: Make Boundary-Sensitive Export Subpaths Canonical](#2026-04-23-make-boundary-sensitive-export-subpaths-canonical)

Decision:

Client packages may import use-case command/query language, driver-neutral
boundary contracts, driver-neutral DTOs, client-safe facade contracts, and
actionable application errors, but not product ports, server-only
service/facade contracts, workflows, process managers, schedulers, or live
Layer implementations.

Amended 2026-04-23: this client-safe contract is now taught through the
canonical `@beep/<slice>-use-cases/public` boundary.

Rationale:

The client needs shared application language without becoming coupled to
server-only orchestration or infrastructure contracts.

## 2026-04-21: Put Protocol Declarations In `use-cases`

- **Status:** Active

Decision:

Use-case `.http.ts`, `.rpc.ts`, `.tools.ts`, and `.cluster.ts` files define
driver-neutral protocol declarations. Implementations, handlers, clients,
runtime Layers, and transports belong in adapter packages.

Rationale:

The application boundary should own command/query and protocol language without
owning the runtime side effects that execute that language.

## 2026-04-22: Add `config` As An Optional Canonical-Shape Slice Package

- **Status:** Active

Decision:

`config` is the optional canonical-shape package kind for typed slice configuration.
Package names use `@beep/<slice>-config` and `@beep/<kernel>-config`.

Rationale:

Effect `Config` names a typed runtime contract, while environment variables are
only one possible source. A config package gives application tunables, public
config, server config, secrets, defaults, and config Layers a clear home without
leaking runtime reads into domain code.

## 2026-04-22: Treat `env` Package Naming As Legacy

- **Status:** Active

Decision:

`env` is source vocabulary, not architecture topology. Existing package names
such as `@beep/<kernel>-env` and paths such as `packages/<kernel>/config` should migrate
to `@beep/<kernel>-config` and `packages/<kernel>/config`.

Rationale:

Naming packages after the source encourages direct environment thinking. Naming
packages after config preserves the Effect `Config` abstraction and allows other
`ConfigProvider` sources.

## 2026-04-22: Keep Driver Config Driver-Local

- **Status:** Active

Decision:

Driver `.config.ts` files own technical driver knobs. Slice `config` packages
own application-facing config contracts. Server or client Layers may compose
slice config with driver config at adapter boundaries, but slice config
packages do not own driver internals.

Rationale:

Moving Drizzle, Postgres, EventLog, queue, or workflow-engine settings into a
slice config package would make the package a driver registry. Keeping
technical config driver-local preserves the driver boundary.

## 2026-04-23: Recast Provider Packages As Repo-Level Drivers

- **Status:** Active

Decision:

Third-party dev-safe wrappers live in flat repo-level drivers under
`packages/drivers/<name>`. Earlier drafts modeled them as slice-local
`providers`; this packet supersedes that model.

Rationale:

Technical wrappers are architecture-wide boundaries, not slice kinds and not
candidates for `shared`. Flat repo-level roots keep those boundaries visible
and keep `shared` focused on cross-slice product semantics.

## 2026-04-23: Driver Packages Use Short Capability Names

- **Status:** Active

Decision:

Driver packages use short public names such as `@beep/drizzle`,
`@beep/postgres`, and `@beep/<driver>`.

Rationale:

The driver role is already visible from the canonical root
`packages/drivers/<name>`. Repeating that role in the import path adds noise
without adding clarity.

## 2026-06-07: Generated SDK Drivers Prefer Regenerable Fidelity

- **Status:** Active

Decision:

Large SDK driver packages may generate schema and operation wrappers directly
from the installed SDK type declarations when the generated output is
reproducible and package-local. Generators should preserve precise schema
fidelity where the SDK exposes precise types, model forward-compatible open
enums explicitly, and fall back to `S.Unknown` for SDK `any`, unsupported
intersection refinements, uninspectable dynamic maps, and other shapes that
cannot be represented honestly without hand-written semantics.

Methods that carry byte streams, event streams, or SDK helper state may be
excluded from JSON operation generation and wrapped by a small hand-written
adapter surface. That adapter remains technical, driver-local, schema-first for
the representable fields, and covered by unit/type tests that pin the generated
and hand-written split.

Rationale:

SDK wrappers need broad method coverage without hand-authoring thousands of
schemas. A generator-first driver gives the repo a repeatable upgrade path and
keeps the SDK boundary honest: precise types stay precise, future enum values
decode where the SDK contract is open, and ambiguous SDK declarations remain
`Unknown` instead of pretending to be domain language. The hand-written stream
escape hatch keeps non-JSON runtime behavior explicit without turning the whole
driver into bespoke code.

## 2026-04-23: Add Explicit Non-Slice Artifact Families

- **Status:** Superseded
- **Superseded by:** [2026-05-01: Retire Assistant Bundles From Architecture](#2026-05-01-retire-assistant-bundles-from-architecture)

Decision:

Non-slice architecture uses four canonical families:

- `foundation` for domain-agnostic reusable substrate
- `drivers` for flat repo-level external boundary wrappers
- `tooling` for developer-operational code packages
- `agents` for repo-local AI steering bundles

`shared` remains the DDD shared kernel. It is not renamed to `foundation`, and
it is not a synonym for `common`, `core`, or `misc`.

Rationale:

The repo needs reusable artifacts that are not slices, but those artifacts
still need topology that compresses context for humans and agents. Naming
families explicitly prevents generic buckets from becoming junk drawers.

## 2026-04-23: Give Every Non-Slice Artifact A Family And, When Applicable, A Kind

- **Status:** Superseded
- **Superseded by:** [2026-05-01: Retire Assistant Bundles From Architecture](#2026-05-01-retire-assistant-bundles-from-architecture)

Decision:

Every non-slice artifact declares exactly one canonical family. Kind remains
required only for families that intentionally declare a kind segment.

- `foundation`: `primitive`, `modeling`, `capability`, `ui-system`
- `drivers`: flat family with no extra kind segment
- `tooling`: `library`, `tool`, `policy-pack`, `test-kit`
- `agents`: `skill-pack`, `policy-pack`, `runtime-adapter`

Canonical roots are:

```txt
packages/foundation/<kind>/<name>
packages/drivers/<name>
packages/tooling/<kind>/<name>
agents/<kind>/<name>
```

Code packages record `family` and `kind` in `package.json` under a top-level
`beep` object when that family intentionally declares a kind segment.
`drivers` record `family` only. Agent bundles record the same metadata in
`beep.json`.

Rationale:

Family-only taxonomy is too vague for families that use a kind segment. Family
plus kind makes dependency rules, file-role conventions, and browsing
expectations visible from the path and machine-readable in metadata, while
`drivers` remains the explicit flat-family exception.

## 2026-04-23: Allow `shared/use-cases` As A High-Bar Shared-Kernel Exception

- **Status:** Active

Decision:

`shared/use-cases` is canonical only as a high-bar shared-kernel exception. It
is contract-only:

- cross-slice commands and queries
- driver-neutral DTOs and boundary/protocol contracts
- client-safe application errors and facade interfaces
- product ports

It does not own workflows, process managers, schedulers, handlers, concrete
adapters, driver imports, or live Layer values.

Rationale:

Some cross-slice application language deserves a durable shared home, but
shared must stay small and must not become a runtime/orchestration bucket.

## 2026-04-23: Make Boundary-Sensitive Export Subpaths Canonical

- **Status:** Active
- **Supersedes:** [2026-04-21: Restrict Client-Safe Use-Case Imports](#2026-04-21-restrict-client-safe-use-case-imports)

Decision:

Boundary-sensitive packages publish explicit canonical subpaths:

- `use-cases`: `/public`, `/server`, `/test`
- `config`: `/public`, `/server`, `/secrets`, `/layer`, `/test`
- browser-safe driver surfaces: `@beep/<driver>/browser`

For `use-cases`, `/public` is the client-safe application contract surface and
`/server` is the server-only application contract surface. The shared-kernel
`shared/use-cases` exception uses the same names but remains narrower than slice
`use-cases`.

Canonical subpath names are required names when that role exists, not a requirement
to publish placeholder exports. Package roots and `./*` wildcard exports may
remain during migration, but they are transitional only.

Rationale:

Explicit subpaths make browser/server safety visible in imports and let the
target doctrine coexist with migration-era root exports.

## 2026-04-23: Keep Live Application Layer Composition Out Of `use-cases`

- **Status:** Active

Decision:

`use-cases` and `shared/use-cases` never export live Layer values. `drivers`
may export boundary-local layer constructors. `config` may expose
server/runtime-only config resolution helpers under `/layer`. `server` and
`client` own package-local application Layer composition, and top-level
application entrypoints compose those package-local boundaries.

Rationale:

This keeps use-cases as application contract language while leaving live wiring
at adapter boundaries where runtime dependencies belong.

Supersedes older wording that described `use-cases/server` as a runtime-complete
surface. Live Layer composition remains package-local to `server` and `client`,
with top-level application entrypoints composing those boundaries.

## 2026-04-23: Use Semantic Foundation Names And Repo-Scoped Tooling Names

- **Status:** Active

Decision:

Foundation packages use semantic public names such as `@beep/schema`,
`@beep/identity`, and `@beep/ui`. Driver packages use short capability names
such as `@beep/drizzle` and `@beep/postgres`. Tooling packages use repo-scoped
public names such as `@beep/repo-cli` and `@beep/repo-configs`.

Rationale:

Foundation packages are reusable substrate and should read cleanly in imports.
Tooling packages are repo-operational by design and should advertise that role
in their names.

## 2026-04-23: Keep Agent Content Portable And Runtime Wiring Declarative

- **Status:** Superseded
- **Superseded by:** [2026-05-01: Retire Assistant Bundles From Architecture](#2026-05-01-retire-assistant-bundles-from-architecture)

Decision:

Agent architecture separates portable content from runtime wiring.

- `skill-pack` owns portable guidance bundles
- `policy-pack` owns declarative steering packets
- `runtime-adapter` composes skill/policy packs declaratively for a concrete
  runtime

Runtime adapters may contain config, templates, and mappings, but executable
logic lives in `tooling/tool`, not in `agents`.

Rationale:

Portable content should not fork per runtime. Declarative runtime adapters keep
Claude, Codex, and future runtime-specific wiring visible without duplicating
the content itself.

## 2026-04-23: Ban Script-Only Pseudo-Packages As A Canonical Pattern

- **Status:** Active

Decision:

Script-only pseudo-packages are not a canonical architecture style. Repo-wide
task aggregation belongs at the root or inside a real `tooling/tool` package
with explicit topology and entrypoints.

Rationale:

If a package matters enough to be named in the architecture, it should have a
real role contract that readers can infer from structure instead of a
single `package.json` full of scripts.

## 2026-04-27: Split Postgres And Drizzle Drivers From Product Repositories

- **Status:** Active

Decision:

Production database capability is composed from specific driver packages, not a
generic shared-server database bucket:

- `packages/drivers/postgres` publishes `@beep/postgres` with
  `PostgresClient.makeLayer`, `PostgresError`, SQLSTATE diagnostics, SQL
  formatting, Drizzle Effect Postgres composition, and migrations;
- `packages/drivers/drizzle` publishes `@beep/drizzle` with
  `Drizzle.makeLayer` and `DrizzleError`.
- The old placeholder `@beep/pglite` driver package is deleted. PGLite remains
  only as a test-harness implementation in `@beep/test-utils`, not as a
  first-class production driver package.

`@beep/drizzle` exposes its root driver API directly, for example
`import { Drizzle, DrizzleError } from "@beep/drizzle"`. `DrizzleError` is the
only public Drizzle driver error. It is technical and operation-scoped, carrying
`operation`, optional `cause`, and optional query context when native Drizzle
errors expose it. The drifted `DrizzleProviderError`, `ProviderError`,
`ORMError`, and `QueryError` surfaces are rejected.

`PostgresError` follows the same technical, operation-scoped rule and may
include SQLSTATE, constraint, source-location, and formatted-query diagnostics
when known. Those diagnostics support logging and translation; they are not
product application errors.

`Drizzle.makeLayer(client)` accepts a narrow product-neutral Drizzle adapter.
Runtime composition decides whether that adapter is backed by Postgres or some
other database runtime. Transaction APIs use explicit Effect-native
`withTransaction` callbacks and do not use ambient transaction context.

Server-side product repositories translate driver errors into product-named
repository or application errors. Use-case ports never expose Drizzle or
Postgres driver errors directly.

The following legacy/shared abstractions are rejected for this architecture
slice:

- `Db.make`
- `DbClient.make`
- shared-domain `DatabaseError`
- shared-server `DbRepo.make`
- `@beep/pglite` as a production driver package
- `DrizzleProviderError`
- `ProviderError`
- `ORMError`
- `QueryError`

`DbRepo.make` is not ported. A successor is deferred until at least two real
repositories prove repeated boilerplate. Prefer a tooling generator or template
over a runtime factory unless live code proves that a runtime helper is simpler.

PGLite-specific tooling may stay in the test utility harness while it remains
useful for integration tests. That test harness does not imply a production
`@beep/pglite` package or a second database-driver doctrine.

Rationale:

The architecture already treats drivers as repo-level technical capability and
server packages as product adapter owners. A generic `Db` facade would blur that
boundary and make shared/server look like an infrastructure runtime. Specific
driver names keep imports honest, make error translation explicit, and let the
first real repositories drive any helper extraction with evidence.

## 2026-07-08: Use Upstream PGlite Without A Repo Driver Wrapper

- **Status:** Active
- **Amends:** 2026-04-27 Split Postgres And Drizzle Drivers From Product Repositories

Decision:

The repo does not publish or maintain an `@beep/pglite` driver package. PGlite
runtime composition uses upstream `@effect/sql-pglite` directly at the boundary
that owns the runtime:

- app-local runtime helpers may compose file-backed PGlite for an executable app
  such as Professional Desktop;
- `@beep/test-utils` may compose in-process PGlite for reusable SQL test
  harnesses;
- any `@effect/sql-pg/PgClient` compatibility shim required by
  `drizzle-orm/effect-postgres` stays private to the app/test composition
  boundary.

This narrows the earlier "PGLite remains only as a test-harness implementation"
wording. PGlite may be a concrete app-local runtime dependency when an app owns
the storage contract, but it still must not become a repo-level `drivers/*`
package or a reusable production database abstraction.

Rationale:

Effect now ships `@effect/sql-pglite`, so a Beep wrapper around the same client
would mostly preserve a compatibility cast and duplicate upstream lifecycle,
transaction, SQL error, LISTEN/NOTIFY, and data-dir helpers. Keeping upstream
PGlite composition at the consuming boundary preserves driver doctrine while
allowing Professional Desktop to keep its local-first file-backed database.

## 2026-04-27: Keep Shared Entity Metadata In The Shared Kernel

- **Status:** Superseded
- **Superseded-by:** [2026-08-13: Consolidate Persisted Entities On ProductEntity And Effect Drizzle](#2026-08-13-consolidate-persisted-entities-on-productentity-and-effect-drizzle)

Decision:

The product-facing shared entity vocabulary (`BaseEntity`, `EntityId`,
`EntityRef`, `Principal`, and source-kind vocabulary) remains in
`@beep/shared-domain` while it encodes shared product semantics: tenant
organization scoping, actor provenance, source facets, schema versioning, and
row versioning.

The generic persistence kernel belongs in `@beep/schema/EntitySchema`.
Persisted entities are schema classes whose decoded side is domain language and
whose encoded side is the persistence row shape. Entity-specific `.model.ts`
files inline rich `fields` and storage-neutral `persisted` descriptors together
so the domain shape, encoded shape, and persistence metadata drift at compile
time instead of through parallel mapping files.

`BaseEntity.Class` is the approved shared product class factory for invariant
entity fields. It composes shared product invariants into concrete entity
schemas, but it does not own the generic SQL projection.

`@beep/drizzle` `EntityTable.pgTableFrom` is the approved generic table
projection for schema-first entity classes. Shared table packages may use it to
publish metadata-only Drizzle table definitions for shared product tables, but
they do not own live database execution, transactions, repository helpers,
migrations, seeders, or driver runtime capability.

The old `EntityMixin` and `@beep/shared-tables/table/Table.make` APIs are
retired and should be deleted/replaced instead of migrated forward.

Rationale:

The Organization proof needs one deliberately shared entity concept whose
`orgId` tenant field, actor fields, entity-id metadata, schema metadata, and
table metadata stay consistent across shared-domain, shared-tables, and shared
UI. Splitting the generic kernel into foundation modeling and the Drizzle
projection into the driver package keeps product language pure while avoiding a
parallel domain-to-table mapping layer.

## 2026-05-01: Add Enforcement Lanes And Rough-Edge Refinements

- **Status:** Active

Decision:

The architecture standard now classifies high-risk rules with four enforcement
lanes:

- `Doctrine`
- `Generated Default`
- `Review Gate`
- `Hard Check`

This is a docs-only refinement. It does not implement generators, lint rules,
import-boundary checks, package metadata checks, or code migrations.

The refinement also locks the following doctrine:

- `foundation/capability` remains canonical but must pass specific-home-first
  routing plus a negative gate and proof.
- Meaningful high-bar `shared/*` exports require promotion records in the
  affected package README.
- `shared/use-cases` remains strict contract-only and does not own workflows,
  process managers, schedulers, handlers, concrete adapters, driver imports, or
  live Layers.
- New slices grow by incremental spine. New packages require a concrete role
  plus meaningful exported behavior, contract, adapter, config surface, or test
  fixture.
- App-level Layer composition may use app-local helpers such as
  `apps/<app>/src/runtime/Layer.ts`, but only for composition over public
  slice/package boundaries.
- The God Layer rejection test is Boundary + Ownership: app/runtime composition
  must not reach into private slice internals or own cross-slice policy,
  handlers, repositories, schedules, workflows, or orchestration.
- Migration language uses five buckets: `Target Doctrine`, `Transitional
  Compatibility`, `Cleanup-On-Touch`, `Forbidden In New Work`, and `Pending
  Automation/Generator Support`.
- Browser capability routing is platform-first: browser platform wrappers go to
  drivers with explicit `/browser` entrypoints, product-agnostic React
  ergonomics go to `foundation/ui-system`, and product-specific behavior stays
  in slice `client` or `ui`.

Rationale:

The architecture had strong direction but several social constraints were too
soft: "high bar", "avoid God Layers", target-first migration, and
`foundation/capability` all needed operational tests. The refinement preserves
the target doctrine while naming what belongs in future generators, future hard
checks, and present-day review gates.

## 2026-05-01: Lock Strict Action Errors And Fixture-First Proof

- **Status:** Active

Decision:

The architecture now treats public use-case errors as action-level failures
only. Driver/internal failures die in adapters, port failures die in use-case
orchestration, and public action failures die in protocol handlers. Port errors
may be declared in use-case packages, but they are server-only and do not cross
the public use-case API.

The executable proof target is `packages/architecture-lab/*` with
`apps/architecture-lab-proof`. It must remain the first place we prove boundary
subpaths, package shape, and port-to-action error translation before broad repo
automation or generator work expands the pattern.

The refinement also locks:

- `shared/use-cases` product ports are ultra-high-bar exceptions, even inside
  the high-bar shared-use-cases exception.
- Scratchpad and explicitly temporary `_internal` package experiments are valid
  learning lanes, but product packages must not import them and promotion must
  re-enter through the smallest legal slice shape.
- Protocol spans may be request trace roots; use-case spans are architectural
  roots inside them. Observability attributes must stay bounded and avoid PII,
  secrets, raw input, and large payloads.

Rationale:

The previous doctrine had the right direction, but "application errors" and
"port errors" were too easy to blur. A strict action-error boundary makes
client, handler, and use-case signatures easier to reason about and gives tests
one precise thing to prove. Keeping the proof fixture-first avoids turning
architecture prose into a wish list.

## 2026-05-01: Retire Assistant Bundles From Architecture

- **Status:** Active
- **Supersedes:**
  - [2026-04-23: Add Explicit Non-Slice Artifact Families](#2026-04-23-add-explicit-non-slice-artifact-families)
  - [2026-04-23: Give Every Non-Slice Artifact A Family And, When Applicable, A Kind](#2026-04-23-give-every-non-slice-artifact-a-family-and-when-applicable-a-kind)
  - [2026-04-23: Keep Agent Content Portable And Runtime Wiring Declarative](#2026-04-23-keep-agent-content-portable-and-runtime-wiring-declarative)

Decision:

Assistant runtime configuration is no longer an architecture family, package
family, or topology taxonomy in this repo. The canonical non-slice families are
now only:

- `foundation` for domain-agnostic reusable substrate
- `drivers` for flat repo-level external boundary wrappers
- `tooling` for developer-operational code packages

*(Amended 2026-08-10: the family list above is superseded — `ecosystem` was
added as a fourth canonical non-slice family; see the 2026-08-10 entry "Add
The `ecosystem` Package Family". The retirement of assistant bundles itself
stands unchanged.)*

Runtime-specific assistant files may exist only as normal harness-native
configuration, such as Claude project settings or skills. They are not
workspace packages, do not carry `beep` family/kind metadata, and are not part
of the package dependency model.

Rationale:

Claude, Codex, and similar harnesses are changing faster than this repo should
architect around. Treating their project configuration as first-class repo
architecture created extra maintenance without improving product boundaries.
The architecture should describe durable code ownership; harness configuration
should stay minimal, runtime-native, and easy to delete.

## 2026-05-12: Supersede Fixture-Lab With Architecture-Lab WorkItem Proof

- **Status:** Active
- **Supersedes:**
  - [2026-05-01: Lock Strict Action Errors And Fixture-First Proof](#2026-05-01-lock-strict-action-errors-and-fixture-first-proof)
    only for the executable proof target.

Decision:

The canonical executable proof target is now the normal
`packages/architecture-lab/*` slice family with the `apps/architecture-lab-proof`
contract harness. `WorkItem` is the full aggregate proof at
`aggregates/WorkItem`, `Worker` is the persisted entity archetype at
`entities/Worker`, and `WorkPriority` is the domain-only value archetype at
`values/WorkPriority`.

The old `fixture-lab/Specimen` proof and repo-architecture-automation fixture
are retired as active topology. Retained lessons live in
`goals/canonical-slice-factory/history/repo-architecture-automation-reference.md`;
the deleted package and fixture files are available only through git history.

The strict action-error doctrine from 2026-05-01 remains active: driver/internal
failures die in adapters, port failures die in use-case orchestration, and
public action failures die in protocol handlers. The new proof target exists to
make that doctrine reproducible through the `beep architecture` operation-plan
factory instead of a drifted fixture.

Rationale:

`fixture-lab/Specimen` no longer matched the normal slice topology the repo
wants agents and generators to copy. A boring lifecycle aggregate inside a real
slice family gives the factory a better oracle: domain, use-cases, config,
server, tables, client, UI, app harness, and db-admin migration proof can all be
checked as staged architecture parts.

## 2026-05-09: Model Finite Cases As Discriminated Unions

- **Status:** Active

Decision:

Finite data cases are architecture-visible domain modeling, not incidental
object optionality. When a shape represents variants, lifecycle states,
status/result cases, or case-specific payloads, model it as a discriminated
union. Effect Schema models should use tagged unions: `S.toTaggedUnion("<field>")`
for normal discriminators such as `kind`, `type`, `status`, `profile`, or
`family`, and `S.TaggedUnion(...)` only for canonical `_tag` unions.

External wire contracts may still arrive as optional/nullish bags when
compatibility requires that shape. Those bags must be decoded or normalized at
the boundary into an internal tagged model before domain, use-case, driver, or
client behavior branches on the case.

This is doctrine and review guidance in the first initiative. It does not add a
hard scanner, generated-schema migration, or broad repository sweep.

Rationale:

Optional/nullish bags hide invariants: they let impossible payload
combinations typecheck, make lifecycle transitions harder to audit, and push
case semantics into scattered branches. Tagged models make the finite set of
cases executable, branchable, decodable, and documentable from one schema. The
architecture already treats schemas as executable contracts; finite cases need
the same runtime evidence as ordinary object fields.

## 2026-05-20: Stack Installer Pre-v1 Slice

- **Status:** Retired 2026-06-15

Decision:

Stack Installer used one installer slice before v1. That slice and app have
since been removed from the live workspace before any compatibility contract
was published.

The earlier category topology for `installer-dependencies`,
`installer-security`, `installer-providers`, `installer-channels`, and
`installer-workspace` is retired as target topology. Those names may remain in
historical initiative outputs as evidence of the earlier P1 state, but they are
not compatibility packages, sunset aliases, or desired v1 boundaries.

Waiver:

Because the correction happens before v1 compatibility exists, all known
consumers migrate in the same PR. No compatibility wrappers, re-export
packages, or sunset aliases are required. A dedicated installer config package
is deferred until real installer configuration exists; the current Bun version
contract remains installer-owned without creating a premature config package.

Rationale:

The category names describe installer concepts, but they do not yet have
independent product lifecycles. Splitting them into sibling slices before v1
adds package coordination and migration surface without proving separate
bounded contexts. One installer slice keeps the domain/use-case/server boundary
strict while letting the future promote a category only when it earns a
separate lifecycle.

## 2026-05-22: Canonize Namespace-First `@beep/schema` Concept Modules

- **Status:** Active

Decision:

`@beep/schema` uses namespace-first concept modules as the canonical topology
for reusable schema concepts. Public concept subpaths are flat, for example
`@beep/schema/Duration`, `@beep/schema/Glob`, `@beep/schema/Color`, and
`@beep/schema/HttpStatus`. Consumers import those modules as namespaces and use
concise role members such as `Schema`, `Input`, `FromInput`, `Object`, and
`Unit`.

The package root remains a curated flat facade for convenience and migration
compatibility. It is not the canonical namespace surface. Concept role files
live under `packages/foundation/modeling/schema/src/<Concept>/` and are source
topology only; public consumers import the concept index. Utility namespaces
such as `SchemaUtils` may expose helper leaves when the helper is itself the
public concept.

Former topical suites are represented by leaf concept modules, not broad suite
aggregators. Import `@beep/schema/EvmAddress`, `@beep/schema/DomReactNode`, or
`@beep/schema/HttpStatus` directly instead of importing retired aggregators
such as `@beep/schema/Blockchain`, `@beep/schema/Dom`, or
`@beep/schema/Http`. Promote source concepts rather than every exported symbol;
for example, `HttpStatus` remains one concept module rather than a public
subpath per status literal.

Migration is compatibility-first. Legacy root exports, full repeated names such
as `DurationInput`, and existing nested paths may remain while consumers move
to canonical flat concept modules. Broad `./*` wildcard export reliance should
be retired only after explicit canonical and compatibility subpaths exist.

Rationale:

Effect-style module consistency is valuable because it lets reusable modules
share names like `map`, `Schema`, `Input`, or `FromInput` without forcing global
symbol uniqueness. The repo should keep that consistency without adopting very
large source files. Small role files under concept folders preserve the
architecture's context-compression benefits for coding agents and reviewers,
especially because `@beep/schema` carries heavy documentation.

## 2026-05-22: Close `@beep/schema` Topology Compatibility

- **Status:** Active

Decision:

The `@beep/schema` topology migration is closed around PascalCase exact concept
modules. Lowercase topical source directories and public subpaths are retired:
do not restore paths such as `src/color/`, `src/http/`,
`@beep/schema/color`, or `@beep/schema/http/headers`. Public package exports for
schema concepts point at concept indexes only; role files under
`src/<Concept>/` are private source topology. Legacy acronym casing subpaths
such as `@beep/schema/ExpectCT` and `@beep/schema/XSSProtection` are retired in
favor of canonical concept casing (`ExpectCt`, `XssProtection`).

The package root remains a curated flat facade for common helpers and migration
aliases. Purposeful repeated names may remain inside canonical concept modules
when they keep current consumers clear during migration, such as
`Duration.DurationInput` beside `Duration.Input`. The broad package wildcard and
lowercase topical compatibility paths are not compatibility surfaces.

The repo enforces this closure with `bun run beep lint schema-topology`, which
checks `@beep/schema` source directories, package exports, public role-file
targets, retired casing aliases, and root `tsconfig` alias drift.

Rationale:

The compatibility-first phase let the repo introduce canonical modules without
blocking downstream consumers. Once the package exposed exact PascalCase concept
subpaths and tests/dtslint covered role-file privacy, keeping lowercase suite
paths became pure topology debt. Removing them makes `ls src` match the public
mental model, prevents case-only ambiguity, and gives agents a much smaller
navigation surface.

## 2026-06-18: Cross-Slice Consumption Of The Epistemic Boundary

- **Status:** Active

Decision:

A reusable, product-agnostic boundary realized as a slice — e.g. `epistemic`
(domain entities + use-case services + a live SHACL Layer) — stays a slice. It
cannot move wholesale to `shared/*` (no live Layers anywhere in the family;
`shared/use-cases` is contract-only) or `foundation/capability` (no domain-entity
ownership). A consuming vertical (e.g.
`law-practice`) crosses the boundary by tier:

- **Substrate** — domain-agnostic value shapes such as a char-offset anchor or a
  unit interval — is promoted to `foundation/modeling` (`@beep/provenance`
  `TextAnchor`, `@beep/schema` `UnitInterval`). Any slice's `domain` may import
  it directly.
- **Product-language vocabulary** that a second vertical types against — the
  `ClaimLifecycle` admission states — is promoted to `shared/domain` with a
  promotion record. Promote the minimum, not the whole model.
- **Mechanism** — the gate, projection, and transition services and their live
  Layers — stays in the owning slice. The consuming slice composes it at the
  use-cases/server tier via a documented **bounded exception** recorded in the
  consumer packet's Exception Ledger, until a third consumer justifies extracting
  a `shared/use-cases` contract (or emitted event) per
  `01-hexagonal-vertical-slices.md:71-74`.

Rationale:

This is the architecture's predicted "first contact" with cross-slice boundaries
(see Known Unknowns). The absolute rule — a slice `domain` imports only
shared-kernel plus `foundation/primitive|modeling`
(`01-hexagonal-vertical-slices.md:60-61`) — is honored with zero exceptions by
routing substrate to foundation and shared vocabulary to shared-kernel. The
softer cross-slice integration rule (`:71-74`) is bent only at the
use-cases/server composition tier, transparently and with a removal trigger,
rather than building a full shared contract for a single-fixture spike. This
keeps the just-shipped `epistemic` slice a slice while making `law-practice`
doctrine-clean at the domain tier, and gives every future vertical that consumes
a slice-shaped boundary a worked routing precedent.

## 2026-06-21: Remove Placeholder Shared-Kernel Packages

- **Status:** Active
- **Refines:** [2026-04-23: Allow `shared/use-cases` As A High-Bar Shared-Kernel Exception](#2026-04-23-allow-shareduse-cases-as-a-high-bar-shared-kernel-exception)

Decision:

Placeholder shared-kernel package directories are removed. The current
`packages/shared` inventory is only the packages with real surfaces:
`shared/domain` and `shared/tables`. `shared/config`, `shared/use-cases`,
`shared/client`, `shared/server`, and `shared/ui` remain reserved role names, not
package directories. `shared/use-cases` in particular does not exist yet because
no contract-only cross-slice surface has met the promotion bar.

Rationale:

Empty or nearly empty packages make the architecture look heavier than the code
really is. Keeping role names in the doctrine is useful; keeping placeholder
workspace packages is not. A future promotion PR can recreate the exact package
it needs, with a package README promotion record, generated identity composer,
workspace registration, tsconfig reference, and boundary provenance in the same
change.

## 2026-07-05: Repo Crispening — Family-Scoped Waves, Per-Owner Lint Ratchet, And The `getSomesStruct` Amendment

- **Status:** Accepted

Decision:

1. Family-scoped remediation waves (foundation → drivers → tooling →
   apps/slices) run under `goals/repo-crispening-orchestration` are sanctioned
   as a bounded exception to the cleanup-on-touch migration-bucket rule
   (`standards/architecture/README.md:48-52`): each wave is touch-scoped to one
   family, gated by `bun run beep yeet verify`, and ships as small per-package
   PRs. This is not a general license for family-wide sweeps outside that
   packet.
2. A per-owner blocking policy at `standards/schema-crispening.policy.jsonc`
   governs the four novel schema-first lint cards (`SFV4-fn-schema`,
   `SFV4-normalization`, `SFV4-null-return`, `SFV4-getsomes-struct`). Findings
   for those cards in families/owners marked non-blocking are exempt from
   `schemaFirstLintHasFailures`; a family flips to blocking only after its
   remediation wave is yeet-verify-green. This is the durable anti-regression
   ratchet.
3. Effect-first Laws 20 and 47 (and their mirrors in
   `standards/effect-first-development.md` and the schema-first skill) are
   amended: prefer `O.getSomesStruct` (`@beep/utils`) for heterogeneous
   Option-struct spreads; `R.getSomes` stays for homogeneous dynamic-key
   dictionaries. The repo-wide `R.getSomes` → `O.getSomesStruct` sweep may only
   run after this entry and the law amendment are merged to `main`.

Rationale:

These decisions were locked in
`goals/repo-crispening-orchestration/research/decisions-locked.md` (D1–D5,
G1–G7) after a grounded grill and are not to be reopened during packet
execution. `O.getSomesStruct` is literally `cast(R.getSomes(self))`
(`packages/foundation/modeling/utils/src/Option.ts:102`) — runtime behavior is
unchanged and the change is purely type-level, so amending the doctrine ahead
of any mechanical sweep costs nothing and prevents a repo-wide codemod from
running against stale guidance. The per-owner ratchet converts a one-time
cleanup into a permanent property: once a family is green, new PRs in that
family cannot reintroduce the smells the wave just removed.

## 2026-07-14: Narrow `ui-system` → `drivers` Edge, And Headless UI Kernels Anchor In `ui-system`

- **Status:** Accepted

Decision:

1. A `foundation/ui-system` package may depend on a `drivers/*` package under
   two constraints, and only these:
   - it may import the driver's browser-safe **pure root** — pure helpers,
     schemas, and service *tags* (e.g. `@beep/pretext` root:
     `FontMetrics`, `naturalWidth`, the `PretextCapture` tag);
   - it may default the driver's browser-safe **`/browser` layer** as an
     **overridable** dependency-injection default (e.g. a React adapter
     defaulting `PretextCaptureLive` while accepting a host-supplied capture
     layer).
   A ui-system package must never import or compose a driver's server-only or
   secret-bearing surfaces, must keep every live layer overridable by the
   consuming app, and must not re-export a driver's live layers as its own
   public API. The foundation dependency-ceiling table in
   `standards/ARCHITECTURE.md` is amended to match.
2. Headless UI kernels — repo-owned, product-agnostic UI substrate whose core
   is pure schema + geometry/state arithmetic with a separate DOM/React
   adapter (glossary: "Headless UI Kernel") — anchor in
   `foundation/ui-system`, not `foundation/modeling`, even when the kernel
   package itself contains no React. The purity boundary is expressed as a
   package boundary (kernel package with no react dependency; adapter package
   carrying the DOM/React surface).

Rationale:

The dock workspace substrate (`@beep/dock`, landed with this decision, plus
`@beep/dock-react`, its planned adapter — both graduating from
`scratchpad/dockview*` per `docs/product/workspace-substrate.md`)
computes title-width minima from `@beep/pretext` — a driver whose root is a
browser-safe pure surface by its own ratified entrypoint law. Without this
edge the kernel would have to hoist content-aware geometry out of the
substrate into every consumer, splitting the computable-geometry canon across
packages for no safety gain: the dangerous driver surfaces (server config,
secrets, live effects) remain forbidden, and live capture stays injectable.
Routing the pure kernel to `modeling` was rejected because the kernel is
reactive UI substrate (atom graphs, engines, policies), purpose-routed to
ui-system by the specific-home-first table; keeping kernel and adapter in one
family keeps the promotion story and dependency ceilings legible. This
resolves the known gap that ui-system had no vocabulary for headless kernels
and no lawful measurement edge.

## 2026-07-25: Foundation-Mediated Port Inversion Is A Legal Cross-Slice Mechanism

- **Status:** Active

Decision:

A slice may implement a `foundation`-owned port that another slice consumes,
without either slice importing the other. This is a third legal cross-slice
mechanism alongside emitted events and the future `shared/use-cases` contract
package.

It is admitted only when **all** of the following hold:

1. The port carries no product semantics — its types name no slice's language.
2. The port lives in `foundation/*` and satisfies that family's own admission
   rules.
3. Both slices import only `foundation`, never each other.
4. The implementing slice's Layer is bound to the consuming slice at an
   application entrypoint, per `ARCHITECTURE.md` app-entrypoint composition.
5. Neither slice names the other in code, package manifests, or project
   references.

The implementing and consuming packages each record the coupling in their
package README, naming the producer/consumer pair and the binding site. The
README record is the durable proof of the specific coupling; this entry is the
general rule.

If any condition fails, the coupling is a slice-boundary breach and must go
through events or contract promotion instead.

Rationale:

`10-cross-slice-coordination.md` governs cross-slice *product* coordination —
one slice's process invoking another's language — and names two mechanisms.
Neither describes the case where a slice supplies a policy decision for another
slice's surface through a product-neutral technical port. The first real
instance is the agent-execution-authority work: `ontology/server` consumes
`@beep/mcp-kit`'s `TierGate`, `epistemic/server` implements it, and the desktop
entrypoint binds them. `ontology` cannot learn that `epistemic` exists, and
`epistemic` cannot learn that `ontology` does.

This was already legal under the existing dependency rules — slice `server`
packages may import `foundation/capability`, and app-entrypoint composition is
explicitly blessed. But a reviewer applying `10`'s two-mechanism list reasonably
reads it as a breach, so the mechanism needed a name. The pattern will recur for
any slice-owned policy applied to another slice's surface.

Events were rejected as the general answer, not merely as this instance's
answer: a gate that must fail closed *before* an action runs is synchronous by
nature, and an emitted event cannot express "and do not proceed." Forcing this
shape through events would either lose the fail-closed property or reinvent
synchronous request/response over an event log. Recording the rule now is
cheaper than reversing it later, since a ban would require rewriting every such
binding.

## 2026-07-30: Complexity Ceilings Become Law, And Health Becomes A Baseline Ratchet

- **Status:** Active

Decision:

Function complexity is governed by two mechanisms, both driven by the ceilings
pinned in `.fallowrc.jsonc` `health` (law 23 in `standards/effect-laws-v1.md`;
the integers live in config, not prose):

1. **New and changed code** fails the existing blocking `audit` lane
   (`gate: new-only`) when a function exceeds a ceiling. The initial cognitive
   ceiling is 8; cyclomatic 20, CRAP 30, and unit size 60 are pinned at fallow's
   defaults so the effective gate is explicit in-repo.
2. **The inherited tail** is frozen by a committed regression baseline
   (`standards/fallow.health.regression-baseline.jsonc`) that the health lane
   compares against with `--fail-on-regression`; the lane promotes from advisory
   to blocking after three consecutive clean runs, following the
   `quality-gate-ratchets` promotion pattern. Baselines only shrink; each
   burn-down wave re-measures the baseline.

Escape hatches are governed: every inline `fallow-ignore-*` suppression carries
a `-- <reason>` (`require-suppression-reason: error`), and an honestly-complex
function gets a `thresholdOverrides` entry with `reason` and a review date
rather than a binary suppression. `goals/complexity-ceiling-burn-down` owns the
tail remediation (the 60 functions above cognitive 15, hotspot-ranked,
triage-first).

This entry closes the health-lane deferral recorded in
`goals/fallow-advisory-ratchets` ("recorded deferral until … calibration still
requires a health inventory").

Rationale:

The deferred calibration inventory now exists (2026-07-30 session): across
41,469 functions, p99 cognitive complexity is 6; a judged panel over the
marginal band found every honest best-version ceiling at or under 8 except two
outliers, while a 6-ceiling would force suppressions or crispen-violating
helper fragmentation on roughly a third of the 7–8 band. 8 is therefore the
tightest ceiling with near-zero false positives; 6 remains the revisit target
once the >15 tail is gone and suppression pressure at 8 is observed.

A gate alone was rejected because `new-only` attribution cannot see repo-wide
drift (the two existing `maxCrap` overrides exist precisely because attribution
mis-fires on import-suffix changes); a baseline alone was rejected because the
dead-code baseline demonstrated that a written-but-never-read snapshot enforces
nothing. The pair — gate for the margin, ratchet for the mass — is the same
division the dead-code campaign proved.

## 2026-08-03: Retire The Tstyche Type-Test Surface

- **Status:** Active

Decision:

beep-effect removes the tstyche/dtslint type-test surface entirely: all
`*.tst.ts` files, per-package `dtslint/` directories, sentinels, and scripts,
the root `tstyche.json`/`tsconfig.dtslint.json` configs, the Turbo `type-test`
task, the `quality dtslint-tsgo` lane, the `--types` test selection, and the
create-package/tsconfig-sync/architecture generator support for them. The
architecture proof surface is runtime tests only. The type-level guarantees
lost are recorded per file in
`goals/quality-speedup/research/data/tst-coverage-assessment.tsv`; porting any
of them to a compile-only surface is deliberate future work triggered by an
actual type-level regression, not maintained insurance.

Rationale:

Measured cost versus proof value (`goals/quality-speedup`): ~110s of serial
lane time per full local verify (dtslint-tsgo 49.9s + type-test sweep 59.9s),
the fleet's #2 cumulative Turbo task sink (`@beep/repo-cli#type-test`, p50
35s, 3.7% cache-hit), 22 package scripts, three generator code paths, and
~330 tracked files — against a surface whose hosted execution hid inside Test
Unit and whose local lane ran on every root check. The per-file coverage
assessment found 117/142 files carrying unique type-only assertions; the loss
is accepted, documented, and reversible from git history plus the committed
ledger. Supersedes the 08-testing promise that the architecture proof carries
focused type tests.

## 2026-08-08: Top-Level research/ Owns Machine-Generated Intel Packets

- **Status:** Active

Decision:

beep-effect adds a top-level `research/` directory owned by the nightly
autonomous research routine: dated immutable packets
(`research/<YYYY-MM-DD>/` with `REPORT.md`, `SOURCES.md`,
`SUGGESTED_ACTIONS.md`, `PROMPT.md`, `claims.jsonl`, `RUN.json`) plus
single-writer cross-run state under `research/ledger/`. The routine extends
the existing `beep research` CLI family under a `nightly` sub-namespace
(schemas co-located with the family in v1; claim tuples promote to
`@beep/epistemic-domain` in v2 behind a backfill go/no-go experiment).
Governing rules: per-packet truth with derived-only rebuildable indexes;
sanitize-at-write for scraped content with gitleaks fail-closed and a
`research/**` typos exemption; process-separation blinding (search/synthesis
stages receive no repo checkout; the writer composes from structured records
without a checkout; only the publisher touches the clone, scoped to the new
packet plus `research/ledger/`); no explorations
ceremony — `RUN.json.frictions[]` carries the friction receipts; machine
proposes / human admits (nothing auto-appends to `explorations/INBOX.md` or
`goals/`); PR-only delivery from a dedicated clone. Conventions authority:
`research/README.md`. Work packet: `goals/nightly-research-routine`.

Rationale:

The nightly packets are a different trust domain from both neighbors: public
and repo-tracked (unlike the private out-of-repo vault the `beep research`
family already manages) and machine-generated (unlike `explorations/`, the
human fuzzy front end whose ceremony — manifests, ATLAS sync, reflections —
encodes human judgment nothing automated performs). Reusing the `research`
noun inside one CLI family keeps a single discovery surface and reuses proven
plumbing (DuckDB catalog runners, markdown-truth/derived-index split, the
`install-timers` systemd precedent). Single-writer ledger placement avoids
hot-file merge conflicts by construction. Sanitize-at-write is mandatory
rather than scanner-exemption because republishing token-shaped scraped
strings in a public repository is a leak vector regardless of scanner
posture; gitleaks remains the fail-closed backstop that catches sanitizer
bugs.

## 2026-08-10: Add The `ecosystem` Package Family

- **Status:** Active

Decision:

beep-effect adds a fourth non-slice family: `ecosystem`
(`packages/ecosystem/<name>` = `@beep/<name>` = the npm name; flat, like
`drivers`). Members are repo-authored libraries built for external consumption
and consumed in-repo like any third-party dependency. The family charter is
`14-ecosystem-packages.md`: member `src/` and runtime manifest edges are
`@beep/*`-free while tests and `devDependencies` are unrestricted;
published-package standards supersede repo effect-first style laws inside
members; artifacts are ESM-only with strict exports maps,
`sideEffects: false`, `stripInternal` declarations, and peers-only runtime
dependencies; members stay `private: true` until upstream peers are stable.
Members run a member-scoped tstyche type-test lane created at package
creation — a deliberate, family-scoped exception to the 2026-08 repo-wide
type-test removal above, because a member's published `.d.ts` is its product
and a type-level regression is a user-facing break. This supersedes the
"now only" three-family clause of the 2026-05-01 "Retire Assistant Bundles
From Architecture" entry: the canonical non-slice families are now
`foundation`, `drivers`, `tooling`, and `ecosystem`. First member:
`@beep/effect-drizzle`, graduating from `scratchpad/bsl` — the exploration
was proven and merged in PR #651; the package move itself lands in the P1
phase of `goals/effect-drizzle-graduation`. It owns schema-derived
projection/DDL/repositories, while `@beep/drizzle` (drivers) keeps
execution — the shared-tables projection contract now points at
`@beep/effect-drizzle`.

Rationale:

The `scratchpad/bsl` experiment produced a library whose audience is the wider
effect ecosystem, not this repo's product. No existing family fits: `drivers`
wraps external engines for internal consumption, `foundation` is internal
substrate, and both may import `@beep/*` freely — the exact thread a published
artifact must not carry. Inverting the import polarity at a family boundary
makes publishability a structural property the repo can lint, rather than a
per-package promise. Family creation, polarity, style-law scoping,
artifact/peer/release/gate posture, and sequencing were locked by operator
grill 2026-08-10; the charter's promotion/demotion mechanics and release-lane
operational detail in doc 14 (including the operator-only `private` flip)
were authored in the P0 docs PR and ratified through its review. Execution is
tracked in `goals/effect-drizzle-graduation`.

## 2026-08-13: Consolidate Persisted Entities On ProductEntity And Effect Drizzle

- **Status:** Active

Decision:

The persisted-entity stack swaps `BaseEntity`, `EntitySchema`, the
hand-maintained `Model` and `VariantSchema` modules, and the `EntityTable`
projector for `@beep/effect-drizzle` plus the shared-domain `ProductEntity` kit.
Consolidated identity modules remain in `@beep/shared-domain/identity`; product
`.model.ts` files own their entity schema and SQL metadata, `.values.ts` files
own reusable supporting schemas, and `.behavior.ts` files own pure behavior.
Tables project a model with `toPgTable`.

The migration requires strict declarative DDL parity with the committed
baseline. Database-only policy that effect-drizzle does not declare—PL/pgSQL
append-only guards, triggers, named or exclusion constraints, partial indexes,
and GIN indexes—stays byte-owned by the custom migration. It must not be copied
into entity definitions.

Rationale:

One executable model should own domain decoding, persistence variants, column
metadata, and table projection. Removing the parallel metadata stack eliminates
drift while the byte-stable custom migration preserves database behavior that
belongs to PostgreSQL rather than the portable entity declaration.

## 2026-08-13: Promote The First Contract-Only `shared/use-cases` Surface

- **Status:** Active

Decision:

Create `@beep/shared-use-cases` with one promoted product contract,
`PromotionGate`. Client-safe request, subject, tenant, reason, and verdict
schemas publish through `/public` and the concept subpath; the Context service
tag publishes only through `/server`. The package exports no placeholder
aggregate/entity paths and owns no workflow, adapter, driver, or live Layer.
The gate request binds a subject derived by the trusted candidate-acceptance
host to that candidate's validated tenant scope. Vertical server adapters
resolve the pair together and return a total clear/blocked value; resolution
or policy failures map to a bounded opaque blocked reason.

Rationale:

The agent candidate-acceptance boundary needs a synchronous refusal immediately
before returning accepted output, while law-practice owns the derived candor
predicate. An event is too late, a direct slice import violates the acyclic
ceiling, and a shared law-named command/query/facade would expose the vertical
operation or own cross-slice workflow. The tenant-bound minimal port preserves
both ownership boundaries. The current repository has only a deterministic
fixture acceptance implementation and no production acceptance composition
root; promotion therefore proves that existing boundary and the fail-closed
vertical adapter without claiming live product protection.

## 2026-08-13: Establish `apps/labs/*` And Zero-Root-Churn Lab Registration

- **Status:** Active

Decision:

Law-abiding experimental applications live under `apps/labs/*`. Labs are
private executable workspaces, not a fifth non-slice family, architecture role,
Scratchpad sublane, or feature-flag experiment. They obey the full code law and
are exempt only from package ceremony through one-time path-scoped rules.

The labs root uses zero-root-churn registration: one workspace glob and one set
of gate scopes replace per-lab workspace, changeset, coverage, docgen,
Storybook, and CI rows. Registration geometry is the single declared surface
set interpreted forward by create-package, inversely by delete-package, and as
declared-versus-actual probes by doctor. Root TypeScript solution references
exclude labs; package-local checks and a visible non-required labs lane own
their typechecking. Lab identity composers remain real package composers in a
mechanically generated labs segment. Labs never publish `@beep/*` APIs, add
tables to `packages/*/tables`, or become dependencies of product slices.

Rationale:

The architecture north star already requires experiments to be easy to create,
easy to delete, and production-shaped. Scratchpad makes creation cheap by
relaxing laws; ordinary apps preserve laws but accumulate shared registration
and deletion ceremony. The labs convention combines full code-law fidelity
with path-derived ceremony exemption, while registration geometry makes
deletion completeness testable instead of relying on a parallel hand-written
checklist. Keeping the CI lane non-required prevents a stale lab from blocking
unrelated upstream work, while requiring the lab's own PR to pass preserves the
claim that it is a faithful proving ground.

## 2026-08-24: Tagged Errors Declare Diagnostic Equivalence

- **Status:** Active

Decision:

Every `S.TaggedError` class declares a fields-only `toEquivalence` annotation
at the class declaration. The comparator defines diagnostic identity from the
declared stable fields and excludes opaque `S.Defect(...)` values. Tests and
consumers use `S.toEquivalence(ErrorClass)` without local overrides.

The schema-first rule `SFV4-tagged-error-equivalence` blocks untracked new or
changed declarations. Existing declarations enter
`standards/schema-first.inventory.jsonc` as exceptions through
`bun run beep lint schema-first --write`, then leave the inventory as the
burn-down adds declaration-level comparators.

Rationale:

Without a declaration annotation, Effect v4 falls back to `Equal.equals` for
the error declaration. That comparison includes `Error` runtime metadata such
as line, column, message, and plain arguments. Issue #677 demonstrated that
field-equal errors could then compare unequal according to source position and
property-test seed. A declaration-level comparator gives every consumer the
same stable diagnostic identity.

This supersedes test-local equivalence overrides and the prior implicit
acceptance of `S.TaggedError`'s declaration fallback.

Amended 2026-08-24 (same day, after the non-driver burn-down): the declaration
adopts its struct equivalence through `$I.annoteError<Self>(...)` rather than a
hand-derived comparator. Effect already passes the declared `TaggedStruct`
equivalence to the `toEquivalence` hook, so the per-class `*Fields` constant,
`S.toEquivalence(S.TaggedStruct(...))` comparator, and explicit
`annoteClass<S.declare<Self>, ...>` type arguments were re-deriving what the hook
receives; across ~390 declarations they also registered as Fallow clones, grew a
consumer bundle, and produced a base-type cycle under docgen's `tsc`. Opaque
causes use `Defect` from `@beep/schema`, whose schema declares an always-true
equivalence, instead of per-class exclusion. The detector accepts the
`annoteError` call as the compliant form.

## 2026-08-24: Local Coverage Baseline Regeneration Holds Unchanged Packages

- **Status:** Active

Decision:

The hosted Coverage Regression lane is the authority for the floors in
`standards/coverage.regression-baseline.jsonc`. An unscoped local
`bun run coverage:baseline:write` therefore adopts this run's measurement only
for workspace owners of the changed files (`TURBO_SCM_BASE` or the
`origin/main` merge-base through `HEAD`, plus the dirty worktree), using the
same owner mapping as `--affected` coverage. That adoption set is collected
for every changed file even when another path causes the planner's `full`
verdict. Every other committed package row is held verbatim; packages with no
committed row are added; packages that left the workspace are pruned. A `full`
verdict changes what the run measures, never what the writer adopts.
`--replace-all` is the only whole-document replacement path. The writer
reports the replaced/held/added/pruned split and any full-run reasons on every
write.

Rationale:

Local and hosted measurements disagree for environment-dependent files in both
directions: local runs raised `EnvConfig.ts` floors the hosted runner could
not reach (the lane failed on a different unrelated row after every push) and
lowered `BunResolver.ts` branch floors with an identical uncovered count (a
loosened ratchet a reviewer had to catch). A `min(local, committed)` rule keeps
the second defect, so the writer holds rows instead of merging them. Package
granularity is deliberate: per-file holding inside a changed package cannot be
reconciled with that package's measured aggregate, so environment-dependent
rows inside a changed package are still pinned to the hosted figure by hand.
Over-holding after a global input change is visible immediately in the hosted
lane and can be corrected by scoping that package into the adoption set;
silently replacing every measured row would instead import unrelated local
environment drift across the document.

This supersedes the prior unscoped-regeneration behaviour, which replaced every
row from the local run.

## 2026-08-24: Pull-Request Coverage Scope Measures Workspace Dependents

- **Status:** Active

Decision:

The `--affected` coverage planner selects, in addition to the directly changed
coverage owners, every coverage-bearing workspace package that transitively
depends on a changed owner whose non-test files changed. Dependency edges are
the workspace-internal names in all four `package.json` buckets, inverted from
the shared owner inventory (`CoverageScopeOwner.workspaceDependencies`). A
change confined to a package's `test/` tree seeds no dependents. Lab packages
and packages without a coverage task are walked through but never selected;
the repository root is not an owner. The selected scope is the union, with the
dependents recorded separately, and it is the exact set the ratchet compares
and the completeness check requires. Selections heavier than the proven
single-invocation budget execute like the full lane (one prebuild filtered to
the selection, then weighted `--only` shards, empty shards dropped). Baseline
adoption is unchanged by this decision: an unscoped `--write-baseline` still
adopts only the direct owners of the changed files, while a scoped write
(`--filter` or `--affected` with `--write-baseline`) merges every row it
measured — dependents included — because the operator asked for exactly that
scope. (Corrected 2026-08-25: the original text claimed dependents were never
adopted, which was true only of the unscoped writer.)

Rationale:

A direct-owners-only selection let `@beep/md` change go green in 110 s while
the dependent `@beep/pandoc-ast` row dropped; the drop surfaced only in the
full run on `main` after the merge and cost seven red `main` pushes plus three
inherited pull-request reds before a hand fix (#780 → #783). The dependent's
measurement is a consequence of the change under review, so it belongs on the
pull request. Test-only changes cannot alter what dependents import, so
widening on them would only spend the lane. The width guard exists because
dependents make wide selections routine — the seven foundation packages close
over at least 111 of 128 owners and `@beep/md` alone over 18 — and the full
lane's prebuild-plus-capped-shards shape is the one hosted memory ceilings
were proven against. Adoption stays narrow so that a dependent's legitimate
drop is a visible decision (hand-pin the row or scope it explicitly) rather
than a silent import of downstream drift; widening adoption to dependents is
deferred to the comparator-policy decision.

This supersedes the direct-owners-only selection introduced with the
weighted-shard pull-request scoping.

## 2026-08-25: Row-Only Baseline Edits Are Validated By Measuring Their Packages

- **Status:** Active

Decision:

The committed coverage baseline stays a global coverage input, with one
carve-out: when the pull-request planner can read both the base revision and
the working copy of `standards/coverage.regression-baseline.jsonc` and finds
that only `packages` rows differ, it selects the packages those rows name and
measures them instead of the full workspace. A row for a package that cannot be
measured (no coverage task, or a lab) forces the full run; a row for a package
that left the workspace needs no run. Any change to `epsilon`, `minimum`,
`exemptions`, or `follow_ups` — or a side that cannot be read or decoded, or a
legacy schema-v1 document — keeps the full-run behaviour. Provenance fields
(`generated_at`, `git_sha`, `command`) never affect the verdict and are ignored.
The ratchet's failure output ends with a remediation block that names the
scoped regeneration command for exactly the regressed packages, and the
baseline header advertises that scoped form ahead of the whole-document one.
`standards/**/*.md` is coverage-inert; the `*.jsonc` policy inputs under
`standards/` remain global.

Rationale:

Regenerating one row used to cost the full lane twice: the agent ran the
repo-wide writer locally (the only command anything pointed at), and the
resulting baseline commit was itself a global input that forced the 9–15
minute full fallback on the PR. That loop produced 39 baseline commits in 90
days and, before B9, minted floors the hosted runner could not reach. A row
edit is a claim about one package; measuring that package is the smallest
proof that validates it, and a change to how every row is judged is the only
edit that genuinely needs every row measured. Documentation under `standards/`
was already inert in every other lane; it forced two full coverage runs during
B10 purely by path.

This supersedes the unconditional global-input treatment of the baseline file
in the pull-request planner.

## 2026-08-27: Same-Repository Pull Requests May Read the Turbo Remote Cache

- **Status:** Active

Decision:

Pull-request jobs whose head repository is this repository receive the read-only Turbo token and
`TURBO_CACHE=local:rw,remote:r`. Fork pull requests remain tokenless and local-only. Pull-request
jobs never receive write capability, never use `pull_request_target`, and the Lambda authorizer's
GET/HEAD-only token policy remains the server-side boundary. Main pushes retain `remote:rw`.

Rationale:

The cache service and its read token were designed for untrusted downloads; the read token cannot
poison artifacts. Keeping same-repository work cold discarded main's warmed graph and made every
required lane repay identical work. Fork isolation bounds token disclosure and download-abuse risk,
while server-side method enforcement and existing throttles remain defense in depth.

This supersedes the temporary policy that made every pull request local-only.

## 2026-08-27: The Goal Portfolio Index Is an Untracked Projection

- **Status:** Active

Decision:

`goals/INDEX.md` is removed from version control and ignored. Goal manifest state is authoritative;
the CLI generates the index on read, during repair, and at session bootstrap. CI regenerates and
validates the projection but never expects a committed copy. GitHub browsability of the derived
table does not outweigh its demonstrated merge contention.

Rationale:

Eighteen concurrent branches contested a file whose content is wholly derivable. A tracked
projection turns independent manifest edits into artificial conflicts and repeated merge-main
commits. Removing the projection deletes that serialization point without deleting authored goal
state; local readers still receive the familiar index.

## 2026-08-27: The Exploration Atlas Is an Untracked D3 Projection

- **Status:** Active

Decision:

`explorations/ATLAS.md` is removed from version control and ignored. The Atlas is generated
wholesale from normalized D3 state and may contain no authored doctrine. For a packet carrying
`ops/events/`, status, `furthestStage`, and `resumeStage` come only from the PacketCore fold; an
invalid or forked opted-in stream fails closed and never falls back to its manifest. While the
ratified Amendment G stream freeze remains in force, a packet without a stream uses its manifest
status and stage as an explicit adoption snapshot, with both D3 stages initialized to that stage.
Stream opt-in permanently retires that transitional authority for the packet.

The same projector owns the marked `Stage:` and `Status:` region in every exploration README.
Authored Trail, Next Open Question, and surrounding packet prose remain tracked. `--check` rejects
underivable packets, README-region drift, and any present local Atlas whose bytes differ from the
whole-file projection; absence of the ignored Atlas is valid.

Rationale:

The former tracked Atlas mixed navigation with authored summaries and created merge contention.
Making the whole file derivable removes that serialization point, while generated README regions
close the second drift surface ratified by packet-system-redesign D6. The explicit adoption
boundary completes D6 without fabricating event history or violating the fleet opt-in freeze;
candidate `packet-convention-migration` still owns the honest stream-adoption campaign.
The retired Outcomes links remain canonical in the root product narrative and
`goals/agentic-professional-runtime/docs/product-vision-law-practice.md`; capability discovery
remains a live-source rule in `AGENTS.md`, and per-packet summaries remain in tracked READMEs.

## 2026-08-27: Required Contexts Report Success When a Goals-Only Change Skips Heavy Work

- **Status:** Active

Decision:

For pull requests whose complete changed-path set is under `goals/**`, every required GitHub context
still starts and reports a terminal success, but heavyweight setup and lane bodies are skipped. The
same pattern may extend to `explorations/**` only after its generated ATLAS contract is complete.
Path filters must not suppress an entire required workflow, because an absent status would block
the branch rule or silently weaken it if the rule were removed.

Rationale:

Packet lifecycle flips are documentation and manifest changes, yet they currently buy the entire
heavy suite and its coverage tail. The existing lane-gate success path preserves the required-
context contract while avoiding irrelevant compute. Central changed-path classification prevents
different jobs from inventing different definitions of a goals-only change.

## 2026-08-27: Stacked Pull Requests Remain a Manual Preview Workflow

- **Status:** Active

Decision:

Do not add `yeet publish --stack`. GitHub's official stack extension may be used manually for
bounded experiments, but Yeet publish continues to own exactly one reviewed head, pull request,
lease, closeout report, and merge-ready verdict. Revisit native integration only after the GitHub
feature is stable and Yeet can represent an exact-head proof for every layer without making each
code layer repay the full required suite.

Rationale:

The live two-layer trial created stack #861 with draft PRs #859 and #860, preserved the chained
base relationship through `gh stack sync`, and registered the required checks independently on
both layers. GitHub also rejected a direct base edit while the top pull request belonged to the
stack. The workflow is real, but mapping a multi-head unit onto Yeet's single-head artifacts would
either weaken proof or multiply CI cost. Both trial pull requests were closed and their branches
deleted without merging; the detailed receipt is in
`goals/ship-velocity/research/stacked-pr-trial.md`.

## 2026-08-27: Merge Queue Stays Off Until the Recorded Reliability Gate

- **Status:** Active

Decision:

Keep the `main` merge queue disabled and retain
`strict_required_status_checks_policy: false`. Re-evaluate only after a trailing 14-day
`check.yml` push window reaches at least 80% successful non-cancelled terminal runs. Before any
queue activation, add and prove `merge_group` parity for all required contexts, then evaluate the
strict-status-check flip first.

Rationale:

The live 2026-08-13 through 2026-08-27 window is 104 successes and 55 failures among 159
non-cancelled terminal runs, or 65.4%; another 25 runs were cancelled. The active ruleset requires
17 contexts, does not require strict up-to-date checks, and no current workflow handles
`merge_group`. GitHub documents that a queue without that trigger waits for required contexts
that never report. The packet's explicit reliability gate is therefore unmet, and enabling the
queue now would add synthetic-SHA CI cost before the underlying suite is reliable enough.

## 2026-09-02: In-Repo Deprecations Are Removed on Discovery

- **Status:** Active

Decision:

`@deprecated` on a repo-owned symbol that has never shipped in a release and has zero remaining
consumers is removed in the same change that finds it, together with its dependents. The
deprecation windows in `11-evolution-and-deprecation.md` continue to govern published and
cross-slice surfaces only. `@deprecated` is reserved for surfaces that still have consumers
needing a migration path.

Rationale:

The first real removal pass (2026-09-02) found 174 `@deprecated` tags across six workspace
packages, none with a live consumer, some tagged since 2026-04-30. Package versions are
changeset bumps recorded in-repo (`chore(release): version packages`), for example
`@beep/identity` and `@beep/repo-configs` at 0.1.1; every workspace is `private: true` and no
workflow publishes to a registry, so no version has ever reached a consumer outside this
repository. Counted in releases, "2 minor releases or 1 quarter" therefore never elapses and the
windows were holding dead surface open indefinitely. Removing on discovery keeps the window rule
meaningful where it protects someone and stops it from parking deletions where it protects no
one.

## Known Unknowns

Areas the doctrine does not yet cover and which the authors expect to revise as the architecture is load-tested:

- **Testing strategy.** Doc `08-testing.md` codifies slice-isolation testing, port stubs via `Layer.mock`, fixture ownership, and contract tests between use-cases and server adapters. The doctrine has not yet been load-tested against a real refactor; first contact with a non-trivial slice may surface gaps in the fixture-ownership and contract-test rules.
- **Cross-slice coordination.** Doc `10-cross-slice-coordination.md` codifies workflow / saga / process-manager governance, promoted event contracts in `shared/use-cases`, and the God Process Manager anti-pattern. `PromotionGate` is the first synchronous product port; the open question is how the rules hold up when a real workflow spans three or more slices with partial-failure semantics.
- **Evolution and deprecation.** Doc `11-evolution-and-deprecation.md` codifies slice retirement,
  `shared/use-cases` versioning, port deprecation, and feature-flag lifetime. The window question
  for unreleased in-repo symbols was resolved by the 2026-09-02 entry. The five-step slice
  retirement procedure remains unproven; the first real slice retirement will tell us whether
  the procedure creates useful pressure or just paperwork.
- **Observability conventions.** Doc `12-observability.md` codifies span naming, attribute conventions, the logging-vs-tracing-vs-Console split, and slice boundaries as span boundaries. The open question is whether the span/attribute namespacing survives contact with a real distributed trace across three or more slices, and whether the conventions need adjustment once a tracer backend is wired up end-to-end.
- **Error translation across boundaries.** Doc `09-errors-across-boundaries.md` codifies who translates, where translation lives, and the canonical translator function shape. The fixture proves port-to-action translation; the doctrine has not yet been exercised against a real driver-to-port adapter path. The first non-trivial adapter will tell us whether the translator placement rules are precise enough or need a worked example per boundary kind.
- **Promotion record enforcement.** Records are required by doctrine; lint enforcement (`lint:promotion-records`) is planned but not yet implemented.

Pull requests revising these areas should append entries here documenting the decision and removing the corresponding "planned" line.
