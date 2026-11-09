---
title: "Split integration replay files into row-range chunks"
date: 2026-11-09
lane: "claude/integration-hosted-partitions-ba7e3b"
reversal: "Merge the range files back into one CitationCanonicalExtraction.test.ts and drop the range exports from the fixture; the guard test then asserts a single range."
---

Integration replay files may be split into row-range chunks computed from the fixture row list; a guard test asserts the union equals the full set.

The canonical corpus replay (test/integration/CitationCanonicalExtraction.test.ts, 1096.8 s of file time on the 8-vCPU heavy runner) is the first split: the 22-shard table is chunked into three contiguous ranges (8/7/7 shards), one file each (CitationCanonicalExtraction.test.ts, CitationCanonicalExtractionRange2.test.ts, CitationCanonicalExtractionRange3.test.ts), every row still replaying with full=true. test/CitationCanonicalExtractionRanges.test.ts asserts the ranges are disjoint, that their concatenation is the whole shard table, and that exactly one integration file replays each range. CitationCanonicalParserOperations and CitationCanonicalRemainingExtraction receive the same treatment once the deletion lane (bun-only full replays) has merged, so that no integration file exceeds about 400 s. No single-runner arrangement gets Heavy / Test Integration under ten minutes while one file alone takes 1097 s; the split is what lets hosted partitions be sized under the budget.
