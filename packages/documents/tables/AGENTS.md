# @beep/documents-tables Agent Guide

Documents persistence boundary: metadata-only table projections from
`@beep/documents-domain` sync entity schemas backing the one-way DMS mirror
(P3 Box-sync phase of `goals/legal-document-intake`).

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Entities`, `DbSchema` | package entry point |
| `src/entities/SyncItem/` | `syncItemTable`, `SYNC_ITEM_TABLE_NAME`, converters | per-item sync tracking |
| `src/entities/SyncOperation/` | `syncOperationTable`, `SYNC_OPERATION_TABLE_NAME`, converters | push outbox |
| `src/entities/SyncCursor/` | `syncCursorTable`, `SYNC_CURSOR_TABLE_NAME`, converters | remote-event cursor |
| `src/entities/SyncConflict/` | `syncConflictTable`, `SYNC_CONFLICT_TABLE_NAME`, converters | remote-drift records |

Tables-role contract: `packages/shared/AGENTS.md`.
