---
title: The graph worker is constructed with the literal global Worker and URL expression
date: 2026-11-26
reversal: Construct the worker through the captured WorkerCtor alias or a precomputed URL.
governs:
  - src/aggregates/Session/Session.atoms.ts#ontologyGraphWorkerBridgeAtom
enforcedBy: []
---

`makeWorker` calls `new Worker(new URL("./Session.visualizer.worker.ts", import.meta.url), { type: "module" })` on the global constructor, although the bridge has already captured `globalThis.Worker` as `WorkerCtor`.
Vite recognizes only this exact shape as a module-worker entry. Constructing through the alias makes Vite emit the TypeScript source as a `data:` asset, which the packaged app's restrictive CSP rejects, so the graph never loads.
Rejected: constructing through `WorkerCtor`, which reads more uniformly and passes every unit test.
