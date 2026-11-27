---
title: The docket ledger carries an unsettled message's completed review rounds and holds the cursor behind it
date: 2026-11-26
reversal: Save only the settled outcome in makeService's pollOnce, drop persistRounds, and treat a record with review rounds as settled in isSettled.
governs:
  - src/DocketIntake/DocketIntake.service.ts#persistRounds
  - src/DocketIntake/DocketIntake.service.ts#isSettled
  - src/DocketIntake/DocketIntake.service.ts#makeService
enforcedBy: []
---

Each completed round is written to the message's ledger record before the next one starts, so a restart continues from the next round. Until the message settles the record is a placeholder that reads as still failing: a record with review rounds in it belongs to an unfinished review, which keeps the cursor behind it.
After processing, a message that failed keeps its rounds for the next attempt and a settled one drops them. A record is dropped once its message can no longer be listed again (it is behind the cursor's overlap horizon) and its day is digested.
Reason: a restart resumes the review instead of asking the agents again for rounds already completed and checked.
Rejected: saving only settled outcomes, and letting the cursor pass a message whose review has not settled.
