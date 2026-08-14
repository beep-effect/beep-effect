# Shared Kernel

The `shared` package family is a DDD shared kernel.

That phrase is doing real work. It means shared code is a deliberate contract
between slices, not a place to put whatever happens to be reusable today.

## What Belongs In Shared

Shared may contain:

- `shared/domain` value objects and semantic building blocks tied to product
  language
- `shared/domain` driver-neutral primitives that multiple slices deliberately
  share
- `shared/domain` entity metadata constructors when they encode shared product
  semantics such as tenant organization scoping, actor provenance, and
  source-kind vocabulary rather than reusable domain-agnostic schema substrate
- future `shared/config` contracts and config vocabulary that multiple slices
  deliberately agree on
- promoted `shared/use-cases` application contracts when multiple slices
  deliberately share commands, queries, driver-neutral DTOs, driver-neutral
  boundary contracts, client-safe application errors, facade interfaces, or
  ultra-high-bar product ports, with each export subject to a promotion record
  per the appendix below
- `shared/tables`, and future `shared/client`, `shared/server`, or `shared/ui`
  packages, only when they encode deliberate cross-slice product semantics and
  only with a promotion record per the appendix below

Shared should feel boring, small, and carefully named.

## What Does Not Belong In Shared

Shared should not contain:

- product-specific behavior from one slice
- a partial domain model waiting for a home
- driver-specific leakage that domain packages will inherit
- workflows, process managers, schedulers, handlers, or concrete adapters that
  execute shared contracts
- one-off convenience wrappers created to avoid a local import
- global registries that make slices depend on each other indirectly
- app-wide config registries that aggregate every slice's private config
- generic schema kits, identity kits, or reusable technical capability packages
- product-agnostic UI primitive libraries
- technical wrappers or external drivers
- repo tooling or runtime-specific assistant wiring

`shared/tables` may use a metadata-only table constructor for shared entity
descriptors when the resulting tables encode shared product language. It must
not grow live database execution, transaction management, migration tooling, or
repository helpers; those belong in drivers and server packages.

If a concept belongs to `iam`, keep it in `iam`. Promote only when the concept is
truly shared and the owning teams/slices accept the coupling.

## Shared Is A Cross-Slice Slice

`shared` is not a special horizontal bucket. It is the canonical cross-slice
slice with a deliberately reduced spine. The active package directories today
are `domain/`, `use-cases/`, and `tables/`:

```txt
packages/<kernel>/
  domain/
  use-cases/ # contract-only; promotion record required per export
  tables/ # promotion record required per appendix
```

Reserved role names are `config/`, `client/`, `server/`, and `ui/`; create one
only when real exported behavior clears the promotion bar. `shared/use-cases`
now exists as a contract-only exception because the tenant-bound
`PromotionGate` contract cleared that bar.

The `shared/use-cases` package is contract-only. It may hold cross-slice
commands, queries, driver-neutral DTOs, driver-neutral boundary contracts,
client-safe application errors, facade interfaces, and ultra-high-bar product
ports. Product ports are exceptional even inside this exception: the promotion
record must prove why a shared command/query/facade contract is insufficient. It
does not hold workflows, process managers, schedulers, handlers, concrete
adapters, driver imports, or live Layer values.

It follows the same explicit export contract as slice
`use-cases`: `/public`, `/server`, and `/test`. `/public` stays
client-safe. `/server` is limited to server-only shared application contracts
such as server-only facade interfaces and ultra-high-bar product ports. `/test`
is for test helpers and fixtures.

This is what keeps `shared` small. The reduced spine is a rule, not a
suggestion.

## Promotion Records

Meaningful exports in `shared/*` packages requiring a promotion record must
include one in the affected package README before or alongside the export, per
the schema in the appendix below. This applies to active `shared/tables` and to
`shared/use-cases` and any future `shared/client`, `shared/server`, or `shared/ui`
package. It also applies when a normal shared package adds a new durable product
concept whose coupling is not already obvious from existing README policy.

The record must state:

- the shared product semantics being accepted
- the current consumers or explicit cross-slice rationale
- the exported surface being promoted
- rejected homes, especially the owning slice and `foundation`
- runtime, adapter, driver, and Layer limits
- contract-only proof for `shared/use-cases` exports
- review evidence for the deliberate coupling

`standards/architecture/DECISIONS.md` records architecture-wide policy changes.
It does not replace package-level promotion records.

## Shared Is Not Foundation

`shared` and `foundation` solve different problems.

```txt
shared      = deliberate cross-slice product language
foundation  = domain-agnostic reusable substrate
```

Put a concept in `shared` when slices are intentionally agreeing on semantics.
Put it in `foundation` when the package is reusable without any product-domain
coupling.

Examples:

- `packages/<kernel>/domain` may hold a value object that several slices treat as
  the same product concept.
- `packages/foundation/modeling/schema` may hold generic schema helpers that do
  not encode any product semantics.
- `packages/foundation/ui-system/ui` may hold shared UI primitives and themes.

This is why `shared` is not a synonym for `common`, `core`, or `misc`. Shared
language is expensive by design. Foundation packages are reusable substrate; the
shared kernel is deliberate coupling.

## Why Shared Kernel Matters

Every dependency on shared is easy to add and hard to remove. That makes shared
powerful and dangerous.

A shared kernel keeps the danger visible. The question is not "can this code be
used by two packages?" The question is "should these packages agree on this
language as a durable contract?"

## Example

A rich `LocalDate` value object can belong in shared if multiple slices need the
same calendar semantics. It should own driver-neutral shape and pure behavior.
It should not know about database columns, browser date pickers, or Postgres
time zones.

Those adapter concerns belong in tables, UI, client, server, or drivers.

By contrast, generic date/time parsing helpers, schema brands, and technical
formatting helpers belong in `foundation`, not `shared`, because they do not
create shared product semantics.

`@beep/<kernel>-config` follows the same rule. It may hold shared config
building blocks, browser-safe shared config contracts, server config contracts,
redacted secret helpers, and test `ConfigProvider` utilities when multiple
slices intentionally share that language. It must not become the place where all
slice config is gathered into one global object or Layer.

Domain packages may depend on shared-kernel language plus allowed
`foundation/primitive` and `foundation/modeling` packages, but not shared config
contracts or helpers. `@beep/<kernel>-config` is for config, use-case, adapter,
runtime, and test composition code; it is not an escape hatch for domain code
to read configuration.

Generic config helper libraries that do not encode shared product language
belong in `foundation/capability`, not `@beep/<kernel>-config`.

Client packages may import `@beep/<kernel>-config/public` only. Shared server
config, secret helpers that expose secret contracts, live server Layers, and
test `ConfigProvider` utilities stay behind `/server`, `/secrets`, `/layer`, and
`/test`.

## Appendix: Promotion record schema

A promotion record is a fillable section in the affected `shared/*` package's `README.md`. One section per promoted export. The schema:

### Promotion record: <export name>

- **Date promoted:** YYYY-MM-DD
- **Shared product semantics:** <one sentence on the cross-slice meaning this encodes — what concept does this export name>
- **Current consumers:** <list ≥2 packages currently importing this export by name; one consumer is not yet promotable>
- **Rejected homes:**
  - Owning slice — <why it can't live in the slice that introduced it>
  - Foundation — <why it isn't a domain-agnostic primitive>
- **Surface:** <list of exported symbols and the canonical subpath(s) they're published from>
- **Runtime limits:** <one of: "no live Layers", "contract-only" (required for `shared/use-cases`), "live Layers permitted under §X">
- **Coupling acceptors:** <PR review sign-off from each consuming slice's owner; PR link>
- **Removal trigger:** <the condition under which this export should be retired — e.g., "remove when iam owns its own membership ID format">

A package may carry multiple promotion records (one per promoted export). Records are part of the durable history of the export and are not deleted when the export is retired — instead, the record receives a `**Retired:** YYYY-MM-DD — <reason>` field.

Records are checked at PR review (see lint spec `lint:promotion-records` referenced in `07-non-slice-families.md`).
