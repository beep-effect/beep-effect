---
title: Canonical whitespace is the original normalization protocol
date: 2026-11-23
reversal: Compare raw canonical text with a different whitespace fold than trim-and-collapse.
governs:
  - test/evaluation/inspection.main.ts#verifyRawSourceRecordOfExpectedClaim
  - test/evaluation/inspection-tool.main.ts#verifyRawSourceRecordOfExpectedClaim
enforcedBy: []
---

Whitespace in a raw canonical source record is compared after trim and a collapse of every whitespace run to one space, which is the original normalization protocol. The check covers every raw source record, including one whose normalization failed.

Reason: a newer fold would disagree with the frozen claim text even when the source text is unchanged.

Rejected: any other whitespace canonicalization.
