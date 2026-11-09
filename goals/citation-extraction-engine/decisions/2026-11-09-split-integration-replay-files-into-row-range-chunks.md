---
title: "Split integration replay files into row-range chunks"
date: 2026-11-09
lane: "claude/integration-hosted-partitions-ba7e3b"
reversal: "Merge the range files back into one CitationCanonicalExtraction.test.ts and drop the range exports from the fixture; the guard test then asserts a single range."
---

Integration replay files may be split into row-range chunks computed from the fixture row list; a guard test asserts the union equals the full set.

Shipped splits. The canonical corpus replay (test/integration/CitationCanonicalExtraction.test.ts, 1096.8 s of file time on the 8-vCPU heavy runner, about 71.5 hosted seconds per shard) is chunked into six contiguous ranges of its 22-shard table (4/4/4/4/4/2 shards), one file each (CitationCanonicalExtraction.test.ts and CitationCanonicalExtractionRange2..Range6.test.ts), every row still replaying with full=true. After the deletion lane (#3009, bun-only full replays) merged, CitationCanonicalParserOperations (8 groups of 10 rows) and CitationCanonicalRemainingExtraction (7 groups) received the same treatment through range helpers exported by their fixtures: two files each, 4/4 and 4/3 groups. test/CitationCanonicalExtractionRanges.test.ts asserts, for all three corpora, that the ranges are disjoint, that their concatenation is the whole table, and that exactly one integration file replays each range. No single-runner arrangement gets Heavy / Test Integration under ten minutes while one file alone takes 1097 s; the split is what lets hosted partitions be sized under the budget (the largest single integration file is now CitationRegexCaseFlags at 407 hosted seconds).
