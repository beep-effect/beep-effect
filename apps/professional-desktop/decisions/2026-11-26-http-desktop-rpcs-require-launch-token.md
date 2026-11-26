---
title: HTTP serves the full desktop RPC group only with a launch token
date: 2026-11-26
reversal: Serve DesktopRpcs over loopback HTTP unconditionally.
governs:
  - server/main.ts#DesktopRpcServer
  - server/main.ts#ChatOnlyRpcServer
  - server/main.ts#httpMain
enforcedBy: []
---

The full desktop group holds write-capable workspace vault, document intake, vault sync, ontology workbench and contradiction-triage RPCs. Loopback HTTP serves it only when the per-launch bearer token is configured; without one, dev HTTP falls back to the chat-only group, and the auth, MCP and vault-sync routes are not mounted.

IPC keeps the full group: it is reachable only through the Tauri shell bridge, where `sidecar_send` requires the same per-launch token.

Rejected: serving the full group over HTTP without a token, which exposes non-chat writes to any local process that can reach the port.
