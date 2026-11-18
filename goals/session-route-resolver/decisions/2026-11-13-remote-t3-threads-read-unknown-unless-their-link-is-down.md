---
title: "Remote T3 threads read unknown unless their link is down"
date: 2026-11-13
lane: "feat/session-route-resolver"
reversal: "Have the resolver call the remote environment through the T3 server when the CLI gains an environment flag for thread show."
---

The CLI cannot call MCP tools and `t3 thread show` has no environment flag, so a thread on a linked environment reads unknown with a pointer to t3_thread_read, and unreachable only when `t3 environment list` reports its link down. unknown keeps the send call and is never treated as dead. `t3 environment list` pings every link and took about 11 seconds with five links, so it has a 30-second budget and runs only for a remote thread or a key with no local owner.
