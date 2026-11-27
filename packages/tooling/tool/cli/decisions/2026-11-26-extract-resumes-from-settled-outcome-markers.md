---
title: Corpus extract resumes an existing output tree from per-source outcome markers
date: 2026-11-26
reversal: Refuse a non-empty output tree unless --overwrite is passed, and drop the outcome markers.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#extractCorpusImpl
  - src/commands/Corpus/internal/ServicePrograms.ts#isSettledExtractOutcome
enforcedBy: []
---

An existing output tree is resumed, never refused; `--overwrite` is the only path that discards it. Resume trusts one thing per source: its outcome marker, written last. A marker settles the source only when it decodes, names the same source and `exportChildren` choice, records a settled outcome and all its artifacts still exist. Succeeded and deferred sources are settled. A failure is settled only when the engine routing decided it (no engine supports the format), and only while the routing fingerprint, derived from the engine descriptors, is unchanged; driver failures get no marker and retry. A marker from a run without the OCR pass does not settle a run that makes it.

Crash safety follows from the same choice: staging holds a killed run's half-written artifacts and is emptied on every start, artifacts are synced there and renamed into place, and a redone source has its child entries removed first because libpff refuses an export whose tree or claim exists.

Rejected: refusing a populated output tree (a killed multi-hour run restarts from zero); redoing every source on each run.
