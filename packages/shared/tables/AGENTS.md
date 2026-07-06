# @beep/shared-tables Agent Guide

Shared-kernel persistence boundary proving shared `Membership`,
`Organization`, and `User` table metadata. Tables-role contract:
`packages/shared/AGENTS.md`.

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Entities`, `DbSchema` | one `Table` per shared entity (`src/entities/*`) |
| `src/table/Table.ts` | `EntityTable` | compatibility re-export for public `EntityTable` type helpers |

## Laws

- Keep table meaning tied to shared domain language; new exports must be
  product-semantic, not generic database helpers.
- The only Drizzle allowance is metadata-only `pgTable` definition and index
  construction from shared-domain descriptors.
