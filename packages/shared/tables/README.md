# @beep/shared-tables

Shared-kernel persistence boundary for cross-slice table and read-model shapes
tied to shared product language.

This package is the narrow shared-kernel Drizzle exception: compatibility
`EntityTable` helpers may live here. Live database access remains banned.

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
| `@beep/shared-tables` | Entry point exposing the compatibility `Table` namespace. |
| `@beep/shared-tables/table/Table` | Compatibility subpath re-exporting `@beep/drizzle` `EntityTable` type helpers. |

Generic schema-derived projection now lives in-tree at
`@beep/effect-drizzle` (member root
`packages/ecosystem/effect-drizzle/**`). It graduated from `scratchpad/bsl`
(PR #651). `@beep/drizzle` keeps execution (the SQL service, transactions, and
error normalization) permanently. Shared and slice tables keep their existing
`@beep/drizzle` `EntityTable` projection patterns until the future beep-adoption
packet; BaseEntity parity is explicitly outside this graduation packet. Shared
table packages publish concrete shared product table metadata; they do not own
a separate SQL DSL or a domain-to-persistence mapping layer.

## Development

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

## License

MIT
