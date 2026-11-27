---
title: Corpus extract resumes an existing output tree from per-source outcome markers
date: 2026-11-26
reversal: Refuse a non-empty output tree unless --overwrite is passed, and drop the outcome markers.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#extractCorpusLocked
  - src/commands/Corpus/internal/ServicePrograms.ts#isSettledExtractOutcome
  - src/commands/Corpus/internal/ServicePrograms.ts#extractRoutingBase
enforcedBy: []
---

An existing output tree is resumed, never refused; `--overwrite` is the only path that discards it.
Resume trusts one thing per source, its outcome marker, written last and settled under the rules
of `CorpusExtractOutcome`. A failure settles only while the routing fingerprint is unchanged, and
the fingerprint is derived from the engine descriptors rather than a hand-bumped version, so adding
a format to an engine unsettles it. Anything else is redone from scratch.

Rejected: refusing a populated output tree (a killed multi-hour run restarts from zero);
redoing every source on each run.
