---
title: "Two-runtime integration replays may be split into one file per runtime"
date: 2026-11-09
reversal: "Merge the node twin back into the bun file's runtime loop and drop the shared fixture's kind parameter; regenerate vitest.integration.shards.json."
---

An integration replay that runs the same corpus under both native runtimes may be split into one file per runtime over a shared fixture, so a hosted partition never carries both halves.

Shipped split. test/integration/CitationRegexTranslator.test.ts ran the native regex-translator qualification (full program-shard sweep plus the three-witness smoke) under bun and node in one file: 589 hosted seconds, more than a partition budget. Its body moved to test/CitationRegexTranslator.fixtures.ts as qualifyCitationRegexTranslator(kind, smoke); CitationRegexTranslator.test.ts replays bun (327 s measured) and CitationRegexTranslatorNode.test.ts replays node (290 s), each with the same 14-minute qualification timeout. The two files are independent partition inputs with identical assertions, so coverage of both runtimes is unchanged. The split applies to any two-runtime replay that exceeds the budget; a bun-only replay (the deletion lane's choice for the canonical corpora) does not need it.
