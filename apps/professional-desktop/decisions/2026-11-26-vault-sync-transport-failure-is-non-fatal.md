---
title: A vault-sync transport failure does not stop the sidecar
date: 2026-11-26
reversal: Drop the catchCause so a vault-sync build failure fails sidecar startup.
governs:
  - server/main.ts#httpMain
enforcedBy: []
---

The `/vault-sync/rpc` route is built with `Layer.catchCause`, which logs `vault sync transport is unavailable` with the pretty cause and yields an empty layer. A refused admission leaves vault sync without a writer while chat, desktop RPCs and MCP keep serving.

Rejected: propagating the failure, which takes the whole desktop sidecar down because one optional remote-CLI surface could not take the writer.
