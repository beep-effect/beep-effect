---
title: Corpus extract writes each artifact under staging and renames it into place
date: 2026-11-26
reversal: Write each extract artifact directly at its output path and stop resetting staging on start.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#makeExtractArtifactWriter
  - src/commands/Corpus/internal/ServicePrograms.ts#prepareExtractOutputDir
enforcedBy: []
---

Every extract artifact is written and synced under the run's staging directory, then renamed into
place, so a killed process leaves either the whole artifact or none. Staging therefore holds only a
killed run's half-written artifacts, and it is emptied on every start.

Rejected: writing artifacts at their output path (a killed run leaves a truncated artifact that a
resumed run could take for a finished one).
