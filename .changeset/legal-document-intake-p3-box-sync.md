---
"@beep/documents-domain": patch
"@beep/documents-use-cases": patch
"@beep/documents-server": patch
"@beep/documents-tables": patch
"@beep/db-admin": patch
---

P3 Box sync for the legal-document-intake program: schema-first sync entities
(SyncItem/SyncOperation/SyncCursor/SyncConflict) with table projections and the
`documents_sync_state` migration; provider-neutral DmsMirror and
VaultSyncEngine use-cases ports plus VaultSyncRpcs; an outbox-driven one-way
push engine with squash/retry/leased- and terminal-failure recovery, echo-safe
drift classification, symlink-safe scanning, and restart-safe durable cursors;
a Box adapter over `@beep/box` with a root-resolving availability probe; and
deterministic fixture layers throughout. Live-Box lanes stay env-gated on
`CLOUD_BOX_TOKEN`.
