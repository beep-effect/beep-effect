---
title: The docket sheet is a third date source that can only move an entry earlier and add a flag
date: 2026-11-26
reversal: Let placeWithSheet take the sheet's date whenever it differs, and fail the message when checkTrackedDates cannot read the sheet.
governs:
  - src/DocketIntake/DocketIntake.service.ts#TRACKED_WINDOW_DAYS
  - src/DocketIntake/DocketIntake.service.ts#earliestTracked
  - src/DocketIntake/DocketIntake.service.ts#checkTrackedDates
  - src/DocketIntake/DocketIntake.service.ts#placeWithSheet
enforcedBy: []
---

The sheet is consulted only when its port is wired and there is a docket to ask about. Its earliest due or final date on or after `TRACKED_WINDOW_DAYS` before receipt is compared; older rows belong to an earlier step of the matter.
The standing earlier-date rule applies with the sheet as a third source: the entry goes on the earlier date and a difference is flagged `tracked-date-differs`. A sheet that cannot be read is the `tracked-dates-unavailable` flag, never a failure of the message.
Reason: the pipeline puts an entry on the earlier of two differing dates, so a later sheet date never moves a deadline later, and an unreadable sheet must not cost the attorney the entry.
Rejected: replacing the reading with the sheet's date, comparing every historical row, and failing the message when the sheet is unavailable.
