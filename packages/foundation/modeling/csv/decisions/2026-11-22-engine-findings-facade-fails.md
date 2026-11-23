---
title: The engine returns findings as values; only the Csv facade decides what fails
date: 2026-11-22
reversal: Let the engine raise CsvParseError itself, or move each option's behaviour onto its option schema.
governs:
  - src/internal/rules.ts#judgeQuote
  - src/internal/machine.ts#Machine
  - src/internal/stream.ts#textSteps
  - src/internal/stream.ts#bytesSteps
enforcedBy: []
---

Code under `src/internal/` never imports the `Csv` facade. The machine and the channel steps return fatal findings as `CsvDiagnostic` schema values; `Csv.codec.ts` turns them into the `CsvParseError` a read or channel fails with.

What each read and write option means (how serious a quoting or ragged finding is under its rule, what trimming leaves of a cell, what the formula guard writes, which cells must be quoted to read back unchanged) lives in `internal/rules.ts`, beside the engine that applies it, not on the option schemas, which stay public data.

Rejected: an engine that fails with `CsvParseError` (one error policy spread across the parser, channels and facade), and behaviour attached to the option schemas.
