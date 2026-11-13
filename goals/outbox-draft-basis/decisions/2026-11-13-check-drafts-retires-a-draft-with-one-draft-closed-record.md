---
title: "check-drafts retires a sent or missing draft with one draft-closed record"
date: 2026-11-13
lane: "feat/outbox-draft-basis-check"
reversal: "Stop appending draft-closed and bound the check by draft age instead; recorded draft-closed lines stay readable and are ignored."
---

Operator ruling, 2026-11-13 (grill session). The attorney sends prepared drafts from Outlook, so the audit log never learns that a draft was sent, and without a closing record check-drafts would re-read every draft the server ever created on every call. When check-drafts finds a draft missing, or no longer a draft, it reports it and appends one draft-closed record with the reason; later calls skip it. A draft is open while it has a draft-created record and no draft-deleted, sent send-outcome or draft-closed record. The audit journal gains a record kind and no existing record changes, as the m365-agent-outbox packet's D-28 requires. Rejected: an age cutoff (a draft older than the cutoff would silently stop being checked while still unsent) and re-reading everything (cost grows without bound).
