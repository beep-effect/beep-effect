---
title: "Per-route launch-token session adapters lift the identity hold"
date: 2026-11-07
lane: "goals/vault-sync-api"
reversal: "Add a bearer adapter behind SessionResolver; no caller changes"
---

Supersedes the 2026-11-07 identity hold. Each sidecar route builds its own SessionResolver: launch-token adapters for HTTP (http), the gated RPC endpoint (cli) and MCP (mcp), a channel adapter for the desktop RPC surface (sidecar; HTTP passes the global token middleware and IPC the Tauri token check before handlers run), and the local-operator adapter for in-process CLI. The route fixes the transport kind; headers can only prove the token and supply a correlation id. All adapters bind the desktop principal and read active, undeleted shared_membership rows live on every call and frame; the owner role carries the diagnostics grant OperationQueue needs. No test stub sits in a production Layer.
