---
title: "Split the canonical replay per runtime and widen the Test Integration lane to 90 minutes"
date: 2026-11-08
lane: "@slop/11-6-26"
pullRequest: 2915
reversal: "Merge the node shards back into CitationCanonicalExtraction.test.ts and restore timeout_minutes: 40 in heavy.yml once the per-extraction cost or the lane sharding makes the suite fit."
---

Since #2847 registered all 193 canonical inputs per runtime, Heavy / Test Integration on main hit its 40-minute lane timeout on every run (42417048100, 42422844786, 42426906781): the single integration file ran 44 shards behind the package's maxConcurrency 2 while the other worker drained the remaining 46 files, so the bun half alone took 38 minutes. The replay now lives in one file per runtime (bun in CitationCanonicalExtraction.test.ts, node in CitationCanonicalExtractionNode.test.ts) sharing one shard table, so both workers replay in parallel, and the lane budget is 90 minutes so the whole suite fits with headroom. The remaining lever is per-extraction cost (about 5 s per document plus 25 s of engine installation per shard) or sharding the integration lane like Test Unit; that stays with this packet.
