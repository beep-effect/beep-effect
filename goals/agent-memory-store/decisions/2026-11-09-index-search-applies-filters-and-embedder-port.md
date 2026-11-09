---
title: "Index search applies the authoritative filters; Embedder is a port with an unavailable default"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Collapse the Embedder port into the vector index Layer by decision file if no second embedding backend appears"
---

Amends retrieval-order-convex-fusion and extends reranker-port-pass-through. The pipeline starts with authoritative filters, but MemoryIndexes.searchText and searchVector took only a query and a limit, so a filter could run only after each index had cut its top hits, and matching nodes ranked below unrelated ones were lost. Both now take an IndexSearch (text, filters, limit) and the index applies the filters before the limit. They return IndexHit with the index's own score; Candidate stays the fused shape recall builds. Embeddings are an optional local model like the cross-encoder (SPEC Non-Goals), so Embedder is a Context.Service port whose default Layer returns none; the vector index embeds node texts and the query through that one port, stays empty without a model, and recall then fuses the text index alone. Code: packages/tooling/library/agent-memory-store/src/Embedder.service.ts. Rejected: recall embedding the query and passing a vector (index and query could come from different models) and a mandatory embedding dependency (a model download in install and hosted CI).
