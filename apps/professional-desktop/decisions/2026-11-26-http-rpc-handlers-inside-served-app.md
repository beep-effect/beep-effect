---
title: HTTP rpc handlers are built inside the served app
date: 2026-11-26
reversal: Build the rpc handlers as a sibling layer outside HttpRouter.serve.
governs:
  - server/main.ts#httpMain
enforcedBy: []
---

`HttpRouter.serve` builds its app in a forked layer memo map and serves only the router built there, so `httpMain` passes `RpcServerLive.pipe(Layer.provideMerge(App))` into `serve`. One HttpRouter then carries the rpc protocol, the CORS middleware, the MCP routes and the vault-sync route.

Memoization depends on reusing the module-level layer values: `RuntimeLive`, `PgliteDrizzleLive`, `VaultSyncDesktopHostLive` and the vault store are the same objects across branches, so the graph builds one PGlite and one hosted Model shared by the rpc handlers, the governed MCP gate's execution ledger and the vault-sync host.

Rejected: `RpcServerLive.pipe(Layer.provideMerge(App))` outside `serve`, which builds a second, unserved protocol and a second PGlite runtime and registers the handlers on it.

Rejected: fresh per-branch copies of the runtime layers, which would open separate PGlite instances over one data directory.
