---
title: A test-only preload bridges drizzle-kit's SQLiteSyncDialect import to drizzle-orm's SQLiteDialect
date: 2026-11-26
reversal: Delete the preload and its use in sqlite-live.test.ts once drizzle-kit and drizzle-orm pin matching RC hashes.
governs:
  - test/integration/drizzle-kit-sqlite-rc-compat.cjs#load
enforcedBy: []
---

drizzle-kit rc.4-ca0f029 still imports `SQLiteSyncDialect`; drizzle-orm rc.4-fb12281 renamed that export to `SQLiteDialect`, with the same constructor surface the kit serializer uses. The preload wraps `Module._load` and aliases the old name only when the new one exists and the old one is missing.
Rejected: patching the installed packages, which would change dependencies for every consumer rather than only the live SQLite test.
Accepted limit: transitional. Remove the bridge when the two pinned RC hashes converge.
