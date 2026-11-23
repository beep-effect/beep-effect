---
title: Journal reads sample BOM width, size and identity through one handle and page through a pinned handle
date: 2026-11-22
reversal: Probe the BOM by path and stat the path separately, and read the sampled region in one allocation as upstream does.
governs:
  - src/Journal.ts#makeEngine
enforcedBy: []
---

`sampleBomAndInfoThroughOneHandle` reads the BOM width and the metadata through one handle so the width, size and identity describe the same file. Probing the path twice can straddle a rename-over: the old file's width paired with the replacement's identity hides the replacement while every offset is three bytes off, and a healthy first record reads as malformed. `bomBytes` is always probed from a file, never inferred from a window.
Identity is `dev:ino`; size alone cannot see a same-size replace. `ino` is an `Option` in `File.Info`, so a platform without it degrades to truncation-only detection.
The layer seed samples identity before the seed read and records it before the supervisor's first catch-up, so a replacement during the read cannot inherit the old cursor or width; the first reconciliation sees a different identity and resynchronizes.
`query` reads bounded complete-record pages through a second handle whose identity must match the sample; a mismatch fails `JournalResync` with the replacement's size measured with its own BOM width. The pinned handle keeps a later rename-over out of the range and turns a truncation into a short page. The range is captured once, starting one byte before the cursor to tell a boundary from a partial line; growth after the sample does not extend it. A page widens only when no complete record fits. Frame filtering precedes payload decoding on every page, and a failed record ends the stream after the earlier selected records.
Rejected: upstream's single allocation of the whole region (spencerbeggs/effected#233), a snapshot by construction that holds the entire history in memory.
