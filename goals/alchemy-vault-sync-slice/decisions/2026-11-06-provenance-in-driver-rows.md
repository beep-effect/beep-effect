---
title: "Provenance is persisted by the driver from SendMeta.context"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Add principal and source kind as explicit payload fields on every event and drop the driver columns"
---

The kernel envelope is exactly id, stream, seq, at, commandId, correlationId, trace. Every `AggregateStore.send` receives `meta.context`, the encoded RequestContext the Session middleware provided. The Postgres driver persists it beside the command receipt and copies principal and source kind onto each event row; audit reads come from those rows (D10). Evidence: `packages/drivers/alchemy-postgres/test/spikes/platform-send-meta.test.ts`.
