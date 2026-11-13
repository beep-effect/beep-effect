---
title: "Tenant proof: the category stays on the sender's side"
date: 2026-11-13
lane: "feat/outbox-draft-basis-check"
pullRequest: 3172
reversal: "Drop the mark by decision file and amend the check-drafts criterion if a later tenant or client shows the category on a recipient copy."
---

Run on 2026-11-13 in the firm tenant, by the route the operator ruled. Two test drafts were written to the attorney's mailbox through the outbox's app-only Graph path, and the category 'Draft - recheck before sending' was set on each with updateMessageCategories under the change key just read. One was addressed to a firm mailbox and to an outside mailbox the operator owns at another mail provider; the operator sent it from Outlook at 16:21Z. An agent's click on Send was refused by its permission layer, so the send was a person's. The other draft had no recipients and was discarded in Outlook on the web by the agent, on the operator's instruction, to test deletion.

Recipients. The firm recipient's copy, read through Graph, has an empty category list. The outside recipient's raw message (52 headers, read by the orchestrator session) has no Keywords header and no occurrence of the category text in headers or body; its Message-ID equals the draft's. The category reaches neither an internal nor an external recipient, so the mark ships as built and the check-drafts criterion stands unamended. The Sent Items copy in the attorney's mailbox keeps the category; that copy is the sender's own.

The three points the review fixes left unverified, now observed. First: the create response already carries an internetMessageId, the value is unchanged after the category write, and the sent copy has the same value under a new Graph id, with isDraft false; the recorded draft id answers 404 after the send. Second: the discarded draft has a new Graph id, keeps isDraft true and the same internetMessageId, and its recorded id answers 404. Third: that copy's parentFolderId equals the id Graph returns for the deleteditems folder. The moved-draft lookup, the sent test and the Deleted Items rule therefore rest on observed behaviour.

Limits. One tenant, one day, Outlook on the web, plain-text body, one outside provider. Whether a filing rule or another client would behave differently was not tested. The colour of the category still needs the one-time manual red category in the attorney's Outlook.
