---
title: "Event schema version is a static on the event class; the driver stamps and upcasts"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Move the version into the stored row only and drop the static once alchemy ships a kernel version slot"
---

beta.85 has no version slot on the wire event or the envelope. Each event class declares `static readonly schemaVersion` (default 1); the driver reads it from the hosted aggregate's declared events, writes a `schema_version` column, and applies the class's upcaster chain to stored JSON at read before the kernel decodes. Genesis-import rows are version 1 (D12). Evidence: `packages/drivers/alchemy-postgres/test/spikes/event-annotations.test.ts`.
