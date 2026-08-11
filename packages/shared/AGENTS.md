# Shared Kernel Agent Guide

## Scope

This guide applies to `packages/shared/**`. More specific package guides under
the leaf package directories add role-level details.

## Mission

Keep the shared kernel small, deliberate, and aligned with the architecture
standard. Shared code is cross-slice product language, not a convenience bucket.

## Start Here

- Read `standards/ARCHITECTURE.md` and the relevant file under
  `standards/architecture/` before changing package boundaries.
- Treat `standards/architecture/02-shared-kernel.md` as the primary rulebook for
  this directory.
- Check the current leaf package source before assuming a package already owns a
  runtime surface. `domain/` and `tables/` are active. `config/`, `use-cases/`,
  `client/`, `server/`, and `ui/` are reserved roles, not package directories
  today.

## Package Roles

| Package | Status | Add only when the content is |
| --- | --- | --- |
| `@beep/shared-domain` | Active | Driver-neutral shared product concepts, values, schemas, domain events, and pure behavior. |
| `@beep/shared-tables` | Active | Shared persistence/read-model metadata tied to shared product language. |

Reserved future packages: `@beep/shared-config`, `@beep/shared-use-cases`,
`@beep/shared-client`, `@beep/shared-server`, and `@beep/shared-ui`. Do not
create them for symmetry. `@beep/shared-use-cases` does not exist yet because no
cross-slice contract has met the promotion bar.

## Rules

- Prefer keeping code in a concrete slice until multiple slices deliberately
  agree on the same product semantics.
- Prefer foundation packages for reusable domain-agnostic substrate.
- Do not import product slices, drivers, tooling packages, or agent bundles from
  `shared/*`.
- Do not add global registries, God Layers, catch-all config objects, or
  app-wide aggregation here.
- Keep any future `shared/use-cases` package contract-only: no workflows,
  schedulers, handlers, concrete adapters, transports, persistence, driver
  imports, or live Layers.
- Keep the `shared-tables` Drizzle allowance narrow: metadata-only `pgTable`
  definitions and indexes may be derived from shared-domain descriptors, but
  connections, query execution, migrations, repositories, and live DB access are
  banned.
- Keep config browser safety explicit: client code may consume only `/public`
  config surfaces when those surfaces exist.
- Keep new domain payloads, wire payloads, persisted shapes, and config payloads
  schema-first when Effect Schema can represent them.
- Add tests and JSDoc/docgen metadata when new exported behavior appears.

## Tables role contract

Applies to every `*-tables` package (`@beep/shared-tables`,
`@beep/epistemic-tables`, `@beep/workspace-tables`, …):

- Keep table meaning tied to the owning domain's product language.
- Generic projection's target owner is `@beep/effect-drizzle` (ecosystem
  family; the package lands in `goals/effect-drizzle-graduation` P1). Until
  that move ships, `@beep/drizzle` remains the current in-tree projection
  owner — and it keeps execution permanently. A tables package only publishes
  concrete tables for its domain.
- The only Drizzle allowance is metadata-only `pgTable` definition and index
  construction from domain descriptors — no connections, query execution,
  repositories, migrations, seeders, or live DB access.

## Verification

Use package-local checks for the leaf package you touched:

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

For repo-root targeted checks, use Turbo filters:

```bash
bunx turbo run check --filter=@beep/shared-domain
bunx turbo run test --filter=@beep/shared-domain
bunx turbo run docgen --filter=@beep/shared-domain
bunx turbo run lint --filter=@beep/shared-domain
```

Replace `@beep/shared-domain` with the touched shared package.
