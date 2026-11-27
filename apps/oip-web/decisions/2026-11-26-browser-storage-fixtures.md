---
title: Use a complete working Web Storage in both test runtimes
date: 2026-11-26
reversal: Trust whichever localStorage getter the runtime installs without checking it.
governs:
  - test/setup.dom.ts#localStorageIsUsable
enforcedBy: []
---

Install only missing browser polyfills: matchMedia for carousel/reduced motion, idle callbacks for deferred hero fetching, and a working Web Storage for the Atom runtime and theme script.
Reason: Node coverage exposes a native localStorage getter that yields undefined without --localstorage-file, shadowing jsdom, while Bun has a working native store.
Rejected: trust getter presence. Probe clear because a complete Web Storage exposes its API together; install an in-memory store when that probe fails.
