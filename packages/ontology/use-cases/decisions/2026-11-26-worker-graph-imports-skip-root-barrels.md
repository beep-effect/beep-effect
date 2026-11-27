---
title: Modules in the visualizer worker import graph use subpath imports, never root package barrels
date: 2026-11-26
reversal: Import LiteralKit from the `@beep/schema` root barrel in the worker-graph modules.
governs:
  - src/aggregates/Session/Session.worker-protocol.ts#WorkerCommandKind
  - src/aggregates/Session/Session.worker-protocol.ts#WorkerResultKind
  - src/aggregates/Session/Session.reasoner.ts#OntologyInferenceModule
enforcedBy: []
---

`Session.worker-protocol.ts` and `Session.reasoner.ts` sit in the import graph of the browser visualizer worker, so they import `@beep/schema/LiteralKit` and other leaves directly.
The `@beep/schema` root barrel pulls `Markdown.ts` and micromark. Its `decode-named-character-reference` dependency ships a `browser` build that calls `document.createElement` at module top level, Vite resolves module workers with browser conditions, and Vite dev runs every module unbundled, so the barrel throws a ReferenceError in the worker.
`test/BrowserWorkerImportGraph.test.ts` bundles the worker entry under browser conditions without tree-shaking and fails when the markdown stack enters the graph.
Rejected: the root barrel import used elsewhere in the repo.
