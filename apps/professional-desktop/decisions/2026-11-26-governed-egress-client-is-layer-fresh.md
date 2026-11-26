---
title: The governed egress HttpClient is a Layer.fresh copy
date: 2026-11-26
reversal: Provide GovernedEgressLive into the shared FetchHttpClient.layer.
governs:
  - server/OntologyMcpTransport.ts#makeOntologyMcpTransportLayer
enforcedBy: []
---

The publication toolkit receives `Layer.fresh(FetchHttpClient.layer)` with `GovernedEgressLive` provided beneath it. `FetchHttpClient.layer` is a module-level object and layer builds are memoized by object identity across one graph, so a shared copy would be the same client that `AnthropicLive` and the OTLP exporter in `src/runtime/Observability.ts` resolve. Whichever built first would win for all of them, and the default-deny governed fetch would fail every Anthropic and OTLP request with `EgressDenied` and write spurious denied rows into this boundary's hash chain.

Nothing type-checks this: `Fetch` is a Reference, so a missing or misplaced override silently resolves to the platform fetch and the layer's output is `never`. The override goes into the graph that builds this client, the one the publication handler receives.

Rejected: providing the governed `Fetch` into the shared `FetchHttpClient.layer`.
