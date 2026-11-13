---
title: "The stale mark is the category 'Draft - recheck before sending', coloured by hand once"
date: 2026-11-13
lane: "feat/outbox-draft-basis-check"
reversal: "Rename the category constant and the runbook step; drafts already carrying the old name keep it until check-drafts next clears them, so rename only while no draft is marked."
---

Operator ruling, 2026-11-13 (grill session). The attorney reads this label on a draft in his Drafts folder, so it says what to do and uses no system word; the internal reason word stays basis-changed. Rejected: 'Draft - basis changed' (our term, not his) and 'Draft - source changed'. Colour: the outbox app holds Mail.ReadWrite, Mail.Send and Calendars.ReadWrite on the one mailbox and cannot create an entry in the mailbox's category list, which needs MailboxSettings.ReadWrite. The runbook therefore gains one manual step: create the category once in the attorney's Outlook, in red. The server only writes the name and Outlook matches it to the coloured entry. Rejected: an uncoloured label (easy to miss) and a fourth Exchange role for the app (it would also let the app change other mailbox settings).
