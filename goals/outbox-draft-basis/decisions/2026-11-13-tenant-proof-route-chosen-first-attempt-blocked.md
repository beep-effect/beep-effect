---
title: "Tenant proof route chosen; first attempt blocked by Graph gateway errors"
date: 2026-11-13
kind: checkpoint
lane: "feat/outbox-draft-basis-check"
reversal: "Run the proof by hand in Outlook instead, or drop the mark by decision file if it cannot be run."
---

Operator ruling, 2026-11-13 (grill session): the proof is one test draft in the attorney's mailbox, written through the outbox's own Graph path with the category set by updateMessageCategories, addressed to one firm mailbox and one outside address the operator owns, and sent by a person from Outlook. On the same day every authenticated read of that mailbox answered HTTP 502 or 504 (messages and events, four attempts over about ten minutes), while Graph's public metadata and the sign-in metadata answered 200 and the configured mailbox and credentials checked out by length and hash. The draft was not created. The second pull request is built in the meantime and writes no category until the proof is recorded.
