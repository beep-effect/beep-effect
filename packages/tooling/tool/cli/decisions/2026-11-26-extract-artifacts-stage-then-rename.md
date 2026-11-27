---
title: Corpus extract writes its file artifacts under staging and renames them into place
date: 2026-11-26
reversal: Write each writer artifact at its output path and stop resetting staging on start.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#makeExtractArtifactWriter
  - src/commands/Corpus/internal/ServicePrograms.ts#prepareExtractOutputDir
enforcedBy: []
---

Every artifact written through `makeExtractArtifactWriter`, such as text, metadata, OCR page rows
and outcome markers, is synced under the run's staging directory and then renamed into place, so a
killed process leaves either the whole artifact or none. libpff child export trees land in
`children/` through pffexport and are not staged. Staging therefore holds only a killed run's
half-written artifacts, and it is emptied on every start.

Rejected: writing artifacts at their output path (a killed run leaves a truncated artifact that a
resumed run could take for a finished one).
