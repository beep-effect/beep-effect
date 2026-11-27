---
title: The docket critic reads the dates for itself and is never shown the extractor's dates
date: 2026-11-26
reversal: Put the entry's dates into criticView and ask the critic for findings in every nextRound.
governs:
  - src/DocketIntake/DocketIntake.service.ts#firstRound
  - src/DocketIntake/DocketIntake.service.ts#criticView
  - src/DocketIntake/DocketIntake.service.ts#nextRound
enforcedBy: []
---

In round 1 the critic reads the message and its documents for itself, then says what is wrong with what it is shown of the entry. That view (`criticView`) holds the entry's kind, title, rationale and matter references, never its dates.
In a later round the extractor revises or defends the disputed fields, the critic re-reads the fields it can read again, and it is asked for findings again only when its view of the entry changed: the same view would only get the same findings.
Reason: the score counts agreement between two independent readings; a critic shown the extractor's dates would anchor on them.
Rejected: showing the critic the whole entry, and asking for findings every round regardless of the view.
