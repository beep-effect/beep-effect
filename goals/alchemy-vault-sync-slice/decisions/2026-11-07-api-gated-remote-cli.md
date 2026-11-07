---
title: "Remote CLI uses a gated RPC endpoint, never the raw Api fetch"
date: 2026-11-07
lane: "goals/vault-sync-api"
reversal: "Unmount VaultSyncRpcHttp; the CLI stays in-process only"
---

The generated CLI speaks the Api RPC protocol. The sidecar serves that protocol at /vault-sync/rpc with handlers that forward every RPC to the protected delivery client with the caller's headers, so Session runs and watch/events pass the per-frame gate. The unwrapped Api fetch, whose streams bypass that gate, is not mounted. The remote CLI reads the launch token per call from BEEP_DESKTOP_RPC_SESSION_TOKEN, redacted. An IPC-mode sidecar serves no HTTP, so the remote CLI then cannot connect.
