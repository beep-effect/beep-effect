# @beep/workspace-tables Agent Guide

Workspace persistence boundary: metadata-only table projections from
`@beep/workspace-domain` entity schemas. This package closes the former
`schema-to-drizzle-projection` product-slice proof for `CandidateDraft` and
`CandidateProject`.

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Entities`, `DbSchema` | package entry point |
| `src/entities/CandidateDraft/` | `Table` | CandidateDraft table metadata |
| `src/entities/CandidateProject/` | `Table` | CandidateProject table metadata |

Tables-role contract: `packages/shared/AGENTS.md`.
