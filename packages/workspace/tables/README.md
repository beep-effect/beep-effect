# @beep/workspace-tables

Workspace persistence boundary for metadata-only table projections.

This package owns workspace slice table metadata projected from workspace domain
entity schemas. It closes the former `schema-to-drizzle-projection`
initiative's product-slice proof for `CandidateDraft` and `CandidateProject`.

## Belongs Here

- Workspace slice table metadata projected from workspace domain entity schemas.
- Read-model and table shapes when they are workspace product language.
- Metadata-only Drizzle table definitions created with
  `toPgTable(entity)` from `@beep/effect-drizzle/pg`.

## Does Not Belong Here

- Live database access, repositories, server Layers, or transactions.
- Migrations, seeders, or runtime database setup.
- Cross-slice shared-kernel tables.
- Generic Drizzle, SQL, or database helper libraries.

## Exports

| Export | Role |
| --- | --- |
| `@beep/workspace-tables` | Entry point exposing `Entities` and `DbSchema`. |
| `@beep/workspace-tables/entities` | Candidate entity table namespaces. |
| `@beep/workspace-tables/entities/CandidateDraft` | `CandidateDraft.Table` metadata. |
| `@beep/workspace-tables/entities/CandidateProject` | `CandidateProject.Table` metadata. |

## Development

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

Tests import package source through
`@beep/workspace-tables` or other `@beep/*` aliases. Use relative imports only
for local helpers, fixtures, and snapshots.

## License

MIT
