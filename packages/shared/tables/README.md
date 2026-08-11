# @beep/shared-tables

Shared-kernel persistence boundary for cross-slice table and read-model shapes
tied to shared product language.

This package owns shared-kernel table metadata and the shared entity table
proofs for `Membership`, `Organization`, and `User`. It is the narrow
shared-kernel Drizzle exception: metadata-only `pgTable` definitions and index
metadata may live here when they encode shared product language, but live
database access remains banned.

## Belongs Here

- Shared persistence/read-model shapes that multiple slices deliberately agree
  on.
- Mappings tied directly to shared domain language.
- Cross-slice table vocabulary when it is product-semantic and durable.
- Metadata-only Drizzle table definitions projected from shared entity schemas.
  Live execution belongs in driver and server packages.

## Does Not Belong Here

- Generic Drizzle, SQL, migration, or database helper libraries.
- Driver wrappers or external infrastructure capability.
- Connections, query execution, live repositories, seeders, and migrations.
- Slice-private persistence shapes.
- Domain behavior or application orchestration.

## Exports

| Export | Role |
| --- | --- |
| `@beep/shared-tables` | Entry point exposing shared concrete table namespaces. |
| `Entities.Membership` | Shared Membership table metadata projected with `EntityTable.pgTableFrom(Membership.Model)`. |
| `Entities.Organization` | Shared Organization table metadata projected with `EntityTable.pgTableFrom(Organization.Model)`. |
| `Entities.User` | Shared User table metadata projected with `EntityTable.pgTableFrom(User.Model)`. |
| `DbSchema` | Metadata-only aggregate for exported shared tables. |
| `@beep/shared-tables/table/Table` | Compatibility subpath re-exporting `@beep/drizzle` `EntityTable` type helpers. |

Generic table projection's target owner is `@beep/effect-drizzle` (member
root `packages/ecosystem/effect-drizzle/**`, landing via
`goals/effect-drizzle-graduation` P1; graduated from `scratchpad/bsl`). Until
that move ships, `@beep/drizzle` remains the current in-tree projection
owner — and execution (the SQL service, transactions, error normalization)
stays in `@beep/drizzle` permanently. Shared table
packages publish concrete shared product table metadata; they do not own a
separate SQL DSL or a domain-to-persistence mapping layer.

## Development

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

## License

MIT
