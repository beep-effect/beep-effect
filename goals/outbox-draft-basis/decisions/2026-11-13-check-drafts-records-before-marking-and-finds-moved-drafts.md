---
title: "check-drafts records a mark before writing it and finds a moved draft by its message id"
date: 2026-11-13
lane: "feat/outbox-draft-basis-check"
pullRequest: 3172
reversal: "Write the category before the record again and drop the message-id lookup; draft-created lines that carry internetMessageId stay readable and the field is ignored."
---

Review fixes on pull request 3172, agent-decided. First: the audit log is the only way the server knows a category on a draft is its own, so a mark is now recorded before it is written. If the record cannot be appended nothing is written; if the write then fails, the journal says marked with no category, and the next call appends the missing clear record without touching Graph. A clear writes first and records after, retrying the record once. The failure direction is always 'recorded but absent', never 'present but unrecorded', which had left the server's own category on a draft for good. Second: a message's Graph id changes when it moves, so a draft filed into a folder read as missing and was retired. The draft-created record now keeps the draft's RFC 5322 message id, and on a 404 check-drafts makes one lookup by it: a draft that moved keeps being checked under its recorded id, a hit that is no longer a draft closes as sent, and no hit closes as missing. Immutable Graph ids were rejected: the driver has no such header and recorded ids would need migrating. Third: a read without an isDraft value no longer retires a draft; it is unreadable for that run. Not verified on the tenant, which was down: that a draft carries a message id from creation and keeps it when moved or sent. The tenant proof checks it.
