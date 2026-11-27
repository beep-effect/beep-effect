---
title: Docket intake turns every doubt into a flag or a needs-review entry, never a dropped message
date: 2026-11-26
reversal: Skip Junk Email and Deleted Items mail in folderFlags' callers, fail the message when lookupMatter fails, and let writeFlagged, escalateDisagreement and settleExhausted settle the message without an entry.
governs:
  - src/DocketIntake/DocketIntake.service.ts#folderFlags
  - src/DocketIntake/DocketIntake.service.ts#lookupMatter
  - src/DocketIntake/DocketIntake.service.ts#escalateDisagreement
  - src/DocketIntake/DocketIntake.service.ts#writeFlagged
  - src/DocketIntake/DocketIntake.service.ts#settleExhausted
enforcedBy: []
---

Mail found in Junk Email or Deleted Items is docketed like any other, and every entry written for it says where it was found. A failed matter lookup becomes the `matter-lookup-failed` flag instead of costing the entry.
When the review accepts a round although the agents still disagree on whether the message is a docket item at all, the attorney decides through an `agents-disagree` needs-review entry. An item the review does not accept is shown, never entered as an accepted deadline: one needs-review entry on the earliest date either agent read, with no reminder ladder.
After the retry budget a message that still cannot be processed gets a needs-review entry; a failing calendar cannot take that entry either, so a `calendar` failure keeps retrying.
Reason: missing a deadline is worse than a spurious entry the attorney deletes.
Rejected: skipping Junk and Deleted mail, failing the message on a lookup failure, settling a disputed or exhausted message without an entry, and entering a flagged item as accepted.
