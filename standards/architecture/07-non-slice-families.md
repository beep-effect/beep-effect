# Non-Slice Families

Not every important artifact in the repo is a product slice.

Some packages exist to provide domain-agnostic substrate. Some exist to support
development and operations. Some exist to wrap external engines and SDKs. If
those artifacts are all described as
`common`, `shared`, or `core`, the repo loses the same compressed context that
slice topology gives product code.

This is why non-slice artifacts get first-class family grammar, with kind where
applicable.

## Why `common`, `shared`, And `core` Are Not Enough

Those names are attractive because they feel flexible. The problem is that they
compress nothing.

If a package is called `common`, a reader still has to open files to discover
whether it is:

- a schema/identity substrate
- a shared UI primitive library
- a repo CLI
- a config preset bundle

That is exactly the ambiguity the architecture is trying to remove.

When translating legacy `common`, default to `foundation`. Route to `shared/*`
or the owning slice instead when the code carries durable product semantics.

## Specific Homes Before Capability

`foundation/capability` is the last generic destination, not the default home
for reusable technical code.

Route in this order:

1. Product semantics go to the owning slice or `shared/*`.
2. External engines, SDKs, services, frameworks, and browser platform wrappers
   go to `drivers`.
3. Repo operations, generators, policy packs, and automation go to `tooling`.
4. Product-agnostic UI primitives, themes, tokens, hooks, and composition
   helpers go to `foundation/ui-system`.
5. Only remaining repo-owned, domain-agnostic technical services may go to
   `foundation/capability`.

`foundation/capability` must pass a negative gate plus proof:

- no product semantics
- no external-engine, third-party SDK, service, framework, or browser platform
  wrapping
- no repo-operational/tooling purpose
- no UI primitive, design-system role, or React ergonomics layer
- **≥2 named consumers currently importing the package**, listed by name in the
  package's README

One importer is not promotion-ready. The README must name each importer with a
one-line note on what it uses the capability for; this list is checked at PR
review.

Reusable shape alone is not proof. A `Context.Service` or Layer can belong in
the owning slice, `drivers`, `tooling`, or `foundation/ui-system` depending on
what it wraps and who owns the meaning.

### Worked rejection example: "schema validator wrapper"

A proposed `foundation/capability/schema-validator` package wraps
`S.decodeUnknownEffect` with a custom error formatter and is imported by the
iam slice's HTTP handlers.

Looks like a capability: domain-agnostic, reusable, no product semantics,
would-be importable from anywhere.

Fails the gate because:

- Only one current consumer (iam HTTP handlers); the gate requires ≥2.
- The functionality is a thin formatter over a v4 `Schema` API; "reusable shape
  alone is not proof."
- The owning home is correct: it's an HTTP-layer concern. It belongs in iam's
  server package as an internal helper, or — if a second slice's HTTP handlers
  later want the same formatter — in `tooling/library/http-formatters` (a
  tooling library), not in foundation.

The shape of the rejection: a capability candidate is rejected by **(a)** a
consumer count below 2, **(b)** the existence of a more specific home
(`drivers`, `tooling`, slice-local), or **(c)** the candidate being an
ergonomic wrapper around an existing capability rather than a capability
itself.

## The Family And Kind Grammar

The canonical non-slice families are:

- `foundation`: domain-agnostic reusable substrate
- `drivers`: flat repo-level external boundary wrappers
- `tooling`: developer-operational code packages
- `ecosystem`: flat publishable libraries authored for external consumption

Every non-slice artifact declares one canonical family. Kind remains required
only for families that intentionally declare a kind segment.

```txt
packages/foundation/<kind>/<name>
packages/drivers/<name>
packages/tooling/<kind>/<name>
packages/ecosystem/<name>
```

The path is the first layer of context compression. The manifest metadata is the
second. Humans should infer role from the path. Tooling should enforce the same
fact from metadata.

`drivers` and `ecosystem` are the explicit flat-family exceptions. Each
records family metadata, omits `kind` in manifest metadata, and does not add a
second `<kind>` segment.

## Internal Admin Packages

`packages/_internal/db-admin` is the durable internal migration aggregation home
for repository-owned database administration proof and generated migration SQL.
It is not a product slice, shared kernel, foundation package, driver, or public
runtime API. Product apps and product slice packages must not depend on it.

The package may import slice table packages to aggregate Drizzle schema and may
own generated migration artifacts, migration target metadata, and live migration
tests. That exception is intentionally narrower than a general `_internal`
package family: new durable internal packages still need an explicit
architecture decision or a canonical `tooling`/`drivers`/`foundation` home.

## `shared` Is Not `foundation`

`shared` remains the DDD shared kernel.

```txt
shared      = deliberate cross-slice product language
foundation  = domain-agnostic reusable substrate
```

That distinction matters because the coupling is different.

Promoting something into `shared` means slices are intentionally agreeing on the
same product semantics. Promoting something into `foundation` means the package
is useful without creating product-domain coupling.

Generic schema helpers, identity helpers, markdown utilities, or terminal-color
helpers belong in `foundation`, not `shared`. Shared-kernel value objects or
shared config contracts belong in `shared` when multiple slices deliberately
share the same meaning.

## Why `drivers` Stay Separate

`drivers` and `foundation` are not interchangeable.

```txt
drivers    = external engines, SDKs, and service boundaries
foundation = repo-owned substrate the repo increasingly owns
```

If the code wraps Drizzle, Postgres, Firecrawl, browser APIs, or another
third-party engine behind a dev-safe boundary, it belongs in `drivers`.

If the repo owns the implementation as internal substrate, it belongs in
`foundation` instead.

`shared` never owns technical wrappers or external drivers.

## Why `ecosystem` Points Outward

`ecosystem` is the fourth family and the only one whose audience is not this
repo:

```txt
drivers    = external engines wrapped for THIS repo's consumption
ecosystem  = repo-authored libraries built for EXTERNAL consumption
```

Members are publishable npm packages the repo authors and then consumes like
any third-party dependency. That outward audience inverts the import polarity:
member `src/` and runtime manifest edges are 100% `@beep/*`-free, while tests
and `devDependencies` may use repo harnesses freely. Published-package
standards supersede repo effect-first style laws inside members.

The family charter — inverted gate, style-law scoping, artifact and peer
policy, release lane, gate profile, promotion and demotion — lives in
[14-ecosystem-packages.md](./14-ecosystem-packages.md).

## Why UI Primitives Stay In `foundation`

A shared primitives library such as `@beep/ui` is not a slice and not a shared
kernel package. Its job is to provide domain-agnostic building blocks:
primitives, themes, tokens, hooks, and composition helpers.

That makes it a `foundation/ui-system` package.

This keeps the mental model clean:

- slice UI owns product screens and workflows
- shared kernel owns cross-slice product language
- `foundation/ui-system` owns product-agnostic UI primitives

`ui-system` is a side branch of foundation. It may depend on
`foundation/primitive` and `foundation/modeling`, but it does not depend on
`foundation/capability` by default. It may also import a driver's
browser-safe pure root (pure helpers, schemas, service tags) and default a
driver's browser-safe `/browser` layer as an overridable injection default —
never a driver's server-only or secret-bearing surfaces (narrow edge ratified
2026-07-14; see `DECISIONS.md`).

Browser/runtime helpers follow platform-first routing:

- low-level browser platform wrappers belong in `drivers` and expose their
  browser-safe surface through `@beep/<driver>/browser`
- thin product-agnostic React hooks or components belong in
  `foundation/ui-system`
- product-specific browser state and behavior belong in slice `client` or `ui`
- rare runtime-neutral technical services may belong in
  `foundation/capability` only after the capability gate

Driver package roots are not browser-safe by default. Foundation package roots
must be runtime-neutral or browser-safe by contract; environment-specific
foundation surfaces need explicit environment entrypoints.

## Why Tooling Uses A Small Kind Catalog

Tooling has many jobs, but it does not need many architectural kinds.

- `library` covers reusable repo-analysis and support code
- `tool` covers CLIs, pipeline tools, and orchestrators
- `policy-pack` covers config presets and governance data
- `test-kit` covers reusable testing helpers

This keeps the family legible while still making dependency rules visible.
Repo-wide orchestration is behavior inside `tool`, not a separate one-off
package kind.

Tooling may compose a driver directly when the package is acting as an
operational adapter around a product-neutral external engine. Typical examples
are repository analytics, generators, migration tools, fixture builders, and CLI
workflows. This is not permission for product semantics to enter `drivers`, and
it is not permission to route reusable runtime substrate through `tooling`.
Every such package must own the direct dependency and project reference it
imports.

## `@beep/schema` Concept Module Topology

`@beep/schema` is the canonical `foundation/modeling` home for reusable Effect
Schema schemas, codecs, schema combinators, and schema-adjacent helpers. It is
domain-agnostic substrate, not shared-kernel product language.

The package follows an Effect-inspired public module style while avoiding
Effect-sized source files. Public schema concepts use flat concept subpaths:

```ts
import * as Duration from "@beep/schema/Duration"
import * as Glob from "@beep/schema/Glob"

Duration.Input
Duration.FromInput
Glob.Schema
```

The package root remains a curated flat facade for convenience and migration:

```ts
import { DurationInput, Glob, TaggedErrorClass } from "@beep/schema"
```

Root exports are not the canonical place for full concept namespaces. New
examples and new internal package code should prefer `@beep/schema/<Concept>`
when consuming a reusable schema concept with adjacent input, transform,
constructor, guard, or type-level members.

Concept source topology is role-file based:

```txt
packages/foundation/modeling/schema/src/Duration/
  Duration.schema.ts
  Duration.input.ts
  Duration.transforms.ts
  index.ts
```

Only the concept index is public. Role files are source topology. Public
consumers should not import `@beep/schema/Duration/Input` or similar role
subpaths. Utility namespaces such as `SchemaUtils` are the exception: when a
helper is itself the public concept, helper leaves may stay public. Former
topical suites are represented by PascalCase leaf concept modules and flat
exact public subpaths. Lowercase topical source and public paths such as
`src/color/`, `src/http/`, `@beep/schema/color`, and
`@beep/schema/http/headers` are retired topology, not compatibility surfaces.
Suite aggregate modules such as `@beep/schema/Dom` and `@beep/schema/Http` are
retired; import leaf concept modules such as `@beep/schema/DomReactNode` and
`@beep/schema/HttpStatus` instead.

Core role suffixes are `.schema.ts`, `.input.ts`, `.transforms.ts`,
`.constructors.ts`, `.guards.ts`, `.errors.ts`, and `.types.ts`. Earned
semantic roles are allowed for clearer specialized modules such as parser,
formatter, SQL projection, or color-conversion roles.

Inside the namespace, concise role names are canonical. Prefer
`Duration.Input`, `Duration.FromInput`, and `Glob.Schema` over repeated names
such as `Duration.DurationInput` in new code. Legacy full names may remain as
aliases while consumers migrate.
Promote source concepts rather than individual exported symbols; for example,
`HttpStatus` remains one concept module rather than a public subpath per status
literal.
The repo enforces the closed topology with
`bun run beep lint schema-topology`, which checks `@beep/schema` source
directories, package exports, role-file privacy, retired suite aggregators,
private parser seams, and root alias drift.

## Repo CLI Command Topology

`packages/tooling/tool/cli` is the canonical repo-operational CLI home. Its
command topology is thresholded: tiny leaf commands may stay single-file, but
command groups and commands with schemas, services, renderers, or multiple
subcommands move into `commands/<Group>/`. The `commands/` namespace is for
registered command surfaces and command-owned private roles; non-command helper
models belong under `src/internal/cli/` or the package that owns the reusable
substrate.

Canonical command group roles:

- `<Group>.command.ts`: flags, arguments, `Command.make`, and adapter glue.
- `<Group>.schemas.ts`: option, result, report, and manifest schemas.
- `<Group>.errors.ts`: one exported `<Group>CommandError` for command-boundary
  failures.
- `<Group>.service.ts`: `Context.Service` contract, constructor, and default
  live layer.
- `index.ts`: curated public facade for the command, public schemas/types,
  command error, and service contract.

Earned roles should be semantic: prefer `<Group>.render.ts`,
`<Group>.progress.ts`, `<Group>.paths.ts`, `<Group>.media.ts`, or
`<Group>.plan.ts` over `<Group>.utils.ts`. Use `<Group>.config.ts` only for
runtime/config-provider settings, and add `<Group>.layer.ts` only when a
command group has multiple or non-trivial layer variants.

Only package root and explicit `@beep/repo-cli/commands/<Group>` facades are
public command import surfaces. Deep role files, `internal/`, and command-owned
shards are private. Package-local tests that need internals use source-only
`@beep/repo-cli/test/<Group>` aliases; those aliases are not package exports and
must not appear in the public export catalog.

## Worked Examples

```txt
packages/foundation/modeling/schema
  -> reusable schema/modeling substrate

packages/drivers/drizzle
  -> repo-level Drizzle driver

packages/foundation/ui-system/ui
  -> shared UI primitives and themes

packages/tooling/tool/cli
  -> repo operational CLI

packages/tooling/policy-pack/repo-configs
  -> shared governance/config packets
```

The pattern is the point: a reader should know the job of the artifact before
opening the first source file.
