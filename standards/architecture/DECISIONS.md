# Architecture Decision Log

This log records closed architecture decisions for the hexagonal vertical slice
standard. Amend this file when the standard changes.

## 2026-04-21: Adopt Hexagonal Vertical Slice Architecture

- **Status:** Active, amended by 2026-11-18 "Slices Are Model-First Bounded
  Contexts In Four Packages": the seven-package family is the legacy shape

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
- **Amended by:** [2026-10-28: One beep App Composes beep-Prefixed Command Tools](#2026-10-28-one-beep-app-composes-beep-prefixed-command-tools)

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

The generic persistence kernel belonged in the @beep/schema/EntitySchema
subpath, since retired with the legacy entity stack in #720 (the ProductEntity
kit replaced it).
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

The old `EntityMixin` and @beep/shared-tables/table/Table.make APIs are
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
`@beep/schema/Glob`, `@beep/schema/Color`, and `@beep/schema/HttpHeaders`. Consumers import those modules as namespaces and use
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
`@beep/schema/HttpHeaders` directly instead of importing retired aggregators
such as @beep/schema/Blockchain, @beep/schema/Dom, or
@beep/schema/Http. Promote source concepts rather than every exported symbol;
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
@beep/schema/color, or @beep/schema/http/headers. Public package exports for
schema concepts point at concept indexes only; role files under
`src/<Concept>/` are private source topology. Legacy acronym casing subpaths
such as @beep/schema/ExpectCT and @beep/schema/XSSProtection are retired in
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
[goals/repo-crispening-orchestration/research/decisions-locked.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repo-crispening-orchestration/research/decisions-locked.md) (D1–D5,
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
Since 2026-11-07 the implementer is `execution-authority/server`: the
execution values left the epistemic slice in `goals/execution-authority-slice`,
and the binding site is unchanged.

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

2026-09-03 revisit result: retain the cognitive ceiling at 8. The refreshed
Fallow 3.22.0 scan found 49 functions above 15; the burn-down executed 30 real
refactors and retained 19 explicitly reviewed cohesive boundaries, with no new
inline suppressions. That remaining exception pressure is evidence against
lowering the ceiling to 6 now. Revisit 6 only after the dated overrides have
cycled through review and the blocking health ratchet has accumulated enough
change history to distinguish durable pressure from the inherited tail.

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
[goals/quality-speedup/research/data/tst-coverage-assessment.tsv](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/quality-speedup/research/data/tst-coverage-assessment.tsv); porting any
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

## 2026-09-12: Schema Classes Derive Equivalence By Construction

- **Status:** Active
- **Supersedes:** 2026-08-24 Tagged Errors Declare Diagnostic Equivalence

Decision:

No Schema class (`S.Class`, `S.TaggedClass`, `S.Error`, `S.TaggedError`)
declares a class-level `toEquivalence` annotation. Effect derives a class's
equivalence from its declared field struct by construction
(`effect@4.0.0-rc.113`, upstream `84864bc30c`, "Fix Schema class equivalence
derivation"), so `S.toEquivalence(ErrorClass)` already compares declared
fields only and ignores `Error` runtime metadata. `$I.annoteError` returns
identity metadata and documentation extras and installs no hook; the
`adoptDeclaredFieldsEquivalence` and `declaredFieldsEquivalence` helpers are
deleted. A field that must not take part in identity declares an always-equal
equivalence on its own schema (the Defect wrapper from @beep/schema, since
retired in #1347 for `S.Defect` with `S.overrideToEquivalence`, or
`S.Unknown.annotate({ toEquivalence: () => () => true })` for a local opaque
payload); nothing is excluded at the class.

The schema-first rule `SFV4-tagged-error-equivalence` is inverted: it now
reports a `toEquivalence` key reached from the annotations argument of any
Schema class factory call, including through a referenced annotation record.
Intentional divergences enter `standards/schema-first.inventory.jsonc` through
`bun run beep lint schema-first --write` with a justification.

Amended 2026-09-29: the `SFV4-tagged-error-equivalence` rule is retired by
the `effect-schema-parity` P4 gate cut (the F26 correction in that
exploration's "First gate cut" ruling, 2026-09-14). The derived-equivalence
decision above stands; only the lint is gone. The always-equal field recipe
moves to the upstream form,
`S.Defect(options).pipe(S.overrideToEquivalence(() => () => true))` or the
same override on `S.Unknown`, because `Defect` and `OpaqueUnknown` from
`@beep/schema` retire with the Opaque concept under
"2026-09-29: Upstream-First Foundation/Modeling"; the schema-first rule
`SFV4-opaque-wrapper` tracks their remaining uses.

Rationale:

The 2026-08-24 rule encoded a premise that upstream removed two RCs later. A
lint that demands the hook teaches every new error class the wrong thing and
hides the derived law behind a ritual. The 60-seed by 400-run measurement on
`packages/drivers/doc-text` that motivated the hook (682/24,000 unequal on
rc.109 without it) reports 0/24,000 on rc.113 with the hook deleted
([goals/tsgo-045-effect-idiom-sweep/history/2026-09-12-annote-error-proof.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/tsgo-045-effect-idiom-sweep/history/2026-09-12-annote-error-proof.md)).

## 2026-08-24: Tagged Errors Declare Diagnostic Equivalence

- **Status:** Superseded by 2026-09-12 (Schema classes derive equivalence by construction)

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
causes use the Defect wrapper from @beep/schema (retired in #1347), whose
schema declares an always-true equivalence, instead of per-class exclusion. The detector accepts the
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
[goals/ship-velocity/research/stacked-pr-trial.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/ship-velocity/research/stacked-pr-trial.md).

## 2026-08-27: Merge Queue Stays Off Until the Recorded Reliability Gate

- **Status:** Superseded
- **Superseded by:** [2026-11-09: Merge Queue Activation Is Gated On The Merge-Group Run](#2026-11-09-merge-queue-activation-is-gated-on-the-merge-group-run)

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

## 2026-09-03: Top-Level bots/ Owns Authored Bot Packs; Hosted Judgment, Local Proof

- **Status:** Active

Decision:

beep-effect adds a top-level `bots/` directory as the source of truth for
authored bot packs. Packs live at `bots/packs/<slug>/` with `manifest.json` and
`BOT.md`; environment-specific deployment configuration lives outside packs
under `bots/deployments/` or `$XDG_CONFIG_HOME/beep/bots/`, and may contain only
`op://` secret references. Runtime schemas, validation, rendering, dry-run
behavior, timers, handoff verification, and receipts belong to a planned
`Bots` command group in `packages/tooling/tool/cli`, following the automation
route in `07-non-slice-families.md`. The first pack PR creates the directory;
this decision creates no pack content.

The runtime is capability-split: hosted Grok Bot discovers and judges; GitHub
Actions senses deterministic repository and GitHub state; a local timer or
CLIProxyAPI proxy lane verifies checkout-dependent facts and is the only
publisher, through Yeet. Version one is proposal-only and may write reports,
GitHub issues, and handoff artifacts. A later pack may earn local, pack-specific
draft-PR authority after several clean deduplicated runs. Hosted connectors
never open pull requests, and merge authority is never delegated.

Public-safe hosted output crosses a GitHub-issue mailbox as a small envelope,
numbered JSONL parts with byte counts and SHA-256 digests, and a completion
marker. The local receiver verifies schema, part, record, and byte counts,
digests, completion, and redaction before model or publisher use; partial
recovery is rejected. Private records use a content-addressed local store.
Inline base64 or gzip prompt payloads are forbidden.

Bot evidence reuses `EvidenceReceipt`, `EvidenceDigest`, `EvidenceLadderState`, and
`RecoveryAttemptReceipt` from `@beep/skill-contract`. Every success, no-op,
partial, and failure persists a receipt outside the hosted UI's 20-run window.
The shared Bot VM receives provider OAuth only: no 1Password or publisher
authority; approval remains required for state-changing tools; external text is
data, not instructions; and a routine reading untrusted content must not also
hold secrets and state-changing tools.

Rationale:

The 2026-08-08 `research/` decision established that a new top-level root is
warranted when authored or generated repository truth has a distinct trust
domain and lifecycle. Bot packs have the same need for a stable repo-owned
source while deployment state and credentials remain environment-owned. The
research also found hosted routines arriving 10–37 minutes late, silent
successes, a 20-run UI window, shared-VM identity, connector uncertainty, and
duplicate scheduled pull requests. Separating hosted judgment from local proof,
failing closed on handoff integrity, reusing the existing receipt vocabulary,
and withholding publisher authority address those observed failure modes. Work
packet: `explorations/grok-bot-automation/`.

## 2026-09-11: Pull Requests Are Judged Against the Baseline Rows They Raise

- **Status:** Active

Decision:

On a base-pinned coverage run (`TURBO_SCM_BASE` set, which is every
pull-request run of the `Heavy / Coverage Regression` lane), the ratchet keeps
judging the measurement against the base revision's rows and additionally
judges every row the pull request raised against the pull request's own value.
A row is raised, per metric, when the branch's
`standards/coverage.regression-baseline.jsonc` carries a stricter floor than
the base revision's document: a higher percentage (beyond epsilon) or fewer
uncovered units. Package total rows and file rows are both covered. New files
already use the branch row and are not re-judged; rows the pull request lowered
or left unchanged are judged by the base floors alone. A raised row the lane
does not reach fails with the distinct reason `row raised beyond hosted reach`,
naming the row, the base value, the proposed value, and the measured value,
under its own section, with a remediation that says to set the row to the
measured value or lower. The scoped writer is not offered for that failure,
because a local regeneration is what mints such rows. The ok line reports how
many raised row metrics were judged. Runs without a pinned base (main pushes
and local runs) behave as before.

Rationale:

PR #1068 regenerated the baseline locally and raised the
`Lint/Lint.command.ts` and `Yeet/internal/Planner.ts` rows above what the
hosted lane measures. The pull-request run was green because it compared the
measurement against main's rows; main went red on the first push after the
merge and every later pull request inherited that red until a floor-restoring
PR landed. The lane had already measured both files on the pull request and
produced the exact numbers main later failed on, so the verdict was available
before the merge and simply not asked for. Judging only raised rows keeps the
one legitimate direction open: a floor-lowering fix proposes nothing stricter
than main and stays governed by the base comparison it was already subject to.
The predicate reused for the raised-row verdict is the same drop rule main
applies after the merge, so a pull-request pass on a raised row is a prediction
that main stays green on that row.

This extends the 2026-08-24 rule that the hosted lane is the authority for the
floors: a raised row is now proven by the hosted lane before it can merge.

## 2026-09-12: Pull Requests Lower Floors Only Where They Could Not Have Moved Them; Scoped Writes Hold Untouched Packages

- **Status:** Active

Decision:

On a base-pinned coverage run (`TURBO_SCM_BASE` set, which is every
pull-request run of the `Heavy / Coverage Regression` lane), a row metric the
pull request lowered is judged at the lowered value when the package could not
have moved it. Three questions decide that, all answered from the change set
the run already collects (`base...HEAD` plus dirty files):

1. the package owns no changed file, source or test, through the same
   ownership tables affected-scope planning uses, repository fixtures included;
2. the package is not a workspace dependent of a package that owns one; and
3. no changed path other than `standards/coverage.regression-baseline.jsonc`
   itself yields a full-run reason — a pull request that edits `vitest.shared.ts`,
   a tsconfig, `turbo.json`, `patches/`, or `.github/` gets no self-judging exit
   on any package.

Authorship is decided against the merge-base document, not the base tip: a row
is lowered by this pull request only when the workspace document is looser than
`git show <merge-base>:standards/coverage.regression-baseline.jsonc`. Reading
the tip would attribute every row `main` raised after the branch diverged to the
branch and silently downgrade floors the branch never touched. Both reads fail
closed: an unreadable merge-base document or an unresolvable change set leaves
every row at the base floor, which is the behaviour before this entry.

A lowered row on a package that is not self-judge eligible keeps the base floor
and its diagnostic names both the value the branch proposed and the witness that
withheld it (`package owns changed file X`, `dependent of @beep/y`, or
`global input Z changed`). Rows the pull request raised keep the 2026-09-11
verdict unchanged, and the raised and lowered rules never claim the same metric:
a row stricter than the base tip is the raised rule's. Policy fields (`epsilon`,
`minimum`, `exemptions`, `follow_ups`) stay sourced from the base document, so a
pull request cannot relax the tier or add a follow-up through its own copy. The
vanished-file rule and the tier minimum keep judging at the base floors: lowering
a row cannot make a disappearance benign, and the writer cannot lift a package
above the repository tier. A package present in the base document, measured by
the run, and absent from the pull request's document fails with the distinct
reason `package-row-removed`; the only sanctioned delete path remains the
workspace-removal subtraction.

Every lowered floor is reported — through the ratchet's tighten slot on a green
run and inside the regression block on a red one — with the base value, the
lowered value, and what the lane measured. When the lane measures strictly above
a lowered floor the line carries a `tighten` advisory naming the measured value.
A hard `row-lowered-below-reach` verdict is deliberately deferred until a week of
tighten lines is on record. Every path a failure reports also prints the row this
run measured, encoded through the same schema the committed document uses, so an
operator pastes hosted evidence instead of running a local writer.

A coverage baseline write — scoped or unscoped — now shares one plan. A scoped
write adopts a measured package only when it owns a changed file or is a
workspace dependent of one; an unscoped write keeps the 2026-08-24 rule and
adopts direct owners alone, because the seven foundation packages close over at
least 111 of 128 owners and one reflex regeneration must not import that much
downstream drift. Every other measured package holds its committed row
byte-for-byte, and a scoped run carries the committed rows it never measured.
`--replace-all` is valid on a scoped write as the deliberate re-measure path,
and every raise it records is judged on the pull request by the 2026-09-11 rule.
Each write reports its per-package disposition, says so loudly when it held
everything it measured, and names every value it raised above the committed
rows.

The full-coverage shards, scoped baseline writes, and the narrow ratchet
invocation all derive their Vitest passthrough from one function: file
parallelism on, worker count chosen from the packages the invocation measures.

Rationale:

Between 2026-09-10 and 09-12 the lane was red on `main` and on every pull
request because a local scoped `--write-baseline` (#1068) replaced the whole
`@beep/repo-cli` block with one workstation snapshot, raising two rows on files
that pull request never touched above what the lane measures. The restore PR
(#1090) was red on its own run because a base-pinned run judged every surviving
row at the base tip's floor, so no pull request could lower a floor. Zero of the
31 failed coverage jobs that week were memory failures. #1091 already fails a
pull request that raises a row beyond hosted reach; this entry closes the other
half of the deadlock and stops the reflex regeneration from rewriting untouched
packages. The topology unification removes the last way a writer and the lane
that judges it can disagree about how a row was measured.

Supersedes one clause of the 2026-09-11 entry: "rows the pull request lowered or
left unchanged are judged by the base floors alone" now holds only for unchanged
rows and for packages that are not self-judge eligible. Supersedes the
2026-08-25 sentence that the remediation "names the scoped regeneration command
for exactly the regressed packages": a drop on an existing row now prints the
measured rows and names no writer, and the scoped writer is named only for a new
file or a new package. The 2026-08-24 clause that an unscoped `--write-baseline`
adopts only the direct owners of the changed files stays exactly as written; a
scoped write is the one that also adopts dependents, and widening the unscoped
writer remains deferred. Everything else in the 2026-08-24, 2026-08-25, and
2026-09-11 entries stays active.

Remediation prose is pull-request prose only on a base-pinned run. An unpinned
run — a push to `main`, a local run without `TURBO_SCM_BASE` — prints neither
the measured-row proposals nor the self-judge paragraphs: a dropped row there
says to restore the coverage or open a pull request that lowers only those rows
to the values the run printed, which is the runbook line for a red `main`.

## 2026-09-12: Stale Ignored Projections Are Refreshed by Their Checks

- **Status:** Active (amends 2026-08-27 "The Exploration Atlas Is an Untracked D3 Projection")

Decision:

`beep explore atlas --check` and `beep goals index --check` keep proving that every projection is
derivable, and README-region drift still fails the Atlas check. A present `explorations/ATLAS.md`
or `goals/INDEX.md` whose bytes differ from the projection is no longer rejected: the check rewrites
the ignored file from the projection, logs the refresh, and succeeds. When README drift is refused,
a stale Atlas beside it is named, not rewritten. `--check` never writes a tracked file; `--write`
remains the only path that rewrites README status regions.

Rationale:

Both files are git-ignored workstation state, so no hosted lane ever carries one and the rejection
could only fire locally: every fast-forward that landed a packet manifest change left the local
copy stale and turned `bun run lint` red on a head CI had just proven green (acked as "stale local
INDEX.md" three times in the Yeet inbox). Rejecting the bytes protected nothing that refreshing does
not protect better: the projection may carry no authored doctrine, and overwriting an authored-into
copy enforces that rule instead of leaving the copy in place behind a red. The whole-file projection
contract is unchanged; only the remedy moved from the operator to the check.

## 2026-09-22: The Minimum Slice Count Is the Drawing Plus the Lab Census

- **Status:** Active

Decision:

`13-onboarding-the-minimum-viable-slice.md` no longer says a legal slice is
"~15 files." The notes drawing names 13 files. The architecture lab that was
built from that shape is a separate census: 7 packages, 168 tracked files, 68
under `src/`, from `git ls-files packages/architecture-lab` on this date. The
README known-unknowns opener now records that the lab exists, and it keeps
`lint:promotion-records` as planned because no lint command implements that
name.

Rationale:

The May 2026 opener said the standards had not been load-tested, and the
onboarding page asked a future contributor to check a number nobody had
counted. The lab is that contact for package shape and tests. It does not
settle promotion-record lint, a real cross-slice workflow diagnostic, the
published deprecation windows, span names in a live trace, or a new
contributor walking the drawing.

## 2026-09-29: Upstream-First Foundation/Modeling

- **Status:** Active (census rules amended 2026-10-22, "Upstream-First Census Amendments")

Decision:

`foundation/modeling` packages defer to upstream Effect facet by facet. A
concept retires unless the consumer lines that read its uncovered members
outnumber the lines that use its covered facets, construction included.
Retiring deletes its implementation, exports, and tests and moves every
consumer to the upstream API in the same PR, with no alias left behind (no
deprecation shim, re-export alias, or compat module). Otherwise the concept is
ADAPT: its covered facets are deleted the same way, in the PR that migrates
their consumers, and the rest stays. A new concept is not added where upstream
already covers its intent.

- Intent is judged per facet on the consumed surface: the schema value and
  each member or static consumers read. A facet is covered when public
  upstream API covers what consumers use it for, checked against the installed
  `effect` declarations (`dist/*.d.ts`); an `@internal` symbol never counts.
  The upstream API may live outside `effect/Schema` or be an inline
  composition at the consumer, such as `S.String.check(S.isPattern(...))`.
- A RETIRE with more than 100 audited consumers runs a facet census before its
  PR opens; the census and any flip to ADAPT are logged in the owning goal
  packet's decision log before the PR opens.
- Persisted and externally served encodings stay byte-identical, using an
  upstream variant or a consumer-local composition of upstream codecs. Only
  in-memory shapes may change, and consumers accept the behavior changes that
  come with them. A boundary whose upstream default differs and whose bytes no
  such codec reproduces is a separate migration goal. A field of a promoted
  `shared/use-cases` contract is the exception: its name, decoded type
  (brands included), accepted values, bytes and meaning all stay unchanged,
  and any change to them is a `V2` migration outside the retirement PR.

The operational rules are in `11-evolution-and-deprecation.md`, section
"Upstream-first retirement in `foundation/modeling`".
`goals/effect-schema-parity` applies them to `@beep/schema`, and each of its
PRs cites this entry by heading.

Rationale:

The 2026-07-08 PGlite decision declined a repo wrapper that duplicated an
upstream client. Modeling concepts follow the same reasoning: a local concept
that shadows an upstream one is a second owner for one capability, and it has
to be re-audited on every Effect snapshot bump. The 2026-09-02 entry removes
a symbol without a window when it has never shipped in a release and has zero
remaining consumers. `foundation/modeling` packages are private and have never
shipped, and deleting a concept in the PR that migrates its consumers meets
the zero-consumer half inside one change.

Intent is judged per facet because the first `@beep/schema` audit judged it on
the schema alone and ruled LiteralKit RETIRE. `S.Literals` does cover the
kit's schema, but a consumer census found its uncovered keyed members (`.Enum`
1,172 lines, `.is` 603, `$match` 243, `toTaggedUnion` 36) at 2,054 lines
against 2,048 for its covered facets (construction 1,521, `.Options` 395,
`.thunk` 65, `.pickOptions`/`.omitOptions` 52, `.HashSet` 15). LiteralKit is
therefore ADAPT: it keeps `Enum`, `is`, `$match`, `toTaggedUnion` and
`LiteralToKey`, and loses `Options`, `pickOptions`, `omitOptions`, `HashSet`,
`thunk`, `enumMapping` and the `M` type parameter
(`explorations/effect-schema-parity/DECISIONS.md`,
"LiteralKit reopened at decompose: ADAPT, not RETIRE", 2026-09-15). Byte
identity keeps data migrations out of retirement PRs.

Rejected: a rule in the `@beep/schema` README only (the other
`foundation/modeling` packages would keep hand-rolling); aliases or
deprecation windows for in-repo consumers (a kept alias is a second owner
under another name, and the 2026-09-02 entry found that release-counted
windows never elapse here); judging intent on the schema facet alone (it
would retire LiteralKit, whose uncovered keyed members carry 2,054 consumer
lines against 2,048 for its covered facets, construction included).

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

## 2026-10-09 — Private release-note reset

Private internal workspaces do not require or accumulate pending changesets.
The status gate reads `private`; versioned publish-enabled product workspaces
retain in-branch note requirements and existing explicit ignore exemptions.
The graph guard rejects notes naming live private workspaces. Root/unowned paths
have no independent note obligation; release impact is represented by the
changed publish-enabled workspace. Private deletion emits no empty note. A manifest omitting `private` is treated
as publish-enabled and requires the existing published-deletion override; all
152 live workspaces explicitly declare private true in the reset census.

The external-contract census precedes retirement in
[goals/repository-simplification-confidence/history/receipts/stage-2-policy.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-2-policy.md).
`standards/changesets.reset-baseline.json` records the parent and original tree
for recovery. Versions and package changelogs remain historical records.
The live `@beep/ontology` workspace is removed from the retired-name registry;
other entries guard name reuse, independently of pending release notes.

Publication stays dormant with its config, dependencies and changelog adapter
retained. Activation establishes release/versioning policy, audits external
contracts, flips `private: false`, reconciles ignore exemptions and restores
appropriate note requirements and publication workflow/hosted allowlist wiring.
Desktop manual versioning and `professional-desktop-v*` releases stay separate.
Reverse the reset with the baseline recovery commands and revert its policy PR.

## 2026-10-14: Plain Data Schemas Are Branded `S.Opaque`, And Every Schema Class Carries A Brand

- **Status:** Active

Decision:

A plain data schema is declared as
``class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...}))) { static ... }``.
Plain data means no instance members, not an error, not a persisted entity,
and not part of an `.extend` chain. Tagged data uses
`S.TaggedStruct("X", {...})` as the source and keeps `_tag`. Values are plain
objects validated by shape; the class supplies an opaque nominal type and a
place for statics. `X.make(...)` constructs, `new X(...)` is unavailable,
wider shapes spread `X.fields` or use `S.fieldsAssign(...)` because Opaque has
no `.extend`, and annotations go on the Struct inside the pipe because
`X.annotate(...)` returns a plain schema without the statics.

`S.Class`, `S.TaggedClass`, `S.Error`, and `S.TaggedError` stay for errors,
persisted entities (built on `@beep/effect-drizzle`), schemas with instance
members, and `.extend` chain roots and subclasses. Every `S.Class`,
`S.TaggedClass`, `S.Error`, `S.TaggedError`, and `S.Opaque` declaration carries
`{ readonly brand: unique symbol }`; a structural `{}` brand needs a documented
exception in `standards/schema-first.inventory.jsonc`.
`bun run beep lint schema-first` reports a new plain-data `S.Class`, and
`schemaClassMissingBrand` becomes an error at the `@effect/tsgo` 0.52 bump.
The migration, its codemod, and the decisions behind each case are in
[goals/schema-opaque-default/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/schema-opaque-default/SPEC.md), D1 to D8.

Rationale:

`S.Class` decodes to an instance and checks `instanceof` on the type side, so
a structurally valid plain object fails `S.is`, encoding, and `HttpApiClient`
payload encoding, and `structuredClone` or `postMessage` strips the class. The
2026-10-13 census found 93% of 6,736 non-error schema classes with empty
bodies, no `instanceof` checks against them, and about three `new` calls, so
the class buys nothing at runtime for almost all of them. `S.Opaque` keeps what
the class was chosen for, an opaque type and statics, and validates by shape.
Without a brand both forms are structural, which is why the brand is part of
the rule rather than an option.

Rejected: `S.Class` plus a brand everywhere (the instance check and its
plain-object failures stay); plain `S.Struct` with a same-name type alias
(loses the opaque type and the statics, and the schema-first lint already
rejects exported object structs). Consequences: runtime values of converted
schemas change from class instances to plain objects, so `Equal.equals`
between a decoded value and a plain literal now holds; error, entity,
behavior, and `.extend` classes are unchanged apart from the brand; moving
plain-`S.Class` persisted rows onto the `@beep/effect-drizzle` kit is a
tracked follow-up. Reverse by running the codemod in Opaque-to-Class mode or
reverting its PR.

## 2026-10-20: Every Entity Row Write Compares And Increments `rowVersion`

- **Status:** Active

Decision:

`EntityKit.baseColumns.rowVersion` is the optimistic-concurrency token:
`RowVersion.pipe(Pg.integer(), Pg.default(1), Pg.version())`. A row starts at
`1` through the SQL default and every committed UPDATE of an entity row stores
the next value. Full-entity repository writes treat the entity's own
`rowVersion` as the expected value, put `row_version = $expected` in the same
`WHERE` clause as the id (and tenant) predicate, and fail with the port's typed
`<Port>VersionConflict` when no row matches but the row exists.
Read-modify-write methods expect the version they read. Predicate-guarded and
single-column writes keep their predicates and still add
`row_version = row_version + 1`. The only exemption is an UPDATE of a row the
same transaction inserted. In-memory adapters implement the same contract.
Repositories stay on the Drizzle query builder; `@beep/effect-drizzle`
`makeRepository` is not adopted, and upstream `SqlModel` soft delete is not
used. Decision log and write-path inventory: [goals/entity-optimistic-concurrency/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/entity-optimistic-concurrency/SPEC.md)
(D1 to D4) and its `PLAN.md`.

Rationale:

Blind by-id updates let two writers that read the same row both succeed, and
the second silently reverted the first (a provider probe reverted a
configuration update that landed while it ran). One schema-owned token, one
guard shape, and typed per-port conflicts make that race visible to the
caller. The guard is sound only while no write leaves the token unchanged,
which is why the bump applies to every UPDATE. `makeRepository` would need
SQL name transforms no production layer sets, has no
tenant predicate, and refuses the `columnName` overrides the kit uses for
`entityType` and `publicId`. Reverse by restoring the
explicit `VariantField` for `rowVersion`, dropping the `DEFAULT 1` in a new
migration, and removing the guards.

## 2026-10-20: Single Public Origin beep-effect.com; Apex Hosts Projections, /ns/ Reserved

- **Status:** Active

Decision:

`beep-effect.com` is the single public origin for everything the repo projects
to developers and agents. The apex hosts ring-0 projections of the public
substrate only. The `/ns/` path is reserved forever for identity dereference:
once a deployment goal ships it, it will serve the exact registry behind every
IRI minted under the identity authority `https://beep-effect.com/ns/`; until
then the IRIs are names, not dereferenceable URLs. `/taxonomy` is the HTML discovery
projection of that registry, kept separate from dereference. Subdomains are
for services and instances that are not projections: a practice instance, the
proxy, anything authenticated. `www` will redirect to the apex (infra, a
later deployment goal).

The reserved v1 route table is `/ns`, `/taxonomy`, `/docs`, `/api`,
`/storybook`, `/llms.txt`, `/mcp`, `/labs/<name>`, `/goals`, `/explorations`,
`/research`, `/.well-known/*` and `/sitemap.xml`. Routes are reserved now and
deployed later, one follow-on goal per surface. `/api` serves the Scalar docs
for every HttpApi contract. `/labs/<name>` hosts `apps/labs/<name>`, where
`<name>` is the portless name without `.labs.beep.localhost`; labs keep the
segment so nothing lab-grade reads as official.

The foundation package `@beep/public-site`
(`packages/foundation/modeling/public-site`) owns the hosting map:
`PublicOrigin`, `SiteRoute` (a `LiteralKit` of the route slugs), `hostedUrl`
and `labRoute`. Hosting is schema-typed build-time or runtime config, never an
environment read. The identity authority stays a type-level literal in
`@beep/identity` (`IdentityAuthority`), which never depends on
`@beep/public-site`; a test in `@beep/public-site` proves
`hostedUrl("ns") + "/"` equals the authority, so the two literals cannot
drift. App base-path configs and `@beep/repo-configs` consume
`@beep/public-site`; each surface's deployment goal wires its own consumer,
and none is wired yet. Product code outside those two packages never writes
the origin as a string literal (tests and a short allowlist with reasons are
exempt), and no file outside `**/history/**` and the top-level `research/`
tree names a retired authority; `bun run beep laws retired-iri-authorities`
enforces both.
The operator brief, the decisions D1 to D6 and the rulings that refine them
are in [goals/public-origin-beep-effect-com/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/public-origin-beep-effect-com/SPEC.md).

Rationale:

`llms.txt`, robots, the sitemap and `.well-known` are origin-scoped, and the
knowledge-endgame training-data flywheel wants one crawler authority. Every
listed surface is public and unauthenticated, so per-subdomain cookie and CSP
isolation buys nothing. schema.org and w3.org mint IRIs as apex paths. The
earlier identity host was a placeholder on a domain the repo never owned.

Rejected: a subdomain per surface (splits origin-scoped files and crawler
authority for no isolation benefit); a dedicated `ns.` subdomain for identity
(the same split, and dereference sits naturally beside its discovery
projection); tooling as owner of the hosting map (product code such as MCP
output and `llms.txt` generation cannot import tooling). Consequences: the
identity authority moved in a hard cut with no alias map, evidence predicate
types in skill-contract and the QA judge bumped to `/v2`, and deployment of
each route is a separate goal. Reverse by reverting its PR and running
`bun run beep laws retired-iri-authorities` in report mode to list what would
re-flag.

## 2026-10-21: Epistemic Vocabulary Is Foundation; Party Is A Product Slice; Propositions Are Slice-Owned

- **Status:** Active

Decision:

`@beep/epistemic-domain` splits along the line it already has. Its tenant-free
value vocabulary (claim gate verdict, evidence spans, edge
relation and logical edge identity, bitemporal valid/knowledge intervals,
evidence-signal envelopes, and a generic `Claim<P>` / edge-version envelope
over an encoded proposition and its logical key) moves to a new
`foundation/modeling` package, `@beep/epistemics`. The epistemic slice keeps
everything that carries product semantics: the org-scoped `ProductEntity`
entities (`EdgeVersion`, `Evidence`, `CandidateClaim`, `ClaimDisposition`,
`Activity`, `Contradiction`, `EvidenceVerification`, `UsageRecord`), its
tables, the Postgres edge authority, and the contradiction-triage service, and
it imports the vocabulary from foundation. `ClaimLifecycle` is not part of the move: it is
already shared-kernel vocabulary in `shared/domain` with a promotion record,
per "2026-06-18: Cross-Slice Consumption Of The Epistemic Boundary", which this
entry applies rather than supersedes (substrate to `foundation/modeling`,
shared product vocabulary to `shared/domain`, mechanism stays in the slice).
The agent-authority values
(`ExecutionGrant`, `GrantSet`, `ExecutionRecord`, `ExecutionVerdict`) are not
epistemics; they are recorded as misfiled and move to their own home in a
separate change.

Parties (persons, organizations, collective agents), their identifiers,
accounts, voices, identity resolution, and the reviewer loop graduate from
`scratchpad/party` into a new product slice, `packages/party/*`, created with
`bun run beep create-package`. `PartyId` moves from
`shared/domain` `identity/LawPractice` to a neutral `identity/Party` kit; other
slices refer to parties by id and attach their own role vocabularies
(law-practice keeps `LegalRole`). Each slice owns its proposition union
(party: `IdentifierOf`, `AccountIdentifier`, `MailboxKind`, `VoiceAuthor`,
`SameParty`, `DistinctParty`, `Membership`, `ReportsTo`, `DelegateOf`,
`ContextRole`, ...) and instantiates the foundation `Claim<P>` envelope; no
central proposition union exists in `shared`. Order: the `@beep/epistemics`
extraction lands first, then the party slice builds on it instead of the
scratchpad mirror.

Rationale:

Moving the whole epistemic package to foundation would violate
`07-non-slice-families.md`: its entities are tenant-scoped product records with
persistence and review workflows. Leaving it whole forces every slice that
needs claim semantics (party, law-practice, future professional domains) into
a cross-slice dependency on epistemic product code for what is really
vocabulary. Party has behavior (resolution, review, ingestion), so it cannot be
`shared` (which may not hold workflows) and it has one consumer today, so a
shared promotion record is not satisfiable; keeping it inside law-practice
defeats the domain-agnostic runtime goal. Slice-owned proposition unions keep
compile-time role checking without making every new relation a shared-kernel
change. Evidence for the model: `scratchpad/party/PARTY-DATA-MODEL.md`
(49 tests; run over a real 241,501-message index). Reverse by keeping the
vocabulary in `@beep/epistemic-domain` (delete `@beep/epistemics` and repoint
imports) and, for party, by leaving the model in scratchpad.

Amendment (2026-10-22, operator ruling during the extraction): "tenant-free"
is not enough for a move to foundation. Seven of the value modules
(`EdgeEndpoint`, `LogicalEdgeIdentity`, `EvidenceVerification`, `Contradiction`,
`ContradictionDetection`, `ClaimEvidenceReview`, `ClaimProjection`) carry
shared-kernel ids (`EvidenceId`, `CandidateClaimId`, `EdgeVersionId`,
`UserPrincipal`), and foundation may not depend on the shared kernel. These
modules now live in `@beep/epistemics` as generic schema builders and behavior
factories over caller-supplied id schemas (`IdCodec`: a schema whose type is
`string | number`) and a caller-supplied identity composer. Each slice declares
its own `S.Opaque` classes from the builders under its existing names and
identity paths, because TypeScript cannot declare a class over a generic base
(TS2509). The epistemic slice therefore emits byte-identical schema identifiers
(258 checked), and the party slice binds the same factories to its own ids. The
`Claim<P>` envelope (`makeClaimEnvelope`) follows the same contract. Reverse by
moving the shared-domain id brands into foundation and collapsing the builders
back into concrete schemas. Record: [goals/epistemics-foundation-extraction/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/epistemics-foundation-extraction/SPEC.md)
"P1b factory contract".

## 2026-10-22: Upstream-First Census Amendments

- **Status:** Active
- **Amends:** 2026-09-29 "Upstream-First Foundation/Modeling"

Decision:

The facet census behind upstream-first retirement changes in three ways.

- **Coverage survives derivation.** A facet counts as covered only if the
  upstream result type that consumers program against, after the derivation
  they perform (a subset, a refinement, a transform), still carries what they
  read. A matching call that returns a weaker type does not cover the facet.
- **Construction is neutral.** Construction lines leave both sums in rule 2.
  The census still records them, as reach.
- **A replacement that changes meaning gets its own row.** When the upstream
  replacement changes what consumer code means rather than how it is spelled,
  the facet gets its own decision row stating the semantic loss, whatever its
  site count and whether or not the 100-consumer census threshold applies.

The rule text is `11-evolution-and-deprecation.md`, section "Upstream-first
retirement in `foundation/modeling`", rules 1, 2, 4 and 6.

Rationale:

`goals/effect-schema-parity` retired LiteralKit's `pickOptions` /
`omitOptions` because upstream `Literals.pick` exists. It returns a bare
`Literals`, and on 2026-10-22 a census found 24 sites wrapping the result back
in `LiteralKit(...)` to recover `Enum`, `is` and `$match`. The facet looked
covered at the call and was uncovered at the use. Construction decided nothing
either: every consumer constructs the concept whatever the ruling, and the
2026-09-15 comparison (2,054 uncovered against 2,048 covered) was a near-tie
only because 1,521 construction lines sat on the covered side. Without them it
reads 2,054 against 527. `omit` became "an explicit pick of the complement".
That replacement changes meaning, because a computed complement tracks the
parent kit and an enumerated list goes stale, and its 13 sites sat below every
threshold that would have surfaced it. One site spelled out a 238-literal
complement of `OfficeCode`. `goals/literal-kit-subset-algebra` restores
kit-returning `pick` and `omit` under these rules
(`explorations/effect-schema-parity/DECISIONS.md`, 2026-10-22).

Rejected:

- Keep counting construction as covered. It inflates the covered sum by the
  concept's reach, so a widely constructed concept looks covered regardless of
  what its consumers read. This supersedes the rejection in the
  `goals/effect-schema-parity` SPEC row of 2026-09-29, which kept construction
  on the covered side.
- Fold the semantic-change test into rule 4. A site-count threshold is exactly
  what let `omit` through.
- Leave the doctrine alone and reopen facets case by case. The same error
  would recur on the next concept.

## 2026-10-28: One beep App Composes beep-Prefixed Command Tools

- **Status:** Active
- **Amends:** 2026-04-23 "Use Semantic Foundation Names And Repo-Scoped Tooling Names"

Decision:

The `beep` command line is assembled in one app, `@beep/beep`.
The app owns the `beep` and `beep-cli` bins, a lazy dispatch manifest that maps
each command group to a dynamic import and static help text, and the runtime
Layers each group needs, built per group. It publishes no TypeScript API and
no docgen surface. It may depend on any tooling package, and no product app,
slice, or tooling package depends on it.

Command groups live in `tooling/tool` packages named `@beep/beep-<group>` at
`packages/tooling/tool/beep-<group>`. A tool composed by `@beep/beep` may omit
`src/bin.ts`. Tools still never import each other: code that two tools share
moves into a `tooling/library` package. Libraries, policy packs, and test kits
keep `@beep/repo-<purpose>` names. Ten tooling packages that predate this
entry keep their names as recorded exceptions: `@beep/ai-sync`,
`@beep/codegen-kit`, `@beep/fc-runs`, `@beep/lint-rules`, `@beep/mcpb-kit`,
`@beep/memfs`, `@beep/palantiri`, `@beep/qa-capture`, `@beep/test-runner`, and
`@beep/test-utils`. New tooling names follow the rule.

Until `goals/beep-cli-composition` completes, `@beep/repo-cli`
(`packages/tooling/tool/cli`) remains the composition root and holds every
command group. That is transitional compatibility, not drift.

This entry supersedes three package-local locks against new packages: the
"no new packages" lock in `goals/repo-cli-modularization`, D8 in
`goals/packet-control-plane-core` ("no new workspace package" for the packet
core), and the rule in `explorations/turborepo-quality-cache` that a tooling
library is extracted only after two independent production consumers.

Rationale:

`@beep/repo-cli` grew from about 92k source lines when its modularization
packet started on 2026-07-07 to about 438k on 2026-10-21. Its test task was
the largest Turbo task in the fleet (8.8% of task time, 11% cache hits), its
coverage shard ran 1,358 seconds against 521 for the next largest, and an
edit anywhere in it invalidated the lint policy fingerprint for about 520
tasks. About 340 consumers (generated package scripts, workflows, systemd
units, hooks, and skills) bind to the `beep` bin rather than to the package,
so the split keeps one bin and moves composition to where the architecture
already puts runtime wiring: an app. That needs no new tooling kind and no
exception to the tool-to-tool rule. It also removes today's tool-to-tool
import from `@beep/repo-cli` to `@beep/repo-docgen`, whose command group the
renamed `@beep/beep-docgen` absorbs. The `beep-` prefix says a package adds a
`beep <group>` command; `repo-` says a package is imported substrate.

Rejected:

- A new `command-pack` tooling kind. It would define a second composition
  concept beside apps, with its own dependency row.
- Command groups as `tooling/library` packages. Libraries would need command
  role files and a dependency on policy packs.
- Separate tools with their own bins. That rewrites about 160 generated
  manifests, 11 workflows, the systemd units, 21 permission grants, and the
  skills.
- An aggregator exemption that lets `@beep/repo-cli` import other tools. It
  keeps the composition root in tooling under a standing exception.
- Bare `@beep/<group>` names. They collide with product vocabulary such as
  knowledge, harness, files, and media.

## 2026-11-06: Infrastructure Stacks Are A Tooling Kind; Platform Stacks Live In `tooling/infra`

- **Status:** Active
- **Amends:** 2026-10-28 "One beep App Composes beep-Prefixed Command Tools" (kind catalog)

Decision:

Infrastructure-as-code written as Effect programs over Alchemy is a tooling
concern with its own kind. The tooling kind catalog becomes `library`, `tool`,
`policy-pack`, `test-kit`, `infra`.

- `packages/tooling/infra/<name>` (`@beep/infra-<name>`) holds one Alchemy
  stack per repo-platform concern: CI runner fleet, turbo cache, cost controls,
  GitHub repository settings, host deployments. Each is created with
  `beep create-package`, follows the canonical package shape (`src/`, `test/`,
  generated scripts, tsgo diagnostics, docgen) and exposes its stack through
  `alchemy.run.ts` at the package root.
- An application's own deployment stack lives beside the application
  (`apps/<app>/alchemy.run.ts`), as `apps/beep-effect-web` already does. It is
  not an `infra` package.
- Repo-owned Alchemy resources and providers (a Vercel provider over
  `@distilled.cloud/vercel`, AWS resources Alchemy lacks, the GitHub runner
  composite) are `tooling/library` packages named `@beep/alchemy-<provider>`,
  written to Alchemy's provider conventions and test harness so the generic ones
  can be upstreamed unchanged.
- `infra` packages may depend on `tooling/library` packages, `drivers`, and
  `foundation`; nothing depends on an `infra` package. They may not import
  product slices.
- Infrastructure code is subject to every repo law a `@beep/*` package is
  subject to. No Python, no shell, no Pulumi, no separate toolchain pin.

The root workspace member `infra/` (the Pulumi workspace) is transitional until
`goals/infra-alchemy-rebuild` deletes it; new Pulumi programs are forbidden.

Rationale:

The Pulumi workspace sat outside every package law: its own TypeScript 6 pin
loaded by a preload, Python and shell labs beside the programs, nested
sub-packages with their own lockfiles, no tsgo diagnostics, and `node:crypto`
and async/await in a Lambda the repo's Effect laws would never accept elsewhere.
A kind puts stacks under the same `create-package`, lint, check and docgen gates
as everything else and gives the dependency table one row. Alchemy's own
guidance (per-package stacks for different deploy cadences) already placed the
first stack beside its app; the two placements are complementary, not
competing. Operator decisions D5, D13 and D14 of the 2026-11-06 grill session in
`explorations/pulumi-to-alchemy/DECISIONS.md`.

Rejected:

- One `@beep/infra` package under `tooling/tool` holding every stack. One
  package would carry every cloud credential and every deploy cadence, and a
  CLI `tool` is not what a stack is.
- Stacks as `tooling/library` packages. A stack is deployed, not imported.
- Every stack beside whatever it serves, with no platform packages. The runner
  fleet and the turbo cache serve the repository, not one app; they would have
  landed under `.github/` or inside the CLI.
- Keeping `infra/` as a root workspace exception. That is the situation this
  entry ends.

## 2026-11-06: Slices Adopt `@alchemy.run/domain`; The Entity Kit Is Frozen

- **Status:** Active, amended by 2026-11-18 "Slices Are Model-First Bounded
  Contexts In Four Packages": its placement table binds legacy seven-package
  slices only
- **Amends:** "CQRS, Events, Workflows, Cluster, And Read Models" and the
  domain/use-case/server role vocabularies in `standards/ARCHITECTURE.md`

Decision:

Event-sourced slices declare their write model with `@alchemy.run/domain`
(pinned 2.0.0-beta.85, bumped only as a named goal task): `Event`, `Command`,
`Rejection`, `Aggregate`, `View`, `Policy`, `Saga`, `Projection`, `Stream`,
`ExternalSystem`, `RequestContext`, `Api` and `Model`. Slice `domain` packages
import it directly, the way they import `effect/Schema`; there is no
`@beep/shared-domain` facade.

Placement follows purity. `domain` holds the declarations that are pure:
events, commands, rejections, aggregates (decide/evolve), views, streams,
external-system contracts, request contexts and middleware declarations.
`use-cases` holds the assembled `Model` and each `Api`, plus policy, saga and
projection declarations; alchemy's command dispatch is the use-case execution
boundary. `server` instantiates: the Platform Layer, the workflow engine, the
`toLayer` implementations of policies, sagas, projections and external systems,
the Session middleware's server half, and HTTP/MCP/CLI hosting. Declarative
constructors describe; Layers host.

Event streams are the system of record. Existing tables survive as read models
rebuilt by Projections; a slice cuts over as a single writer (genesis import of
its rows as version-1 events, then the Model is the only writer and the
effect-drizzle write path is deleted in the same PR). Every stored event
carries a schema version (a static on the event class, default 1); upcasters
run at read and stored events are never rewritten. Provenance (principal,
source kind, timestamp) is a `RequestContext` the Session middleware provides;
the Platform driver persists it beside the event, never as payload fields
unless the actor is business-meaningful. Stream ids are the existing branded
public ids; unique-value reservations are org-qualified.

The persistence Platform is a driver: `@beep/alchemy-postgres`
(`packages/drivers/alchemy-postgres`) implements the alchemy `Platform` contract
on Postgres and provides the workflow engine through `effect/cluster`.
`Domain.InMemory` hosts tests and Stories. A conformance suite runs the same
scenarios on both.

The hand-rolled entity kit in `packages/shared/domain/src/entity/`
(`EntityKit`, `BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`,
`primitives`, and the `entity` barrel) is frozen: forbidden in new work and
enforced by `bun run beep laws entity-kit-freeze --check` against the committed
baseline `standards/entity-kit-freeze.baseline.jsonc`, which only shrinks. Each
slice migration removes its own importers; the kit is deleted with its last
consumer. `Principal`, `SourceKind`, `PublicEntityId`, `EntityId` and
`EntityRef` survive as explicit value schemas and are not frozen.

Rationale:

Operator ruling 2026-11-03 (D0) and the grilled decisions D1–D17 in
`explorations/alchemy-domain-adoption/DECISIONS.md`, graduated into
`goals/alchemy-vault-sync-slice`. The kit bakes SQL column metadata,
inheritance and audit stamping into every model and is a weaker DDD substrate
than alchemy's block set. The P0 spikes
(`goals/alchemy-vault-sync-slice/research/01-p0-spikes.md`) showed field
annotations and `LiteralKit` survive alchemy constructors, that the kernel hands
a driver the encoded request context with every command, and that the kernel
envelope has no version or provenance slot, which fixes where each lives.

Rejected:

- Cloudflare Durable Objects as product storage. Product data stays on Postgres.
- A `@beep/shared-domain` facade over alchemy. It would become the next kit.
- Keeping CRUD rows authoritative with alchemy as a decision layer, or a
  dual-write shadow period. Both keep two sources of truth.
- Deleting the kit in the first migration. 64 files across seven packages
  (agents, architecture-lab, documents, epistemic, law-practice, shared and
  workspace) import the frozen modules, per the
  `standards/entity-kit-freeze.baseline.jsonc` census; a strangler keeps each
  slice's PR bounded.
- Tracking alchemy betas continuously. 84 betas in 203 days with breaking
  changes; each bump is a named task with a migration note.

## 2026-11-09: Merge Queue Activation Is Gated On The Merge-Group Run

- **Status:** Active
- **Supersedes:** 2026-08-27 "Merge Queue Stays Off Until the Recorded Reliability Gate"

Decision:

The `main` merge queue stays disabled and `strict_required_status_checks_policy`
stays `false`. The activation gate is no longer the share of green `check.yml`
push runs on `main`. The queue may be enabled when all three hold, measured on
merge-group runs:

- **Parity.** Every required context reports on a merge-group commit and proves
  what it proves on a pull request. No required job skips or degrades under
  `merge_group`.
- **Speed.** p90 wall time of a code entry's merge-group run is at or under 15
  minutes.
- **Reliability.** False ejections are at or under 5% over at least 100 entries.

At activation the queue is the only door to `main` and the S11 exception in
`AGENTS.md` is retired; until then S11 stands unchanged. The merge-group run is
the per-commit `main` verdict, placed before the merge. The strict-status-check
flip is no longer a step on the way.

Rationale:

Read on 2026-11-09 over 14.2 days, 163 of 221 tested `main` runs had all 15
required contexts green (73.8%), falling from 89.1% to 62.8% in the week merge
volume doubled; 524 of 746 runs were cancelled before finishing. The old bar
counted reds that merges over failing checks and stale-base merges put on
`main`, which a queue removes, and it was read on three commits in ten. What a
queue is sensitive to is how long a merge-group run takes and how often it
fails on a good tree. GitHub builds every queue entry separately, and one full
run now peaks near the hosted concurrent-job ceiling, so the queue builds one
entry at a time; 15 minutes is 96 entries a day against a measured peak of
about 95 code merges. At 53 merges a day a strict up-to-date policy would
stale every open pull request on every merge. Evidence and the operator's
rulings: `explorations/github-merge-queue/RESEARCH.md` and `DECISIONS.md`.

Rejected:

- Keeping the 80% bar on the required-contexts basis. It waits on a number the
  S11 exception holds down.
- Running S11 and a queue together. A bypass merge moves the base under every
  group being built.

## 2026-11-18: Slices Are Model-First Bounded Contexts In Four Packages

- **Status:** Active
- **Amends:** 2026-04-21 "Adopt Hexagonal Vertical Slice Architecture" and
  2026-11-06 "Slices Adopt `@alchemy.run/domain`; The Entity Kit Is Frozen"
- **Amends:** "North Star", "Slice Package Topology" (now "Model-First Slice
  Topology" and "Legacy Seven-Package Slice Topology"), "Slice Consumption
  Rules", "CQRS, Events, Workflows, Cluster, And Read Models" and "Enforcement
  And Migration Posture" in `standards/ARCHITECTURE.md`

Decision:

A slice is a bounded context with one `Domain.Model` by default; a second Model
is allowed only for an independent event lifecycle or storage placement. It
ships as four packages, one per dependency closure: `contract`, `model`, `host`
and `web` (`web` only when the context has screens). The contract holds the
aggregate-free declarations and its client Apis as `Domain.Api` over an
aggregate-free catalog, with a parity test against the model's Api; views and
queries are declared a second time for the contract until upstream splits the
Api from the model. Declarations are `<Module>/<Noun>.<kind>.ts`, with
`.handler.ts` and `.adapter.ts` implementations, Module folders, one primary
export per file, exact package exports and a generated handler registry.

Contexts exchange versioned integration facts: a model-level projection over
aggregate events writes a pinned published stream with generations, the host
serves it as a feed, and the consumer keeps an inbox. Publishers drain before a
handover, fact versions and closed generations retire only under the checked
rules, and synchronous calls go through a consumer-declared port over the
provider's gateway contract. Stored formats convert on read, saga activity
results included. Only the `authority` context builds an `Invocation`; events
store provenance and each hop is re-admitted from live grants. A generated
proof inventory lists every invariant with its checker, and semantic questions
go to an independent reviewer.

Effect Cluster on Postgres is the first host. The monorepo carries the library
fixes it needs as root patches until an Alchemy release includes them, and
`@beep/alchemy-postgres` remains until then.

Seven-package slices stay legal as the legacy shape until their own migration.
No new slice migration to `@alchemy.run/domain` starts on the seven-package
shape. New checkers start from a day-one baseline of today's violations and
only ratchet down; there is no mass rewrite.

The nine rows `explorations/v3-consistency-audit/DECISIONS.md` deferred to
`goals/slice-topology-audit` (superseded by `goals/model-first-standard`) are
settled against the four-package shape:

| Row | Settled |
| --- | --- |
| `dir:package-shell-skeleton` | The shell `bun run beep create-package` emits is the package skeleton law for all four packages; the required-files rule lands with the checkers. |
| `BN-19` | The source export map is the truth and the publish mirror is derived; exact exports make it one entry per entry point. |
| `tests:coverage-ratio-by-tier` | Not a topology rule; it stays with the coverage ratchet. |
| `tests:typecheck-covers-test-tree` | Every package with tests type-checks its test tree, model-first and legacy alike. |
| `BN-12` (`<Concept>/server.ts`, `worker.ts` shims) | Not admitted in a model-first context, where the runtime split is the package line (`host`, `web`) and exact exports; legacy slices keep them under the baseline. |
| `BN-14` (`.ts` specifiers) | Codified; no new gate. |
| `BN-15` (root barrel) | A package's root entry, where it has one, is a pure re-export. |
| lab `WorkItem.client.ts` | Superseded: a model-first context has no client package; its web package uses bindings generated from the contract. The lab keeps its file until its own migration. |
| lab `WorkItem.view-model.ts` | Not admitted: a screen's state is a `.machine.ts` with a `.controller.ts`. The lab keeps its file until its own migration. |

The member-vocabulary and contract sub-choices ratified on 2026-08-30 in that
packet (`Repo`, bare values, the `Client` member, the `Contract` kit,
`contracts/` and `handlers/` sub-folders) describe the seven-package grammar
and bind legacy slices only.

Rationale:

The grilled decisions D1 to D66 in
`explorations/model-first-slices/DECISIONS.md`, the shaped brief confirmed by
the operator (`explorations/model-first-slices/BRIEF.md`, D59), and the
prototype in `scratchpad/model-first-slices/`, which proved the shape in memory
(196 tests, 109 of 109 declared command outcomes executed, a proof inventory of
41 entries, zero Effect diagnostics) and passed the conformance suite on a
two-runner Effect Cluster with Postgres on one build, restore and a real upgrade
included (D53). The one slice built on `@alchemy.run/domain` since 2026-11-06
showed the seven-package slice and the library pulling against each other: a
whole model inside one aggregate folder, handlers and ports moved away from the
placement table twice, and a repo-owned Postgres platform duplicating hosting
upstream ships. A package exists for one dependency closure, and the public
contract's closure is smaller than the write model's (D3). The binding entries
are D2, D3, D5, D8, D9 as amended, D10 to D13, D17, D22, D24, D27, D33 to D35,
D39 to D43, D45, D47, D49 to D51, D53 to D55 and D61. The operator set the
appetite as the standard plus one real slice (D60) and named `authority` the
first slice (D63). Graduated into `goals/model-first-standard`,
`goals/effect-cluster-host` and `goals/authority-context` (D66).

Rejected:

- One bounded context equals exactly one `Domain.Model` (D2).
- The model as the client SDK, or a contract-only client with no
  `Aggregate.predict` (D3).
- A hand-authored contract `RpcGroup` for good: it loses the typed nested
  client (D9).
- Keeping `.live.ts`, kind folders or wildcard exports (D10).
- Consumers following the producer's private events or internal streams, and a
  host-owned outbox table (D11, D33).
- Rewriting stored events, or widen-only schemas (D22).
- Retiring `@beep/alchemy-postgres` on fixes carried in the monorepo (D53, D61).
- Migrating every slice in one change (D17).

## 2026-11-19: Text-Knowledge Stack Package Boundaries And Dependency DAG

- **Status:** Active

Decision:

The text-knowledge stack is eight layers with fixed owners, recorded in
`16-knowledge-stack.md` section 2. L0 identity is realized by three packages:
`@beep/identity` (the RFC 3987 `IRI` schemas, which move there from
`@beep/rdf`, `Namespace` as prefix and IRI, `Term`, `TermBinding`, the
`Deprecation` record and the term-stability snapshot), `@beep/schema` (the
prefixed digest primitive, under `ContentHash` and its domain brands) and
`@beep/jsonc` (RFC 8785 canonical JSON and the one minting function over a
versioned, domain-tagged preimage). The registry is split along the dependency
line: `@beep/identity` imports `effect` only, so its version field is a string
with a local pattern check and its literal domains use `S.Literals`, and
records that need `@beep/schema` primitives live above it. An external
namespace's pin (source, license, version, digest) is `NamespacePin` in
`@beep/rdf`; the gUFO class typing is a record keyed by term IRI in
`@beep/ontology`. L1 is `@beep/text`, which replaces `@beep/provenance`
by `bun run beep create-package` plus retirement of the old name with every
consumer migrated in the same PR. L2 is `@beep/annotation`, a
`foundation/modeling` package. L3 is `@beep/ontology`, L4 `@beep/epistemics`,
L6 `@beep/rdf`. L5 is the existing capability `@beep/nlp-processing`. L7 is a
contract, not a package.

The legal compile-time edges are listed in `16-knowledge-stack.md` section 3.
`@beep/identity` depends only on `effect`. The base entries of `@beep/text`,
`@beep/annotation` and `@beep/epistemics` stay rdf-free; each RDF codec lives
in an adapter subpath of the package that owns the source shape, and
`TextAnchor` to `oa:` lives in `@beep/rdf`, which imports `@beep/text`. The
`@beep/rdf` to `@beep/md` edge is removed. Capability packages import modeling,
never the reverse, and no slice `domain` or model package imports a
capability.

This entry applies the 2026-10-21 ruling "Epistemic Vocabulary Is Foundation;
Party Is A Product Slice; Propositions Are Slice-Owned"; it does not reopen it.

Rationale:

There was no ruling for the text stack. `@beep/nlp` imported none of the
provenance, rdf or epistemics packages, `@beep/rdf` imported `@beep/md` in the
wrong direction, and "provenance" named text anchoring, PROV-O and event
provenance at once. The L0 split follows the dependency facts: every L0 owner
other than `@beep/identity` depends on it, so `@beep/identity` cannot import the
RFC 8785 implementation, which already has a single owner in `@beep/jsonc`.
Evidence: `goals/text-knowledge-stack-rebuild/research/2026-11-08-rebuild-report.md`
sections 4 and 7, and the packet's 2026-11-19 decision on L0 homes.

Rejected:

- Canonical JSON inside `@beep/identity`. It would need a second RFC 8785
  implementation or a dependency cycle.
- Keeping `@beep/provenance` as the L1 name. It is text identity and anchoring;
  PROV-O stays in `@beep/rdf`.
- RDF codecs in the base entries. Slices would import the semantic-web stack to
  hold an anchor.

Reversal:

Move the RFC 8785 core below `@beep/identity` into a new effect-only primitive
package, or keep a package under its old name, by a new dated entry and a
decision file in the packet before the phase that executes the move.

## 2026-11-19: The Canonical Anchor Is `TextAnchor` With `Selector` And `OccurrenceId`; Re-Anchoring Is A Recorded Map

- **Status:** Active
- **Amends:** "Provenance Anchor" in `GLOSSARY.md`, by extension

Decision:

`TextAnchor` and `VerifiedTextAnchor` stay the canonical source-pointing nouns
and keep their shapes. `@beep/text` adds `Selector`, the one selector union
(`Position`, `Quote`, `Fragment`, `Refined`, `Range`), and `OccurrenceId`, the
only text-occurrence identity in the repository: the digest of the versioned
tuple of scope, source reference, locator, source digest, text digest,
extractor name and version, normalization version, offset unit, start, end and
quote. The canonical stored unit is `utf16-code-unit`. Quotes locate and
verify; ranges identify. `resolve` returns `Unique`, `Ambiguous` or `NotFound`,
and re-anchoring across two captures is a recorded `Exact`, `Widened` or
`Unmapped` map with its own receipt. `Anchored` holds the powerless
verification receipt; decoding one grants no proof.

The citation mention id becomes the digest of `citation-mention/v2`, the engine
artifact, the semantic kind and the `OccurrenceId`, so two engines or two
citation kinds at one occurrence stay two mentions over one occurrence. Every
identifier whose preimage contains a mention id is re-minted with a bumped
domain tag. No table stores a `cm1:` value, so the identifiers change under
the scoped chapter-11 amendment with regenerated golden vectors and fixtures.
Citation document receipts take a declared read-time transform from v3 to v4
that recomputes the identifiers from the receipt's own source, anchor, engine
artifact and kind, proved by a frozen v3 fixture and a migration test, under
the 2026-11-18 stored-format law. The persisted anchor columns keep their
bytes behind read-time transforms: `epistemic_evidence.span` holds an
`EvidenceSpan` (`TextAnchor` fields plus confidence), which the epistemic
tables package reads from its current and legacy shapes into the text
position plus an extractor-confidence signal, proved by a frozen old-row
fixture. The stored `@beep/agent-memory-store` node events hold an
`OccurrenceAnchor` and keep their bytes; P2 derives `OccurrenceId` from it at
read time, mapping its `utf16` unit literal to `utf16-code-unit`. The five
non-canonical anchor encodings are deleted in the phase that owns each: the
`@beep/rdf` selector schemas and the party-domain `TextSpan` case in P2, the
`@beep/nlp` Handoff and Graph spans in P3, and `EvidenceSpan` in P4. The cli
knowledge-base `Selector` is repo tooling with no consumer in the stack and is
kept; P7 re-checks it. The name `OccurrenceId` is reserved for `@beep/text`.

Rationale:

Repeated claim language, examiner boilerplate and headers share quote and
context, so a quote cannot identify an occurrence. The citation engine already
identified mentions this way; the occurrence preimage generalizes it and the
mention keeps its detection fields on top. The tree carried at least six
anchor encodings, array-order ids and first-match lookups. Evidence: the packet's
2026-11-19 decisions on RQ4 and on items 4, 6 and 9, and
`goals/text-knowledge-stack-rebuild/research/consumer-census.md`.

Rejected:

- Quote-first identity. It merges repeated passages.
- An occurrence preimage without the engine and kind. It merges distinct
  mentions at one range; the mention id carries them instead.
- Renaming `TextAnchor`. The name is established and correct.

Reversal:

Keep `citation-mention/v1` frozen and treat `OccurrenceId` as a sibling
identity, by a new dated entry before the P2 PR of
`goals/text-knowledge-stack-rebuild` opens; after P2, revert by a further
receipt version step with its own read-time transform.

## 2026-11-19: Legal Vocabulary Seeds Live In The Law-Practice Asset Pack

- **Status:** Active

Decision:

The legal seeds in `@beep/ontology` (`Vocabulary.seed.ts`,
`SemanticFoundation.seed.ts` and the seed data files under its `src/seed`
directory) are product vocabulary. They move together to a manifested,
digest-pinned data pack owned by
the law-practice domain package and loaded through the manifested protocol in
`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts`, with seed IRIs
and approval metadata preserved. The FOLIO HTTP DTOs and their data have no
consumer and are deleted in P5 rather than moved. Foundation keeps no legal
semantics.

Rationale:

Foundation is domain-agnostic. The seeds carry docketing, party kinds, legal
roles and filing roots, and no package outside `@beep/ontology` imports them,
so the move has no consumer migration beyond the loader. The loader already
handles vendor data through a pinned manifest, so the pack needs no new
protocol. Evidence: the packet's 2026-11-19 routing decision and census group
d.

Rejected:

- A new foundation package for legal vocabularies. It would put product
  semantics in foundation.
- Moving the FOLIO DTOs into a driver. They carry no exported behavior and
  have no consumer.

Reversal:

Return the seeds to `@beep/ontology` by a new dated entry; the pack keeps the
same IRIs and approval metadata, so the reversal moves files without
re-minting.

## 2026-11-19: `@beep/nlp` Splits Into `@beep/annotation` Schemas And `@beep/nlp-processing` Operations, Then Retires

- **Status:** Active, amended by 2026-11-25 "L3 To L7 Land; The nlp And
  schema-org Packages Retire"

Decision:

`@beep/nlp` mixes modeling schemas with capability operations, and a slice's
`domain` cannot import a capability. It splits along that line. The handoff
contract and the graph schema become `@beep/annotation` kinds; the handoff's
`Entity`, `Relation` and `Provenance` types and the float `Span` are deleted;
the ontology kind kits fold into the annotation kind registry. The operations,
the linguistic engine contract (`Core`) and the algebra instances an
`effect/Combiner` and `effect/Reducer` census leaves uncovered and a consumer
uses move to `@beep/nlp-processing`, merged with that package's own operation
modules into one. The graph-operation module retires as a duplicate of the
`nlp-processing` graph layer over `effect/Graph`. The four text helpers with no
consumer are deleted. Under rule 2 of `11-evolution-and-deprecation.md` the
concept is ADAPT, not retire: 257 consumer lines are uncovered against 3
covered. The package name retires after its facets are rehomed (the Handoff
contract, Graph Schema and Kind to `@beep/annotation`; Core and Operations to
`@beep/nlp-processing`), with every consumer migrated in the same PR; only the
covered `UnitInterval` re-export retires to its upstream,
`@beep/schema/UnitInterval`.
`@beep/annotation` is created as a `foundation/modeling` package without
waiting for the contract to live inside `@beep/nlp` first.

Rationale:

The census found 404 consumer lines in 45 files, 217 of them reading `Core`,
mostly from the wink driver and `nlp-processing`, and no reader of the
handoff's annotated document outside one langextract test, so there is nothing
to keep compatible inside a package that retires. `@beep/annotation` passes the specific-home-first test:
no product semantics, no external engine, not tooling, not a UI primitive.
Evidence: the packet's 2026-11-19 decisions on RQ1, routing and census
dispositions.

Rejected:

- Landing the annotation contract inside `@beep/nlp` first. It would be moved
  twice.
- Moving the whole package to capability. Slice domains need the annotation
  schemas.

Reversal:

Land the L2 contract inside `@beep/nlp-processing` instead, or keep `@beep/nlp`
with a narrowed surface, by a new dated entry before the phase that executes
the move (P3 for annotation, P6 for operations, P7 for the retirement).

## 2026-11-19: Upstream-First Extends To Pinned External Vocabularies As Registry Entries And Adapters

- **Status:** Active
- **Amends:** 2026-09-29 "Upstream-First Foundation/Modeling" (scope)

Decision:

Upstream-first covers pinned external vocabularies as well as Effect. They
enter as registry `Namespace` entries in `@beep/identity`, as `NamespacePin`
records (source, license, version, digest) keyed by prefix in `@beep/rdf`
beside the vendored vocabularies, and as adapters at the interchange boundary.
The license-and-digest assertion is tested in `@beep/rdf`. P1 registers six
namespaces (`prov:`, `oa:`, `nif:`, `xsd:`, `gufo:` and ActivityStreams
`as:`) and adds pins for the existing `skos:` and `doco:` entries; LKIF and ELI
are candidate entries with no commitment, and enter when a decision names
their first consumer. Internal kinds stay repo-stable: nothing internal is
renamed to an external term until a decision names the kind and its consumer.
The annotation codec supports one declared OA profile; decoding third-party
input returns the document, a table of imported activities and a residual
dataset of every triple outside the profile, never stored and never dropped
silently. NIF is export-only for the sentence and word kinds. OA and NIF
offsets are Unicode code points on the wire; the codec converts them from and
to the stored `utf16-code-unit` through the `@beep/text` unit conversion and
fails closed on a split surrogate. Candidate
vocabularies, such as OntoLex `lexicog`, are recorded as candidate registry
entries with no commitment to adopt them.

Rationale:

The census found no `nif:` or `gufo:` term in code, and `prov:`, `oa:` and
`xsd:` only as hand-written constants outside the CURIE registry. A vocabulary
the repo speaks but does not register cannot be expanded, contracted, licensed
or pinned. Adapters keep the internal model free to change while the wire
stays standard. Evidence: the packet's 2026-11-19 decisions on RQ3 and item 7.

Rejected:

- External vocabularies as internal kinds. NIF and DoCO would become the
  storage model.
- Unregistered constants. They cannot be checked for license or drift.

Reversal:

Adopt an external vocabulary as an internal kind by a new dated entry naming
the kind and its consumer; nothing persisted depends on the choice until a kind
ships.

## 2026-11-19: The Knowledge-Stack Chapter And What Counts As A Law

- **Status:** Active

Decision:

`16-knowledge-stack.md` is the doctrine for the text-knowledge stack: the
purpose (retrieval proposes, logic proves, and the boundary is admission with
two witnesses), the eight layers, the dependency DAG, the identity regimes,
occurrence identity, content versus attribution, stance and admission,
signals, assessments, external vocabularies, matter walls and the agent
surface. It states target doctrine and marks each rule with the phase of
`goals/text-knowledge-stack-rebuild` that makes it true.

The chapter separates a law (a property of this repository's functions a test
can falsify, tested by a property test over production schemas), a profile (a
local constraint stricter than the upstream standard, tested by examples with
planted violations) and an acceptance test (a scenario over synthetic
fixtures). Every structural claim in a README or chapter cites the ledger id of
the test that falsifies it, and the test's title starts with that id. A law
that names no bug it would catch is deleted with its reason.

Rationale:

The repository had no theory of text, knowledge or meaning in its standards;
the only categorical document was a package file that had drifted from the
code and named an owner that no longer exists. "Full categorical fidelity"
gave no way to tell a load-bearing law from decoration. A catalogue keyed by
id, with the bug each row catches, does. Evidence: report section 6 and the
ledger `goals/text-knowledge-stack-rebuild/research/law-test-plan.md`.

Rejected:

- Keeping the theory in a package file. It drifts with the package and dies
  with it.
- A `.laws.ts` file role. A suffix adds no execution; test titles keyed by
  ledger id make laws discoverable.

Reversal:

Delete the chapter and its README row by a new dated entry; the ledger and the
law tests stay with their packages.

## 2026-11-19: Claim Status Is Owner-Declared `Assessments`; The Status Census Covers Eight Sites

- **Status:** Active

Decision:

Claim status is not one state machine. `@beep/epistemics` supplies
`makeAssessments`: from a record of coordinate name to a caller-supplied value
schema it builds a total carrier in which every coordinate is present, as
`Assessed` with a value or `Unassessed` with a reason. A missing coordinate is
a decode failure; unassessed is a value every gate handles. A gate is an
owner-defined predicate over the carrier. The foundation supplies the law
harness: refusal is a no-op, independent coordinates commute, and a gate is
monotone under the owner's declared order and never passes on unassessed.

The status census covers eight sites, not seven. `ReviewState`,
`ClaimDispositionStatus`, `ClaimEvidenceReviewStatus` and `ClaimLifecycle` are
coordinates; `ReviewTag` is a projection of `ReviewState`;
`ReviewerDisposition` is the value schema of the reviewer signal, not a
status; `StructuralVerdict` duplicates `ClaimGateResult` and folds into it
under the verdict law. `ClaimDispositionStatus` keeps its bytes, which a SQL
`CHECK` pins.

This entry does not overturn the 2026-10-21 ruling, the `ClaimLifecycle`
promotion or the verdict law: `ClaimLifecycle` stays in `shared/domain` with
its transitions in the epistemic slice, and the fold follows the law's rule
that structural verification lives with the structure it verifies.

Rationale:

Eight overlapping vocabularies described one claim's position along several
independent axes. A product of owner-declared coordinates keeps each axis with
its owner, which is what the verdict law asks, and a total carrier makes
"unknown" visible instead of absent. The shape is the one the signal builder
already uses. Evidence: the packet's 2026-11-19 decision on RQ2 and design
facts section 2.

Rejected:

- One foundation state machine. It would move transitions out of the slices
  that own them.
- A partial carrier. A missing coordinate would read as passed.

Reversal:

Keep the single `ClaimLifecycle` and add nothing in foundation, by a new dated
entry before the P4 PR of `goals/text-knowledge-stack-rebuild` opens; delete
ledger row `L4-6` in the same change.

## 2026-11-19: Knowledge-Stack Glossary Additions

- **Status:** Active
- **Amends:** `GLOSSARY.md`

Decision:

`GLOSSARY.md` gains the vocabulary the stack uses: Admission, Agent (prov:Agent
Versus Principal Versus Party), Annotation, Assessment Coordinate, Candidate,
Claim (core), Concept Scheme, Evidence (role), Generation (attribution),
Knowledge Graph, Layer (knowledge stack), Matter Wall, Mention, Namespace,
Occurrence, Ontology (OWL) Versus Taxonomy (SKOS), Proposition, Provenance
(PROV) Versus Source Identity, Referent, Selector, Stance, Term, Triage Policy,
and Work, Expression And Manifestation (profile). The "Provenance Anchor"
entry gains `Selector` and `OccurrenceId` beside `TextAnchor`.

Rationale:

The glossary defined neither claim, proposition, evidence, annotation,
ontology nor agent, while the code used "claim" for five things, "provenance"
for three and "vocabulary" for four. Entries that sit next to existing terms
(Generation beside Stream Generation, Admission beside Re-admission, Stance
beside the `SemanticStance` stem, Layer beside Effect's `Layer`) say how they
differ.

Rejected:

- Package-local definitions only. The terms cross every layer and several
  slices.

Reversal:

Remove the entries by a new dated entry; no code depends on glossary text.

## 2026-11-19: Vision Documents: Local-First Posture Withdrawn As Architecture; `THEORY.md` Absorbed

- **Status:** Active

Decision:

The local-first, on-device framing in `docs/PROSE_TO_PROOF_VISION.md` is not
architecture. It is withdrawn by operator ruling
(`goals/text-knowledge-stack-rebuild/SPEC.md`, Non-Goals); hosted providers
are welcome, and no standard, packet or design states
local-only or on-device inference as a constraint. The vision document is
corrected in P7 of `goals/text-knowledge-stack-rebuild`. Its BeepGraph status
line is settled in P7 from the code that exists then; no status is chosen
here.

The retired `@beep/nlp` package's `THEORY.md` is absorbed by section 14 of
`16-knowledge-stack.md`, which keeps each still-true claim tied to a ledger id
and lists the withdrawn ones. The file is deleted with `@beep/nlp` in P7.

Rationale:

A vision statement read as architecture constrains design with no ruling
behind it, and `THEORY.md` named a downstream owner that was deleted and
claimed laws no test checked. Doctrine that lives in standards and
links its tests does not drift that way.

Rejected:

- Leaving `THEORY.md` beside the chapter. Two narratives of one stack drift
  apart.

Reversal:

Restore the vision posture or the file from history by a new dated entry; the
chapter section stays the doctrine unless that entry also removes it.

## 2026-11-19: Scoped Amendment To Chapter 11 Persisted-Bytes Rule For The Text-Knowledge Stack Rebuild

- **Status:** Expired (expired when `goals/text-knowledge-stack-rebuild` reached
  `completed-retained`)
- **Amends:** rule 5 ("Persisted and served bytes do not change") of
  "Upstream-first retirement in `foundation/modeling`" in
  `11-evolution-and-deprecation.md`, for encodings with no stored rows only

Decision:

For pull requests of the goal packet `goals/text-knowledge-stack-rebuild`, and
only for the packages it names, a PR may change the encoding of an
identifier, a wire shape or a fixture that has no stored rows, when the same
PR does all of:

- bumps the version tag in the preimage or wire schema;
- refuses the old version at decode, where the module already works that way;
- regenerates the fixtures and golden vectors.

The named packages are `@beep/identity`, `@beep/provenance` and its successor
`@beep/text`, `@beep/annotation`, `@beep/nlp`, `@beep/nlp-processing`,
`@beep/epistemics`, `@beep/ontology`, `@beep/rdf`, `@beep/schema-org`,
`@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema`, `@beep/html`,
`@beep/langextract`, the semantica lab (`@beep/semantica`),
`@beep/party-domain`, `@beep/agent-memory-store`, and
`@beep/law-practice-domain`, `@beep/law-practice-use-cases` and
`@beep/law-practice-server`. This covers the citation mention and authority
identifiers (no table stores them), the RDF `Dataset` and `Literal` shapes,
the handoff contract and the semantica gold projection fixture. No other work
and no other package is covered; rule 5 applies unchanged everywhere else.

Where rows are stored, this entry grants nothing. The 2026-11-18 stored-format
law governs: stored bytes are not rewritten, and an incompatible change is a
declared read-time transform per version step, proved by a frozen old-format
fixture. The four persisted anchor columns keep their bytes, as do the
SQL-pinned `ClaimDispositionStatus` and the stored `LogicalEdgeIdentity` key.
Stored anchor columns and stored node events keep their bytes behind
read-time transforms: `epistemic_evidence.span`, which holds an
`EvidenceSpan`, is read into the text position plus an extractor-confidence
signal when P4 deletes `EvidenceSpan`, and the `@beep/agent-memory-store` node
events, which hold an `OccurrenceAnchor`, are read into an `OccurrenceId` in
P2, each proved by a frozen old-format fixture. Rows that store a
`ClaimVersion` keep their bytes the same way when it retires in P4.
Citation document receipts, which are held outside the database, take the
read-time route: the v3 to v4 step is a declared transform that recomputes the
identifiers from the receipt's own source, anchor, engine artifact and kind,
with a frozen v3 fixture, and v3 is not refused.

This entry does not amend the stored-format law. The promoted-contract `V2`
protection of chapter 11 stays operative: a field of a promoted
`shared/use-cases` contract still migrates under the `V2` rule, never in a
retirement PR.

The amendment expires when the packet reaches `completed-retained`. It merges
with the packet's P0 PR, or in its own PR if review of the chapter delays it,
and no PR of phases P2 to P7 opens until it is on `origin/main`.

Rationale:

The operator ruled on 2026-11-09 that the program builds the best core rather
than the least that breaks. Rule 5 sends any change of persisted or served
bytes to a separate migration goal, which would split each layer phase in two:
the occurrence preimage re-mints citation mention ids, the `Dataset` digest
changes on the canonical form, and the semantica gold fixture is regenerated.
None of those has stored rows, so a version bump in the same PR keeps each
change reviewable as one unit. Stored rows are a different case: the
stored-format law in `standards/ARCHITECTURE.md` outranks this packet, so the
amendment yields to it there. Scoping the entry to one packet, its named
packages and an expiry keeps rule 5 the default. Evidence: the packet's
2026-11-19 decisions on the scoped amendment and on the amendment yielding to
the stored-format law, and design facts section 10.

Rejected:

- Amending rule 5 repo-wide. Other retirements gain nothing from it.
- Rewriting stored rows under this entry. It would contradict the
  stored-format law.
- Refusing v3 citation document receipts at decode. Receipts already held would
  become unreadable; a read-time transform keeps them.
- A separate migration goal per phase. It doubles every layer phase.

Reversal:

Mark this entry superseded by a new dated entry before the next dependent PR
opens; rule 5 then applies again and any further encoding change leaves its PR
for a separate migration goal. Encodings already changed are restored by a
further version step under the same rule. Widening the entry to rewrite stored
rows needs a dated entry that amends the stored-format law for the named table
before the PR that needs it opens.

## 2026-11-22: L1 Lands In `@beep/text`; Re-Anchoring Carries The Target Receipt

- **Status:** Active
- **Amends:** "The Canonical Anchor Is `TextAnchor` With `Selector` And
  `OccurrenceId`; Re-Anchoring Is A Recorded Map" (2026-11-19), on the
  re-anchoring shape and the count of stored anchor columns; "Knowledge-Stack
  Glossary Additions" (2026-11-19), by four entries

Decision:

P2 of `goals/text-knowledge-stack-rebuild` lands layer L1 of chapter 16.
`@beep/text` (`packages/foundation/modeling/text`) is created through
`bun run beep create-package`; `SourceTextIdentity`, `TextAnchor` and
`VerifiedTextAnchor` move into it with their names and encodings, and
`@beep/provenance` is retired with every consumer migrated in the same PR and
no alias. The package adds `OffsetUnit`, `Position` and unit conversion,
`Selector` and `resolve`, `Anchored`, `OccurrenceId`, `QuoteKey`, the NFKC and
de-hyphenation normalizations, `LocatorMap` and `reanchor`, and declares no
`Context` service.

The 2026-11-19 entry is made concrete in three places:

- Re-anchoring is a `Reanchoring` value over a `LocatorMap` of `Kept` and
  `Rewritten` segments. `Exact` and `Widened` carry the target capture's
  receipt as `Anchored`, produced by verification against the target text, and
  the target's `OccurrenceId` is minted from it, never stored beside it. The
  lax law compares the two steps with the composite map only when all three
  are mapped; `Unmapped` is outside the comparison.
- The occurrence preimage spells its unit as the literal `utf16-code-unit`, so
  one range in two units is one id, and `SourceTextIdentity` strings are
  well-formed text on decode, since a lone surrogate cannot be canonicalized.
  `QuoteKey` normalizes the quote itself under its own `QuoteNormalization`
  version, separate from the capture's `normalizationVersion`.
- Three stored columns hold an anchor shape, not four:
  `epistemic_evidence.span` (an `EvidenceSpan`) and the verification receipts
  in `epistemic_evidence_verification.verified_anchor` and
  `law_practice_patent_citation_event.grounding`.
  `law_practice_legal_position_relator.grounding` holds no anchor, and a
  `VerifiedTextAnchor` is runtime-only. Their bytes stay, pinned by frozen rows
  and a golden `manifestation_key`.

The `@beep/rdf` evidence selectors and the party `TextSpan` case are deleted.
The party union points at text through a `TextOccurrence` case over
`Anchored`, and its record identifier is renamed `ArtifactOccurrenceId`, so
`OccurrenceId` names one identity. `TextAnchor` maps to and from `oa:` in
`@beep/rdf/Adapters/WebAnnotation`, failing closed on disagreeing selectors.
The citation mention id is minted over `OccurrenceId` (`cm2:`) in the
law-practice server, where its legal kinds belong, and v3 citation document
receipts convert to v4 on read. `@beep/md` is the one AST package with a source
map over `@beep/text`. `GLOSSARY.md` gains Anchored, Locator Map, Quote Key and
Re-anchoring.

Rationale:

The 2026-11-19 entry gave re-anchoring "its own receipt", but the design
module's cases held two ids, so a caller could not read the new range. The
four-column count came from the P0 census and was re-measured by the P2 map.
The law tests `L1-1` to `L1-6` in `packages/foundation/modeling/text/test`
falsify the layer's structural claims. Evidence: the packet's
`decisions/2026-11-22-p2-*` files and
`goals/text-knowledge-stack-rebuild/research/2026-11-20-p2-design.md`.

Rejected:

- A re-anchoring outcome of two ids. It records that a move happened without
  where it landed.
- `OffsetUnit` in the occurrence preimage. One occurrence would have three ids.
- Keeping the `@beep/provenance` name as an alias. Chapter 11 rule 3 forbids it.

Reversal:

Mark this entry superseded by a new dated entry; restoring a design-module
shape after P2 is a further preimage or receipt version step under the
2026-11-19 scoped amendment, with a frozen fixture where rows are stored.

## 2026-11-22: L2 Annotation Documents and Lossless Extraction Handoff

Decision: @beep/annotation owns content-addressed standoff documents,
canonical checked JSON, generation attribution and the five-kind OA adapter.
The extractor verifies its capture before generation and keeps every parsed
candidate in a reading or residual, including the over-extraction-cap tail.
Semantica grounds historical unmapped-predicate residuals for replay without
registering their predicates. The deterministic Tika scaffold declares text-scaffold/1.
The nlp Handoff, Ontology kinds and float Graph span are deleted. Graph nodes
remain for P6; optional positions resolve only unique surfaces. DoCO aligns in P5.

Evidence: L2-1 through L2-6 in the annotation package tests and P3-H in
langextract, with the frozen semantica replay and office-action flow.

Reversal: supersede the P3 decisions and bump affected preimage domains; restore
retired facets from history only with migrated consumers and replacement laws.

## 2026-11-25: L3 To L7 Land; The nlp And schema-org Packages Retire

- **Status:** Active
- **Amends:** "`@beep/nlp` Splits Into `@beep/annotation` Schemas And
  `@beep/nlp-processing` Operations, Then Retires" (2026-11-19), as amended, not
  as delivered: the split deviated in the facets the table below names. Records
  "Vision Documents: Local-First Posture Withdrawn As Architecture; `THEORY.md`
  Absorbed" (2026-11-19) as delivered.

Decision:

Phases P4 to P7 of `goals/text-knowledge-stack-rebuild` land layers L4
(`@beep/epistemics`), L3 and L6 (`@beep/ontology`, `@beep/rdf`), L5
(`@beep/nlp-processing`) and the L7 agent-surface contract, as chapter 16
states them. Two private `foundation/modeling` packages retire through
`bun run beep delete-package`, each in its own commit with no alias and no
consumer left: `@beep/schema-org`, which had no importer or dependent, is
deleted whole, and `@beep/nlp`, whose four text helpers had no consumer,
retires after its facets were rehomed. Either source can be recovered from
commit 6265d739bb6 on `main`. Both names are reserved in
`standards/changesets.retired-packages.json`.

The split was delivered as follows:

| Facet | Ruled | Delivered | Evidence |
| --- | --- | --- | --- |
| handoff contract, `Kind` | `@beep/annotation` | `@beep/annotation` (P3) | the packet's P3 decisions |
| graph schema | `@beep/annotation` kinds | the graph node schemas moved with `Core` to `@beep/nlp-processing`; spans became an optional `Position` | the packet's decisions `2026-11-22-p3-graph-span-becomes-an-optional-position` and `2026-11-24-p6-core-and-graph-schema-move-to-nlp-processing-in-p6` |
| `Core` | `@beep/nlp-processing` | `@beep/nlp-processing` (P6) | commit 4bd2dbd4c3e |
| `Operations`, `Algebra` | moved to `@beep/nlp-processing` | replaced, nothing moved: `Operation` and `ActivityLogReducer` after the `effect/Combiner` and `effect/Reducer` census; both modules and their tests deleted | the packet's decision `2026-11-24-p6-nlp-operations-and-algebra-are-replaced-not-moved` |
| `GraphOps`, the four text helpers | retire | deleted (P6, P7) | commit 62385cf48d1 and 66a3513e3d6 |

The package's `THEORY.md` is absorbed by section 14 of
`16-knowledge-stack.md`: each kept claim names its ledger id, including the new
acceptance row `L5-4` (an unsupported backend operation fails with the typed
`BackendNotSupported`), and the claims no law backs are withdrawn. The cli
knowledge-base `Selector` keeps its text-quote case after the P7 re-check. The
vision document names chapter 16 as its architecture, marks BeepGraph as
Proposed, and drops local-first, on-device and named-subgraph framing as
architecture, with its companion documents.

Rationale:

The 2026-11-19 split ruling asked for a new dated entry before a deviating
phase. None was written when P3 and P6 placed the graph schema and replaced the
operations, so this entry records the delivered split once, with the facets
that deviated. Chapter 11 says this log records every retirement; P4 to P6 added
no entry, and one entry for the stack's merge is its history. Evidence: the
packet's `decisions/2026-11-24-p7-*` files and
`goals/text-knowledge-stack-rebuild/research/2026-11-24-p7-design.md`.

Rejected:

- Citing the split ruling as delivered. The graph schema and the operations did
  not land where it ruled.
- Moving the four text helpers or the schema.org vocabulary into a kept
  package. Neither had a consumer; moving dead code would add coverage and
  catalog rows for the next sweep to delete.

Reversal:

Mark this entry superseded by a new dated entry. Restore a retired package from
its recovery commit only with a consumer, migrated callers and replacement laws,
and remove its name from the retired-name registry in the same change.
