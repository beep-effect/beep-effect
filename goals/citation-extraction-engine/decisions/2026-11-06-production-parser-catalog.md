---
title: "Production parser catalog loading"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the runtime catalog projection/loader and restore the fixture-based tokenizer installer; retain all sealed oracle evidence."
---

The complete default catalog and frozen publications now have a reproducible production-only asset and bounded Effect FileSystem loader. All 6805 extractor occurrences/descriptors, 2533 editions and 2430 reporter payloads match independent sealed fixture installation. The source hash profile remains explicitly captured seed 0. Connected Bun/Node replay now uses the production loader and frozen owner; ten tests across three files pass in 25.75 seconds. Changed/truncated/appended/missing assets refuse. Helper metadata, full engine artifact, public service/Layer and exhaustive qualification remain open. See history/evidence/2026-11-06-parser-catalog.md.
