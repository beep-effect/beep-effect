---
title: "A deleted draft is retired, and a draft without a recorded message id learns it on the next read"
date: 2026-11-13
lane: "feat/outbox-draft-basis-check"
pullRequest: 3172
reversal: "Drop the Deleted Items test and the draft-identified record; recorded draft-identified lines stay readable and are ignored."
---

Round-two review fixes on pull request 3172, agent-decided; they amend the same day's decision on finding a moved draft by its message id. First: that lookup spans every folder, so a draft the attorney deletes in Outlook was found in Deleted Items, kept open and could even be marked. A hit in the mailbox's Deleted Items folder no longer counts as the moved draft, so a deleted draft closes as missing; the folder id is read at most once per call and only when a draft hit names a folder, and if it cannot be read the draft is unreadable for that run. Second: a draft-created record written before message ids were stored, or one whose id could not be read at creation, had no fallback. check-drafts now appends one draft-identified record with the message id Graph returns the next time such a draft is read under its recorded id, at no extra Graph call, and the lookup uses it. Keeping id-less records open forever was rejected because it brings back the unbounded re-read that draft-closed prevents. Not verified on the tenant, which was down: that a deleted draft keeps its draft flag and message id in Deleted Items, and that a message's parentFolderId equals the id Graph returns for the deleteditems folder. The tenant proof checks both.
