# Hexagonal Vertical Slices

The architecture combines two ideas that are often separated:

- vertical slices, which keep product/domain work together
- hexagonal architecture, which keeps external systems behind ports and adapters

beep-effect needs both.

## Why Not Pure Feature Folders

Feature folders are good at locality, but they often become isolated piles of
UI, API calls, persistence, and state. Reuse becomes accidental. Two features
that share the same domain concept drift apart because there is no stable domain
package to hold the concept.

beep-effect wants experiments, but it also wants reusable domain language. The
domain spine gives feature work somewhere stable to land.

## Why Not Horizontal Layers Only

Horizontal layers make shared infrastructure obvious, but they often create
runtime packages that know too much. A central `DataAccess.layer` or
`Persistence.layer` can become the place where every slice is merged, even when
the slices are otherwise unrelated.

That shape makes local experimentation harder. Adding a slice means editing
global runtime composition. Removing a slice means unwinding global references.

## The Hybrid

The slice is vertical:

```txt
packages/iam/
  domain/
  use-cases/
  config/
  server/
  client/
  tables/
  ui/
```

`config/` is canonical vocabulary, not mandatory scaffolding. Create it when the
slice has meaningful config contracts.

The boundaries are hexagonal:

```txt
domain <- config <- use-cases <- server
domain <- client <- ui
use-cases <- client (client-safe exports only)
config <- client (public exports only)

use-cases product ports <- server implementations <- drivers
```

Arrows point from outer importer toward inner imported package. `config` may
reuse domain vocabulary, but domain imports only shared-kernel language plus
allowed `foundation/primitive` and `foundation/modeling` packages.

The result is local ownership without infrastructure leakage.

Client imports from use-cases must stay client-safe: command/query language,
contracts, and actionable errors are fine; product ports and server-only Layer
composition are not. Client imports from config must stay public/browser-safe;
server-only config, secrets, and live server config Layers stay out of the
browser.

Slice-to-slice direct imports across `domain`, `use-cases`, `server`, `tables`,
`client`, or `ui` packages of *different* slices are forbidden. Cross-slice
integration goes through emitted events or, after a real promotion, the existing
`shared/use-cases` contract package.

## Same Concept, Different Lens

The same domain concept appears across layers with a different role:

```txt
domain/src/entities/Membership/Membership.policy.ts
use-cases/src/entities/Membership/Membership.commands.ts
config/src/entities/Membership/Membership.config.ts
server/src/entities/Membership/Membership.http-handlers.ts
client/src/entities/Membership/Membership.command-client.ts
ui/src/entities/Membership/Membership.form.tsx
```

This is intentional. The `Membership` folder is the concept. The package and role
suffix are the architectural lens.

## Cross-Concept Escape Hatches

Most roles are concept-local by default. Cross-concept behavior is allowed for:

- process managers that coordinate multiple concepts
- projections built from several event streams
- slice-wide pure policies
- package-level composers
- package-level config composers

A behavior qualifies as cross-concept (and may live outside a single concept
folder) when at least one is true:

- it reads or writes >=2 aggregates from different concepts in the same slice
- it consumes events emitted by >=2 concepts in the same slice
- it composes >=2 concept-level Layers (package-level composers)
- it expresses a policy whose preconditions reference >=2 concepts
  simultaneously

A behavior touching only one concept must live in that concept's folder, even if
it feels generic.

The default remains concept-local because concept locality is what makes the
slice navigable.
