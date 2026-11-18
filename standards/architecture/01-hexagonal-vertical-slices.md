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

The slice is vertical, and it is a bounded context: one language, its data
and its invariants, with one `Domain.Model` by default. It ships as four
packages, one per dependency closure:

```txt
packages/party/
  contract/   what clients and other contexts import
  model/      aggregates, reactions, ports and their handlers
  host/       adapters, stores, cluster classes, the inbox
  web/        React screens over generated bindings
```

`web/` exists when the context has screens. The boundaries are hexagonal:

```txt
contract <- model <- host
contract <- web
model <- web              (a listed Aggregate.predict screen only)
other contexts' contracts <- host

model ports <- host adapters <- drivers
```

Arrows point from outer importer toward inner imported package. The contract
resolves no model, host, handler or driver. The model resolves its own
contract, `@alchemy.run/domain`, Effect, the shared kernel and
`foundation/primitive` and `foundation/modeling`, and declares everything else
it needs as a port. Only the host knows how the context runs.

The result is local ownership without infrastructure leakage, and a
dependency closure per runtime: a browser loads the contract and the web
package, never the write model, unless a screen imports the model on purpose
to run `Aggregate.predict`.

A context never imports another context's model, host, aggregate, private
event, view, store or handler. It reaches another context only through the
provider's contract: a port it declares over the provider's gateway contract,
or an integration fact it reads from the provider's published stream into its
inbox (see `10-cross-slice-coordination.md`).

The rules are in `standards/ARCHITECTURE.md`, "Model-First Slice Topology".
Decision numbers cite `explorations/model-first-slices/DECISIONS.md`: the
context as the unit (D2), the four packages (D3), the contract over a catalog
(D9 as amended), the file grammar (D10) and facts between contexts (D11, D33).

### Legacy seven-package slices

Slices built before the model-first shape use seven packages and stay legal
until their own migration. No new slice, and no new migration to
`@alchemy.run/domain`, starts on this shape (D17).

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

```txt
domain <- config <- use-cases <- server
domain <- client <- ui
use-cases <- client (client-safe exports only)
config <- client (public exports only)

use-cases product ports <- server implementations <- drivers
```

`config` may reuse domain vocabulary, but domain imports only shared-kernel
language plus allowed `foundation/primitive` and `foundation/modeling` packages.

Client imports from use-cases must stay client-safe: command/query language,
contracts, and actionable errors are fine; product ports and server-only Layer
composition are not. Client imports from config must stay public/browser-safe;
server-only config, secrets, and live server config Layers stay out of the
browser.

Slice-to-slice direct imports across `domain`, `use-cases`, `server`, `tables`,
`client`, or `ui` packages of *different* slices are forbidden. Cross-slice
integration goes through emitted events or, after a real promotion, the existing
`shared/use-cases` contract package.

## Same Module, Different Closure

In a model-first slice the same Module appears in the contract and the model:

```txt
contract/src/Claim/AcceptClaim.command.ts   what a client sends, its events and rejections
contract/src/Claim/ClaimReview.read.ts      what a client reads
model/src/Claim/Claim.aggregate.ts          the aggregate that decides it
model/src/Claim/ClaimReview.view.ts         the read model
model/src/Claim/ClaimReview.handler.ts      its implementation
```

The `Claim` folder is the Module: one consistency boundary, process or read
model. The package is the dependency closure, and the suffix is the kind. A
person or an agent changing how claims are accepted needs `Claim/` in the
contract and `Claim/` in the model, and nothing else.

A legacy slice repeats a concept folder across its seven packages instead:

```txt
domain/src/entities/Membership/Membership.policy.ts
use-cases/src/entities/Membership/Membership.commands.ts
config/src/entities/Membership/Membership.config.ts
server/src/entities/Membership/Membership.http-handlers.ts
client/src/entities/Membership/Membership.command-client.ts
ui/src/entities/Membership/Membership.form.tsx
```

There the `Membership` folder is the concept, and the package and role suffix
are the architectural lens.

## Cross-Concept Escape Hatches

Most roles are Module-local (concept-local in a legacy slice) by default.
Cross-concept behavior is allowed for:

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

In a model-first slice a process or read model that spans aggregates is a
Module of its own (a `Review/` Module holding the policy that opens a review
and the saga that runs it), and package-level composers (`<Context>.model.ts`,
the generated `<Context>.handlers.ts`, `Host.ts`) sit at the package root.
