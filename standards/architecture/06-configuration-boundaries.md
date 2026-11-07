# Configuration Boundaries

`config` is an optional canonical-shape slice package kind.

The name is deliberate. `config` names the typed runtime contract the slice
understands. `env` names only one possible source for those values. Effect
`Config` can be backed by environment variables, static test fixtures, files,
secret stores, platform config, or application entrypoint composition.

## What Config Owns

Slice config packages own:

- Effect `Config` declarations and key namespaces
- typed config models, schemas, and services
- public/browser-safe config contracts
- server-only config contracts
- redacted secret config
- defaults and literal domains tied directly to config declarations
- server/runtime-only config resolution helpers, including live Layers that
  read from the ambient `ConfigProvider`
- static/test Layers and fixtures tied to config declarations

The public package convention is:

```txt
@beep/<slice>-config
@beep/<kernel>-config
```

`packages/<slice>/config` is canonical but not mandatory. Create it when the
slice has meaningful runtime or application configuration contracts. Do not
create empty config packages for symmetry.

## Env Is A Source, Not A Package Kind

Environment variables remain a useful source. They should be modeled through
Effect `Config` and `ConfigProvider`, not by direct `process.env` access inside
slice code.

Existing `env` package naming is legacy vocabulary. Rename package names such
as `@beep/<kernel>-env` to `@beep/<kernel>-config`. The canonical directory is
`packages/<kernel>/config`; a package already at that path needs no directory
move for the naming migration.

Do not introduce new `env` packages or direct environment reads in
architecture-sensitive slice work. Existing env-shaped code is transitional
compatibility; when a config boundary is touched, clean that boundary toward
typed config contracts, explicit subpaths, and server/runtime-only `/layer`
resolution.

## Public, Server, And Secret Boundaries

Config packages must make browser safety visible in exports and topology:

```txt
config/src/
  Config.ts
  PublicConfig.ts
  ServerConfig.ts
  Secrets.ts
  Layer.ts
  TestLayer.ts
```

Config packages publish an explicit export contract:

```txt
@beep/<slice>-config/public
@beep/<slice>-config/server
@beep/<slice>-config/secrets
@beep/<slice>-config/layer
@beep/<slice>-config/test
```

`@beep/<kernel>-config` uses the same subpath contract.

- Browser/client code imports only `/public`.
- `/server`, `/secrets`, and `/test` are server/test-only.
- `/layer` remains canonical, but it is server/runtime-only config resolution
  surface rather than a client-safe API.

Canonical subpath names are required names when that role exists, not a requirement
to publish placeholder exports. Package-root and `./*` exports may remain during
migration, but they are compatibility leftovers rather than the canonical
boundary contract.

Secrets must use redacted values. Secret config belongs in explicit secret or
server-only modules, never in package roots that browser code can casually
import.

## Constants Are Not A Loophole

Config packages are not broad settings packages.

Allowed constants are config vocabulary: key names, namespaces, defaults,
literal domains, and fixtures tied directly to config declarations.

Keep other constants near the concept that gives them meaning:

- business invariants belong in `domain`
- application behavior belongs in `use-cases`
- driver defaults belong in `drivers/*`
- presentation constants belong in `client` or `ui`

## Dependency Direction

Config may depend inward on `domain` and `shared` for driver-neutral schemas,
brands, value objects, and validation. Foundation packages may provide generic
schema, identity, or capability helpers beside that shared language. That
dependency is one-way. Domain may import shared-kernel language plus allowed
`foundation/primitive` and `foundation/modeling` packages, but it must never
import slice config, `@beep/<kernel>-config`, `Config`, `ConfigProvider`, secret
helpers, or test config utilities.

Use-cases may import config contracts or services for application tunables.
Server and client packages compose the live config Layers that resolve those
contracts from a `ConfigProvider`. Top-level application entrypoints may then
assemble those package-local Layers. Use-cases own contracts and facades, not
live Layers.

Config must not import drivers. Drivers keep technical driver config in driver
`.config.ts` files. Slice config can expose application-facing settings that
influence driver wiring, but it should not own Drizzle, Postgres, EventLog,
queue, or workflow-engine internals.

For a worked example showing how a feature flag splits across the boundary
(driver owns the values, slice owns the flag selecting them), see
[`03-driver-boundaries.md`](./03-driver-boundaries.md#worked-example-a-tunable-that-spans-both).

## Shared Config

`@beep/<kernel>-config` is part of the shared kernel. It may hold cross-slice
config primitives, shared config contracts, redacted-secret helpers, and test
`ConfigProvider` utilities that multiple slices deliberately agree on.

It must not become a global config registry or a Layer that aggregates every
slice's private config into one app-wide object.
