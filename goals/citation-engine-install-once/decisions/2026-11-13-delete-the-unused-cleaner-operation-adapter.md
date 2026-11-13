---
title: "Delete the unused cleaner operation adapter"
date: 2026-11-13
reversal: "Restore CleanerOperation.ts and its test from head 99bb436ca0fc if a real production caller is introduced."
---

A repository-wide live source and test search found makeCitationCleanerOperation only in its defining module and CitationCleanerOperation.test.ts. No src caller, public engine boundary, or package composition uses it; SourceCleaning uses CleanerPipeline directly. The similarly named replay fixture independently wraps CleanerPipeline and does not call this adapter. Delete the test-only dead production adapter and its test rather than count fixture admission as a production proof. Public engine admission is now proved by the manual-clock engine test. Regenerate the instrumentation catalog and prune the generated shard plan with repository writers.
