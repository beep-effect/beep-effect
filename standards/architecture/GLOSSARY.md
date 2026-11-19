# Architecture Glossary

This glossary defines the vocabulary used by
[`standards/ARCHITECTURE.md`](../ARCHITECTURE.md). Use these terms consistently
in code review, docs, architecture notes, and future enforcement work.

## Aggregate

A consistency boundary with an aggregate root. Use `aggregates/` when lifecycle,
invariants, or transitions span multiple child entities or values. In an
event-sourced slice an aggregate is a `Domain.Aggregate` declaration: an id
schema, a state schema, the commands it accepts, `decide` (state + command to
events or a rejection) and `evolve` (state + event to state). One instance is
one writer; there are no transactions across instances.

## Artifact Family

The top-level architecture class for a non-slice artifact. The canonical
non-slice families are `foundation`, `drivers`, `tooling`, and `ecosystem`.

## Artifact Kind

The canonical role inside an artifact family. Every non-slice artifact belongs
to exactly one family. Kinds remain required for families that intentionally
declare a kind segment, such as `foundation` and `tooling`; `drivers` and
`ecosystem` are the flat-family exceptions.

## Adapter

Code that connects product language to an external protocol, runtime, library,
or infrastructure capability. Server HTTP handlers, RPC handlers, repository
implementations, projections, and client command/query clients are adapters.

## Actionable Error

A typed failure that callers can branch on to drive product behavior. Access
denied, conflict, stale version, not found, invalid transition, and idempotency
violation are actionable. Driver connection failures are usually internal
until translated.

## Action Error

A public use-case failure exported from a use-case package's `/public` subpath.
Protocol handlers, clients, and UI code may branch on action errors. Port,
driver, and domain failures must be translated before they become action
errors.

## Admission

In the [knowledge stack](./16-knowledge-stack.md), a record that approves a claim
for a stated use. Its actor is the slice-supplied principal id, and it is
bound to that actor, an action, a revision and a scope,
and it exists only with two witnesses: a non-empty grounding witness whose
anchors verify against the current text digest, and a human token. Admission is
not truth, and a refused admission is a value, not an error. It is owned by
`@beep/epistemics` as vocabulary and by the slice that grants it as a record. It
is not [Re-admission](#re-admission), which rebuilds an Invocation at a hop.

## Agent (prov:Agent Versus Principal Versus Party)

Three different things. A `prov:Agent` is whatever a provenance record says
produced or asserted something: a software agent with its model or engine pin,
a person or an organization. A principal is who an action runs under, which the
[authority context](#authority-context) owns. A party is a person, organization
or collective agent as a product record in the party slice. A claim names its
asserting `prov:Agent`; an admission names its actor as a principal; neither
makes the other a party.

## Anemic Domain Model

A domain model that only describes data shape and maybe validation. An anemic
model does not own meaningful behavior.

## Annotation

A standoff record over one text capture: a kind from a caller-supplied
registry, a body, and a set of [occurrence](#occurrence) targets. Its id is the
hash of its content (deduplicated sorted targets, kind and body). Its kind
declares which annotations its body may reference, and the document check
resolves every reference in the same document. Who produced
it is kept apart as [Generation](#generation-attribution) records. The model
lives in `@beep/annotation` (`foundation/modeling`), with its RDF codec in an
adapter subpath.

## App Layer Helper

An app-local Layer composition module, usually
`apps/<app>/src/runtime/Layer.ts`, that composes public slice/package Layers for
one application. It is not a monorepo package family and must not own product
policy, handlers, repositories, schedules, workflows, or cross-slice
orchestration.

## Assessment Coordinate

One owner-declared axis of a claim's status, with a caller-supplied value
schema. `makeAssessments` in `@beep/epistemics` builds a total carrier over a
set of coordinates: each is assessed with a value or unassessed with a reason,
and a missing coordinate is a decode failure. Gates are owner-defined
predicates over the carrier. Coordinates and their transitions stay with their
owners, per the verdict law; `ClaimLifecycle` is one coordinate and stays in
`shared/domain`.

## Authority Context

The bounded context named `authority`: it owns grants, delegation and the
Accountability relation (every agent-rooted action names an accountable human),
and it is the only code that builds an [Invocation](#invocation). Other contexts
re-admit provenance through a port to it at each hop.

## Bounded Context

The unit of architecture: a boundary inside which every name has one meaning and
one owner holds the data and the invariants. A slice is a bounded context. One
`Domain.Model` per context is the default.

## Brand Package

A `foundation/ui-system` package that owns repo brand identity as schema-decoded
data: color scales per appearance, typography stacks, and mark geometry, with the
theme stylesheet and SVG assets generated from that data. Brand identity is a
design-system role, not product-domain language, so it is neither a slice concern
nor shared-kernel vocabulary. `@beep/brand` is the canonical instance; `@beep/ui`
may depend on it, never the reverse, so a brand-neutral component library stays
consumable by apps carrying another identity. Doctrine:
[07-non-slice-families.md](./07-non-slice-families.md).

## Candidate

An extractor's reading recorded as an annotation, such as a
`RelationCandidate` or `CorefCandidate`, with attribution and no claim status.
A candidate is not a claim: the consuming slice promotes it into its own
proposition union with stance `proposed`. It is not the epistemic slice's
`CandidateClaim` entity, which is a product record.

## Catalog (contract)

The aggregate-free declaration a contract package's `Domain.Api` is built over:
the context's commands, view read contracts and queries, shaped like a Model with
no aggregate. A parity test asserts each contract Api's RPC group equals the
model Api's. It is deleted once upstream splits the Api from the model.

## Claim (core)

What someone asserts, as a hashed, immutable core over a slice-owned
[proposition](#proposition): its logical key, the occurrences supporting it at
creation, the claims it was derived from, the record it supersedes if any, the
generating activity, the asserting agent, the valid time, the knowledge start
and the scope. Its knowledge interval ends at the knowledge start of the
record that supersedes it, so several unsuperseded records of one partition
may be current, with disjoint valid intervals. Stance,
challenges, admissions and retractions are separate records that point at the
core. The core is built by `makeClaimCore` in `@beep/epistemics` (Pending
P4), which replaces `makeClaimEnvelope` and its `ClaimVersion` in P4; a patent
claim, a Hohfeld legal position and a review verdict are not claims in this
sense.

## Client Package

Legacy seven-package slices only; a model-first slice has a [Web Package](#web-package).

The slice package that owns browser/client adapters, remote command/query
clients, client services, atoms, form models, and client state machines.

## Client-Safe Use-Case Export

A use-case export that may be imported by client packages without dragging
server-only orchestration or infrastructure into the browser. Command/query
language, driver-neutral boundary contracts, driver-neutral DTOs, actionable
application errors, and client-safe facade interfaces are usually client-safe. Those
exports must be re-exported from a client-safe subpath such as
`@beep/<slice>-use-cases/public`. Product ports, server-only service/facade
contracts, workflows, process managers, schedulers, and live Layer values are
not client-safe.

## Command (event-sourced)

A `Domain.Command` declaration, in the contract package of a model-first slice
(`<Module>/<VerbNoun>.command.ts`, with its events and private rejections) and
in `domain` of a legacy slice: the target aggregate's id schema,
its input fields, the events it may record, the rejections it may answer with,
its middleware list and an optional reply. Alchemy's command dispatch is the
use-case execution boundary.

## Contract Package

`@beep/<context>-contract`: what clients and other contexts import. It holds
ids, commands with their events and private rejections, read contracts,
integration facts, gateway contracts, capabilities and client Apis over the
[catalog](#catalog-contract). It resolves no model, host, aggregate, handler or
driver.

## Concept

A named domain idea such as `Membership`, `Account`, `Enrollment`, or
`Invitation`. Concepts are mirrored across packages by folder path and
distinguished by role suffix.

## Concept-Qualified Role Module Naming

The naming convention:

```txt
<package>/src/<domain-kind>/<Concept>/<Concept>.<role>.ts
```

Examples:

```txt
Membership.policy.ts
Membership.commands.ts
Membership.event-handlers.ts
Membership.command-client.ts
```

## Concept Scheme

A SKOS concept scheme: a named set of concepts with broader and narrower links
and labels, owned by `@beep/ontology` or loaded from a pinned edition. In
repo-owned schemes `skos:broader` is acyclic; an imported scheme's cycle is
recorded, since SKOS permits it.

## Config Contract

A typed application/runtime configuration contract expressed with Effect
`Config`, schemas, config services, and live/test Layers. A config contract may
be backed by environment variables, files, secret stores, static test fixtures,
or application entrypoint composition.

## Config Package

Legacy seven-package slices only; in a model-first slice each runtime (the host or the app) owns its configuration.

The slice package that owns typed config contracts for a slice:
`@beep/<slice>-config`. It may define public config, server config, redacted
secret config, config services, config vocabulary, and server/runtime-only
config resolution helpers that read from the ambient `ConfigProvider`. Config
packages publish those boundaries through canonical subpath names such as `/public`,
`/server`, `/secrets`, `/layer`, and `/test`. `/public` is the only
browser-safe config surface. Canonical subpath names are required names when that
role exists, not a placeholder-export requirement. Package roots and `./*`
exports may remain during migration, but they are transitional rather than the
canonical boundary contract. A config package is optional canonical-shape, and it
is not a broad constants package.

## Cleanup-On-Touch

A migration bucket for legacy or transitional shapes that do not require an
immediate sweep, but must be corrected when their boundary is edited. The
cleanup scope is the touched boundary, not the whole package family.

## Deployment Descriptor

Data a host publishes naming its models, its processes and the fact versions it
consumes (`<Context>.descriptor.ts`). An app composes descriptors onto pools and
generates the cluster entry modules from them; descriptors are also the registry
the fact-version retirement check reads.

## Domain-Kind Folder

Legacy seven-package slices only; a model-first slice uses [Module](#module) folders.

A folder that classifies the kind of domain concept. The canonical domain-kind
folders are `aggregates/`, `entities/`, and `values/`. `policies/` and
`services/` are escape hatches.

## Domain Package

Legacy seven-package slices only; a model-first slice splits it into its [Contract Package](#contract-package) and [Model Package](#model-package).

The driver-neutral package that owns rich models, values, aggregates,
contracts, domain events, pure policies, access vocabulary, and pure lifecycle
state machines.

## Driver

A technical capability package under `packages/drivers/<name>`. Drivers wrap
third-party or infrastructure concerns such as Drizzle, Postgres, SQLite,
EventLog, workflow engines, queues, sharding, transactions, retries, browser
APIs, and driver-local configuration. Driver packages use short public names
such as `@beep/drizzle`. When a driver exposes browser-safe functionality, it
must do so from `@beep/<driver>/browser`; the package root is not browser-safe
by default.

## Drivers Family

The non-slice family for flat repo-level external boundary wrappers. Drivers may
depend on `foundation` and other drivers when acyclic, but they do not depend on
product slices or the shared kernel.

## Ecosystem Package

A member of the flat `ecosystem` family
(`packages/ecosystem/<name>` = `@beep/<name>` = the npm name): a repo-authored
library built for external consumption and consumed in-repo like any
third-party dependency. Member `src/` and runtime manifest edges
(`dependencies`/`peerDependencies`) are `@beep/*`-free; tests and
`devDependencies` are unrestricted. Published-package standards supersede repo
effect-first style laws inside members. Charter:
[14-ecosystem-packages.md](./14-ecosystem-packages.md).

## Foundation Family

The non-slice family for domain-agnostic reusable substrate. Canonical kinds
are `primitive`, `modeling`, `capability`, and `ui-system`. Foundation packages
do not depend on product slices or the shared kernel.

## Entity Kit (frozen)

The hand-rolled entity substrate in `packages/shared/domain/src/entity/`
(`EntityKit`, `BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`,
`primitives`). Frozen since 2026-11-06: forbidden in new work, enforced by the
`entity-kit-freeze` law and its shrinking baseline, deleted with its last
consumer. `Principal`, `SourceKind`, `PublicEntityId`, `EntityId` and
`EntityRef` are value schemas, not part of the frozen kit.

## Entity

An identity-bearing concept. Use `entities/` for identity-bearing concepts that
are not aggregate roots, or simple concepts whose consistency boundary is only
themselves.

## Event (event-sourced)

A `Domain.Event` declaration: a past-tense business fact with the data a reader
needs. Events are the system of record for an event-sourced slice; each stored
event carries a schema version (a static on its class, default 1), upcasters
run at read, and stored events are never rewritten.

## Evidence (role)

A role a claim gives an occurrence, not a kind of object. An occurrence is
evidence for a claim when the claim's core or an admission's grounding names
it. Evidence weight is carried by the five typed signals, each present or
absent with a reason, never by a default number.

## Enforcement Lane

The way an architecture rule becomes real. Canonical lanes are `Doctrine`,
`Generated Default`, `Review Gate`, and `Hard Check`.

## Exact Exports

A package `exports` map that names each entry point, with no `./*` wildcard over
`src`. The source export map is the truth and the publish mirror is derived.
Required for every model-first package.

## Foundation Capability

A `foundation/capability` package: repo-owned, domain-agnostic technical
substrate that does not carry product semantics, does not wrap an external
engine or browser platform API, is not tooling, and is not UI-system ergonomics.
It needs multiple real consumers or explicit platform-capability rationale.

## Gateway Contract

A service declared in a provider's contract (`.gateway.ts`) that other contexts
call synchronously. A consumer calls it only through a port it declares in its
own model and implements in its host.

## Generation (attribution)

The record that one activity produced one annotation's content at one time:
a run-specific entity, hashed from the content id and the activity id, that is
a `prov:specializationOf` the content entity. Attribution is unique per content
and activity pair, and two records for one pair with different times are a
typed refusal on merge. It is not a [Stream Generation](#stream-generation).

## God Layer

A central runtime Layer that merges many unrelated slices and drivers into one
global dependency graph. God Layers hide ownership, create cross-slice coupling,
and make experiments expensive to remove.

## Handler Registry

`<Context>.handlers.ts` in a model package: the Layer of every handler the Model
needs, generated from the Model and checked by diff. It is never edited by hand.

## Headless UI Kernel

A repo-owned, product-agnostic UI substrate whose core is pure schema plus
geometry/state arithmetic, rendered by a separate DOM/React adapter package.
Both the kernel and its adapter anchor in `foundation/ui-system`; the purity
boundary is a package boundary — the kernel package carries no react
dependency, the adapter package owns every DOM concern. Example: `@beep/dock`
(kernel) with `@beep/dock-react` (its adapter, landing separately).

## Generated Default

An enforcement lane for architecture rules that future generators or scaffolds
should make the default. A generated default is still downstream from the
architecture standard; it does not make the standard a generator design.

## Hard Check

An enforcement lane for rules that should be mechanically enforced by lint,
package metadata, import-boundary checks, fixture checks, repo-cli commands, or
similar automation.

## Hexagonal Vertical Slice

A slice that combines vertical product modularity with hexagonal boundaries.
In a model-first slice the model declares its ports and the host implements
them; contexts meet only through contracts. In a legacy slice, domain and
use-cases sit inside every slice. Config sits inside the slice when
meaningful config contracts exist. Server, client, tables, and UI are adapters
around that core, while repo-level drivers stay outside the slice as shared
technical boundaries.

## Host Package

`@beep/<context>-host`: the server runtime's closure. It implements the model's
ports in `.adapter.ts` files, holds cluster classes, the consumer inbox and
HTTP or MCP surfaces, and publishes the context's
[deployment descriptor](#deployment-descriptor). It resolves its own model and
contract, other contexts' contracts and drivers, and never React or another
context's model or host.

## Identity Authority

The IRI root every beep identity mints under: `https://beep-effect.com/ns/`,
written once as `IdentityAuthority` in `@beep/identity` and carried as a
type-level literal by the `$I` composers, so `@beep/a/b` names
`https://beep-effect.com/ns/a/b`. It names things; it does not decide where
anything is hosted. Code derives IRIs from identity composers and never writes
the authority as a string. It is not the [Public Origin](#public-origin):
`/ns/` is the one route of the origin reserved for dereferencing these IRIs,
and `@beep/identity` never depends on `@beep/public-site`.

## Inbox

A consumer's record of integration facts it has handled, kept in its host and
keyed by producer, fact id and version. A fact delivered twice changes nothing,
and the commands it sends use request keys over the org, the operation and the
fact.

## Integration Fact

A versioned fact a context publishes for others (`.fact.ts` in its contract),
one event class per version. It is written by a projection over the producer's
aggregate events into a [published stream](#published-stream) and read by
consumers into an [inbox](#inbox). A private domain event is never an
integration fact.

## Internal Error

A technical failure that should be logged, traced, retried, or translated at a
boundary, but should not directly drive product behavior in domain/use-case
code.

## Invocation

The authority a command runs under: the principal, on whose behalf, the agent
run if any, and the grants in force. Only the [authority context](#authority-context)
builds one; the kernel holds its schema and the pure grant-check language.
Events store [provenance](#provenance-event-sourced), never an Invocation.

## Knowledge Graph

A projection of claims, annotations and terms into a graph store or RDF
dataset for query. It is generated, disposable and never a second writer; the
files and records it indexes stay canonical. A graph name never grants access:
[matter walls](#matter-wall) are enforced at query.

## Lab App

A private, law-abiding experimental application under `apps/labs/*`. A lab app
is production-shaped and durable while useful, but path-scoped out of package
ceremony so create and delete do not accumulate per-app shared configuration.
It is not a doctrine-11 feature-flag experiment inside a product runtime, and it
is not the law-relaxed, throwaway Scratchpad Lane. Product slices and public
package surfaces must not import a lab app; promotion moves earned work into its
lawful durable home. Doctrine: [15-lab-apps.md](./15-lab-apps.md).

## Layer (knowledge stack)

One of the eight roles L0 to L7 of the text-knowledge stack (identity, text,
annotation, taxonomy, claims, operations, interchange, agent surface), each
with an owner package, objects, arrows and laws
([16-knowledge-stack.md](./16-knowledge-stack.md)). Layer numbers name roles,
not a linear order; the dependency DAG is the constraint.

**Terminology caveat:** this is not an Effect `Layer`, the service-construction
value that [God Layer](#god-layer) and [App Layer Helper](#app-layer-helper)
refer to.

## Legacy Seven-Package Shape

The slice package family before the model-first shape: domain, use-cases,
config, server, client, tables and UI. Existing slices keep it until their own
migration under the checkers' baselines; no new slice and no new migration to
`@alchemy.run/domain` starts on it.

## Matter Wall

Authorization that keeps one matter's material out of another's. One authority
port in the law-practice slice answers whether a principal may act in a scope,
and every access path calls it: source retrieval, anchor resolution, graph
query, search and vector filtering, cache lookup, draft assembly and provenance
traversal. Identical bytes in two matters never grant cross-matter access, and
comparing two caller-supplied scope values is a consistency check, not a wall.

## Mention

An annotation kind for a span the extractor read as naming something, with its
class. A mention identifies text, not the thing named; the thing is a
[referent](#referent). A detection that adds meaning to an occurrence, such as
a citation mention, derives its id over the `OccurrenceId`.

## Model (event-sourced)

A `Domain.Model` declaration, in the model package of a model-first slice
(`<Context>.model.ts`) and in `use-cases` of a legacy slice: the aggregates, views, policies,
projections, streams and sagas hosted together. `Model.layer(handlers)` hosts
them on whatever Platform is provided. A `Domain.Api` selects what one kind of
caller may call from a model and derives HTTP, CLI and MCP surfaces from it.

## Model Package

`@beep/<context>-model`: the write and reaction model. It holds aggregates,
rules, views, streams, policies, sagas, projections, queries with their
`.handler.ts` implementations, store and external-system ports, the Model, its
Apis and the generated handler registry. It resolves its own contract, the
library, Effect, the shared kernel and foundation primitive and modeling
packages, and no driver, React, DOM, Node or other context.

## Modeling Package

A `foundation` kind for reusable schemas, brands, identity contracts, and
modeling vocabulary that higher-level foundation packages and slices may reuse
without taking product-domain dependencies.

## Module

A folder in a model-first package that holds one consistency boundary, process
or read model (`<Module>/<Noun>.<kind>.ts`). The same Module name appears in the
contract and the model. Modules replace domain-kind and subdomain folders.

## Namespace

A registered vocabulary prefix in `@beep/identity`: prefix and IRI. Every
namespace the repo speaks, external ones included (`prov:`, `oa:`, `nif:`,
`xsd:`, `gufo:`, `as:`), is registered, so CURIEs expand and contract
closed-world. An external namespace's pin (source, license, version, digest)
is a `NamespacePin` keyed by prefix in `@beep/rdf`, because `@beep/identity`
imports `effect` only.

## Occurrence

One place in one text capture. `OccurrenceId` (`@beep/text`) is the digest of
the versioned tuple of scope, source reference, locator, source and text
digests, extractor and normalization pins, offset unit, range and quote. It is
the only text-occurrence identity in the repository. Quotes locate and verify;
ranges identify.

## Ontology (OWL) Versus Taxonomy (SKOS)

An ontology states classes, properties and axioms a reasoner can check (OWL);
authoring one with a reasoner is the ontology slice (`packages/ontology`). A taxonomy
organizes concepts by broader and narrower links for navigation and
classification (SKOS); concept schemes, editions and mapping sets are
`@beep/ontology` in foundation, whose fold also emits RDFS and OWL
declarations. A SKOS hierarchy is not a subclass axiom.

## Proof Inventory

The generated list of a context's invariants, each with its checker, inputs,
assumptions, known gaps and evidence, checked for drift. Mechanical laws run
automatically; story coverage counts executed outcomes; semantic questions go to
a reviewer that did not write the change.

## Proposition

The content of a claim, as a value of a slice-owned union (the party slice's
`IdentifierOf` and `SameParty`, for example). No central proposition
union exists in `shared`, per the 2026-10-21 ruling; the foundation claim core
is generic over the proposition schema.

## Provenance (event-sourced)

What an event stores about the authority it was decided under: the root, on
whose behalf, the causal chain and grant ids, never grant terms. Each hop
re-admits it through the [authority context](#authority-context).

## Provenance (PROV) Versus Source Identity

PROV-O provenance records which activity, using what, produced an entity and
who was associated; its model lives in `@beep/rdf`. Source identity is what a
text capture is (`SourceTextIdentity`: artifact digest, extracted-text digest,
extractor and normalization pins) and lives in L1 with the anchors. Neither is
[event provenance](#provenance-event-sourced), the authority an event was
decided under.

## Provenance Anchor

A domain-agnostic value that pins derived knowledge to where it came from in a
source. The canonical shape is `TextAnchor` (`@beep/provenance`): a half-open
character range `[startChar, endChar)` into a source document plus the exact
quoted substring, re-sliceable as `text.slice(startChar, endChar)`. It is pure
provenance substrate — no confidence, claim, or domain semantics — and lives in
`foundation/modeling` so any slice's `domain` can ground knowledge in a source
span without depending on another slice. Consuming slices wrap it (e.g.
epistemic `EvidenceSpan` = `TextAnchor` fields + a `Confidence`). Beside it,
`@beep/text`, which replaces `@beep/provenance` in P2 of
`goals/text-knowledge-stack-rebuild`, adds the
[`Selector`](#selector) union and [`OccurrenceId`](#occurrence), the one
text-occurrence identity.

## Published Stream

A `Domain.Stream` that carries [integration facts](#integration-fact), served
by the producer's host as a feed. It is pinned to its writer, generation and
sources, is never rebuilt in place, and serves closed generations followed by
the open one as one log.

## Schema Concept Module

A flat public `@beep/schema/<Concept>` module that owns one reusable
domain-agnostic schema concept or concept family. Consumers import it as a
namespace and use role members such as `Schema`, `Input`, or `FromInput`.
Concept modules use PascalCase exact subpaths; retired lowercase topical
subpaths such as @beep/schema/color are not compatibility surfaces.

## Schema Flat Facade

The curated `@beep/schema` package root. It re-exports common schema helpers and
legacy flat names for convenience and compatibility, but it is not the canonical
home for full schema concept namespaces or retired topical paths.

## Schema Role File

A source file under `packages/foundation/modeling/schema/src/<Concept>/` whose
suffix names its responsibility, such as `.schema.ts`, `.input.ts`, or
`.transforms.ts`. Schema role files are source topology; public consumers import
the concept index. Package exports must point at concept indexes, not role
files.

## Schema Utility Namespace

A utility-oriented `@beep/schema` namespace whose public concept is a helper or
combinator rather than a reusable data schema. `SchemaUtils` may expose helper
leaves such as `@beep/schema/SchemaUtils/collectAnnotationsAt` when direct helper imports are
the intended API.

## Port

A product-language capability the model needs from outside itself. In a
model-first slice ports live in the model (`.external.ts`, `.store.ts`, a
consumer port over another context's gateway), are listed in
`<Context>.ports.ts`, and are implemented by `.adapter.ts` files in the host. In
a legacy slice ports live in `use-cases` and are implemented in `server`.

## Port Error

A server-only failure declared by a use-case port and exported from the use-case
package's `/server` subpath. Adapters translate driver/internal failures into
port errors; use-case services translate port errors into public action errors.

## Private (in app-layer composition)

Anything not exported through a canonical subpath (`/public`, `/server`, `/secrets`, `/layer`, `/test`) of a package's public root. App-level composition (e.g., `apps/<app>/src/runtime/Layer.ts`) may import only from canonical subpaths; reaching past them into a package's internal module structure is the boundary violation. The same rule applies to any consumer outside the owning package: only canonical subpaths are public.

## Product Port Implementation

A server-side implementation of a use-case port. Example:
`server/src/entities/Membership/Membership.repo.ts` implements
`MembershipRepository` using tables and drivers.

## Promotion Record

A package README entry that proves a high-bar shared export earned its home. It
records shared product semantics, consumers or cross-slice rationale, exported
surface, rejected homes, runtime/driver/Layer limits, and review evidence.

## Canonical Subpath Name

A canonical export name for a boundary-sensitive package role. Required means
use this subpath name when the role exists; it does not require placeholder
exports from packages that do not need that role.

## Platform (event-sourced)

The alchemy `Platform` contract: `model(hosted)` returns a `ModelHost` whose
factories give each aggregate, view, policy, projection and stream its store.
The driver owns single-writer-per-id, command dedupe, atomic persistence of
events, state, receipt and deliveries, ordered at-least-once delivery, and
replay. Effect Cluster on Postgres is the first host for model-first slices, with the
library fixes carried as root patches until an Alchemy release includes them.
`@beep/alchemy-postgres` is the legacy slices' Postgres Platform and remains
until then; `Domain.InMemory` hosts tests and Stories.

## Policy Pack

A declarative policy/configuration bundle. In `tooling`, policy packs publish
shared governance data or config presets. Policy packs are not executable
applications.

## Public Config

Browser-safe config contracts and services exported from a config package. Client
packages may import public config; they must not import server config or secret
config.

## Public Origin

The single hosting origin for everything the repo projects to developers and
agents, `https://beep-effect.com`, owned as the schema-typed `PublicOrigin`
by the foundation package `@beep/public-site`. The apex hosts ring-0
projections of the public substrate at reserved [Site Routes](#site-route);
services and instances that are not projections (a practice instance, the
proxy, anything authenticated) live on subdomains. Hosted URLs come from
`hostedUrl` and `labRoute`, never string literals. It is not the
[Identity Authority](#identity-authority); a drift test in `@beep/public-site`
keeps the `/ns/` route equal to the authority.

## Protocol Declaration

A driver-neutral boundary contract such as an HttpApi endpoint group, Rpc
group, AI tool contract, or cluster entity protocol. Protocol declarations live
in `use-cases`; handlers, clients, transports, runtimes, persistence, and
driver access do not.

## Projection

A writer that consumes events and updates a read model outside the model. In a
model-first slice it is a `.projection.ts` in the model with its `.handler.ts`
beside it, writing a store port or a stream; a projection that feeds a
[Published Stream](#published-stream) reads aggregate events directly and is
never rebuilt in place. In a legacy event-sourced slice it is a `Domain.Projection` declaration in `use-cases` with
its `toLayer` implementation in `server`; legacy drizzle tables are rebuilt by
projections after a single-writer cutover. Read-model table declarations belong
in `tables`.

## Read Model

A persistence shape optimized for queries, UI, reporting, or projections. Read
model tables use `.read-model-table.ts` and are composed by `ReadModels.ts`.

## Re-admission

The step at each hop where a policy or saga asks the authority context to
rebuild an Invocation from a stored provenance and live grants. It never adds a
grant and passes those still in force; a command that needs a lapsed one is
refused and the refusal recorded.

## Referent

The thing a mention names, as distinct from the text that names it. Referents
and relations between them are slice-owned claims; coreference is a versioned
partition claim with a stable referent id, not a property of the annotation.

## Reflection / Reflection Artifact

A reflection is a structured, evidence-grounded retrospective written at goal
closeout or on demand. A reflection artifact is its schema-validated,
append-only record at
`goals/<slug>/history/reflections/<YYYY-MM-DD>-<agent>.md`; it captures tooling
experience, implementation improvements, goal or prompt critique, codification
TODOs, and confidence-tiered lessons for later consolidation.

## Rich Domain Model

A domain model that owns shape, validation, and pure behavior. Rich behavior may
be instance methods, exported pure functions, `*.behavior.ts`, or pure
`*.policy.ts` modules.

## Review Gate

An enforcement lane for contextual or exception-based rules that need explicit
review evidence instead of purely mechanical checking.

## Schema-First Model

A pure data model whose `Schema` value is the source of truth. TypeScript types,
constructors, decoders, encoders, guards, equivalence, defaults, validation
messages, and documentation metadata derive from that schema instead of living
beside it as parallel definitions.

## Role Suffix

The filename suffix that states a module's role. Examples include `.model.ts`,
`.policy.ts`, `.ports.ts`, `.http-handlers.ts`, `.projections.ts`, and
`.config.ts`.

## Secret Config

Server-only secret configuration represented with redacted values. Secret config
must live behind explicit secret/server-only modules and must not be exported
through `/public` or any other browser-safe surface.

## Selector

The one selector union of `@beep/text`, after Web Annotation's: `Position`
(unit, start, end), `Quote` (exact, prefix, suffix), `Fragment`, `Refined` and
`Range`. `resolve` maps a capture and a selector to `Unique`, `Ambiguous` or
`NotFound`; an ambiguous quote never resolves to its first hit. `TextAnchor`
keeps its wire shape beside it.

## Server Config

Server-only config contracts and services exported from a config package. Server
config may include runtime settings that are not safe or meaningful in browser
bundles.

## Shared Kernel

The DDD meaning of the `shared` package family: deliberately shared
cross-cutting language, value objects, schemas, config contracts, and a small
number of high-bar cross-slice adapters. `shared/domain` is the active normal
home today; `shared/config` is a reserved normal role. `shared/client`,
`shared/server`, and `shared/ui` are reserved high-bar roles, not package
directories today. `shared/tables` exists but remains exceptional.
`shared/use-cases` exists as a high-bar contract-only package: it may hold cross-slice
commands, queries, driver-neutral DTOs, driver-neutral boundary contracts,
client-safe application errors, facade interfaces, and ultra-high-bar product
ports, but not workflows, process managers, schedulers, handlers, concrete
adapters, driver imports, or live Layers.
Model-first contexts use only the kernel's language (ids, the `Invocation` and
`Provenance` schemas, the grant-check language, the fact envelope, the request
key, the descriptor and stream pin schemas); their synchronous contracts live in
the provider's contract package, never in `shared/use-cases`.
Shared packages consume shared-kernel language from shared and may consume
appropriate `foundation` packages beside it; they do not own drivers. Shared
is not a synonym for `common` or `foundation`, and it is not a place for
miscellaneous leftovers from product slices.

**Terminology caveat:** strict DDD uses "shared kernel" for code shared across team boundaries with explicit cross-team coordination. In this monorepo the term is used for *deliberate cross-slice product language within a single team's codebase* — closer to a "published language for an internal context." The connotations of high coordination cost still apply (every promotion record is a small coordination act), but the cross-team framing does not. The term is kept because it does the work of distinguishing "deliberate cross-slice" from "junk drawer."

## Session Middleware (event-sourced)

The `RpcMiddleware.Service` a command, view or stream declares to authenticate
its caller. Its server half resolves the session and provides the
`RequestContext` (principal, source kind) that `decide` and `validate` read and
that, in a legacy slice, the Platform driver persists as provenance. In a
model-first slice the library does not persist request context: events store
[provenance](#provenance-event-sourced) in their payload, and only the authority
context builds an Invocation. Views are security boundaries: `validate` judges
every read, and one view per kind of caller replaces caller filtering.

## Site Route

A reserved first path segment of the [Public Origin](#public-origin), such as
`ns`, `taxonomy`, `docs`, `api`, `storybook`, `llms.txt`, `mcp`, `labs`,
`goals`, `explorations`, `research`, `.well-known` or `sitemap.xml`, modeled
as the `SiteRoute` `LiteralKit` in `@beep/public-site`. A route is reserved
before it is deployed, and each deployment is its own goal. `labs` routes take
the lab's portless name so lab-grade surfaces never read as official. A Site
Route is not a subdomain and not a slice or package name.

## Slice

A bounded context: it owns a language, its data and its invariants, with one
`Domain.Model` by default. A model-first slice ships as four packages,
`contract`, `model`, `host` and `web`, one per dependency closure. A legacy
slice is the seven-package family (domain, use-cases, config, server, client,
tables, UI). Drivers stay repo-level instead of being slice package kinds.

## Saga (event-sourced)

A `Domain.Saga` declaration, in the model package of a model-first slice with
its `.handler.ts` beside it and in `use-cases` of a legacy slice: an Effect
workflow keyed by the
aggregate it is about, with one command per `Activity` step, compensations and
durable waits. In a legacy slice its `toLayer` implementation lives in `server`
and runs on the workflow engine the Platform driver provides (`effect/cluster`
on Postgres). Its activity results are a stored format: an incompatible change
is a new saga version.

## Scratchpad Lane

A temporary experiment home under `scratchpad/` or explicitly temporary
`packages/_internal/*` packages. Scratchpad code may prove an idea, but product
slices and public package exports must not import it. Promotion re-enters
through the smallest legal slice shape. The lawful next step for an experiment
that outgrows the lane is a [Lab App](#lab-app).

## Stance

The admission workflow position of a claim record: `verbatim` (what the source
says), `proposed` (what a machine or person put forward) or `admitted`. It is
owned by `@beep/epistemics`. It is not the verdict law's `SemanticStance` stem,
which says whether evidence supports or contradicts a claim.

## Stored-Format Law

Stored bytes are never rewritten; schemas convert on read. It covers events,
state, receipts, request context, saga payloads and saga activity results. An
incompatible saga change is a new saga version, and runs in flight finish on
the version they started.

## Stream Generation

One writer's span of a published stream. A change to the projection behind a
stream closes the generation and opens a new one. A closed generation stops
being served only when the next holds every fact it held, every consumer has
read past it and positions keep their meaning.

## Tables Package

Legacy seven-package slices only; in a model-first slice a table is a projection store or an inbox store in the host.

The slice package that owns product-specific persistence schema and mapping.
Tables are the slice-local persistence adapter surface for product schema and
mappings. They are not domain and they are not generic driver wrappers.

## Term

A registered vocabulary term in `@beep/identity`: IRI, namespace and local
name, with deprecations as separate `Deprecation` records (term, since,
replacement). Optional gUFO class typing (type of type, category of
instances, and for a relator the role terms it mediates) is a record keyed by
term IRI in `@beep/ontology`. A published term IRI is declared in the
`@beep/identity` registry and bound to code through
`TermBinding`, never derived from a code path; the published set changes only
with a deprecation record.

## Tooling Package

A code-bearing package in the `tooling` family. Canonical kinds are `library`,
`tool`, `policy-pack`, `test-kit`, and `infra` (Alchemy stacks for repo-platform
infrastructure). Tooling packages support development and operations;
product/runtime code does not depend on them.

## Triage Policy

A named, versioned ranking over claims or review items for an interface, such
as deadline proximity or unresolved review. It is tested on unknowns and ties,
keeps uncertain items visible, never crosses an admission gate and never writes
authority. It replaces any default algebra over evidence signals.

## Use-Case Package

Legacy seven-package slices only; in a model-first slice commands live in the contract and their decisions in the model's aggregates.

The slice package that owns application intent: commands, queries,
driver-neutral boundary/protocol contracts, authorization, ports,
service/facade contracts, slice-local workflow/process/scheduler contracts, and
public action errors. Canonical export surfaces are `/public`,
`/server`, and `/test`.
`/public` is client-safe application contract surface. `/server` is server-only
application contract surface. Package roots and `./*` exports may remain during
migration, but they are transitional rather than the canonical boundary
contract.

## Value Object

A concept with no identity. Value objects own validation and pure behavior.
Promote value objects to `values/` only when they are reused; otherwise keep
them local to the concept that uses them.

## View (event-sourced)

A `Domain.View` declaration, in the model package of a model-first slice (its
read contract repeated in the contract as a `.read.ts`) and in `domain` of a
legacy slice: a pure fold of events from one or more
aggregates or views into state keyed by what it is about, with `validate` as its
security boundary. MCP tools derived from an `Api` expose Views only until the
view-security tests pass.

## Web Package

`@beep/<context>-web`: React screens over bindings generated from the contract,
with a `.machine.ts` and `.controller.ts` where a screen's interaction state
earns them. It imports its own model only for a listed `Aggregate.predict`
screen.

## Work, Expression And Manifestation (profile)

The LRMoo distinction between an abstract work, a realization of it and a
physical or digital embodiment, used as a profile at the interoperability
boundary, not as internal kinds: no internal record is typed as a work, an
expression or a manifestation.

## Workflow

A durable application process. Workflow declarations belong in `use-cases` when
they are product/application concepts. Runtime workflow handlers belong in
`server`; engines and storage belong in `drivers`.

## Verdict family (epistemic vocabulary law)

Ratified 2026-08-17 at the `epistemic-belief-view-revision` graduation. The
canonical stems for evaluation outcomes, and the ownership law binding them:

| Concern | Canonical stem | Owner |
| --- | --- | --- |
| Shape validity | `ShapeValidationResult` | the schema-owning domain |
| Anchor fidelity | `AnchorVerificationResult` | `@beep/provenance` |
| Semantic stance | `SemanticStance` | epistemic domain |
| Source authority | `SourceAuthorityAssessment` | the consuming legal/domain slice |
| Human decision | `HumanDisposition` stem; domain-qualified concretes (e.g. `ClaimDisposition`) | the domain owning the reviewed subject |
| Action authorization | `ExecutionVerdict` | governed-execution boundary |
| Release | `ReleaseDisposition` | the release-owning boundary |

**Law:** names may be shared; vocabularies stay decentralized. Structural
verification lives with the structure it verifies; human dispositions with
the reviewed subject; authorization at the enforcement boundary. A consumer
(e.g. a belief-view policy) may read typed values from several families and
owns none of their truth or disposition semantics. Uniform `...Verdict`
naming is rejected: it erases the distinction between validation,
classification, assessment, recorded disposition, authorization, and release.
