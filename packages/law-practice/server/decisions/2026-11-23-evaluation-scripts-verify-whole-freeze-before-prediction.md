---
title: Evaluation scripts verify the whole freeze before any prediction
date: 2026-11-23
reversal: Hash only the next family's files, then predict.
governs:
  - test/evaluation/allowed.main.ts#program
  - test/evaluation/inspection.main.ts#program
  - test/evaluation/positive.main.ts#program
enforcedBy: []
---

Each evaluation script hashes every frozen source and implementation file before it emits any prediction.

Reason: a hash checked only for the next family would let a later frozen file change after predictions had already been written.

Rejected: verifying only the next family's files.
