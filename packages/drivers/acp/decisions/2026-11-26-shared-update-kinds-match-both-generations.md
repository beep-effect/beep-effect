---
title: A session update kind both generations define is matched against both generations' members
date: 2026-11-26
reversal: Keep only the generation-2 member for shared kinds in isPassThroughUpdate and Compat.SessionUpdate.
governs:
  - src/internal/normalize.ts#isPassThroughUpdate
  - src/AcpCompat.models.ts#V1UsageUpdate
enforcedBy: []
---

Generation 2 tightens some shared fields (`Cost.currency` must match `^[A-Z]{3}$`, `Annotations.priority`), while generation 1 accepts any currency.
Reason: a valid generation-1 update can fail the generation-2 member, so the generation-1 member stays beside it.
Rejected: one generation-2 member per shared kind.
