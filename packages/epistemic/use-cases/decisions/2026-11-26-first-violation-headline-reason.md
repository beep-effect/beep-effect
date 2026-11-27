---
title: A rejected claim's disposition reason is the first violation message
date: 2026-11-26
reversal: Make rejectionReason join every violation message into one summary string.
governs:
  - src/ClaimDisposition/ClaimDisposition.service.ts#rejectionReason
enforcedBy: []
---

A rejected disposition's `reason` is a headline: the first gate violation that carries a message, or a fixed sentence when none does. The same row stores every violation verbatim, so the headline loses nothing a reader cannot recover.

Rejected: a summary that joins every violation message. It grows without bound with the violation count and is still a lossy rendering of the stored array beside it.
