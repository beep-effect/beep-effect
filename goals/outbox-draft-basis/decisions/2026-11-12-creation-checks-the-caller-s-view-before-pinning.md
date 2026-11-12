---
title: "Creation checks the caller's view before pinning"
date: 2026-11-12
lane: "@chore/organizing-goal-packets"
pullRequest: 3120
reversal: "Drop the caller view from the create_draft pin parameter and pin the server's read alone; no record with pins exists before the first pull request merges, so nothing migrates."
---

A review of #3120 found a gap: an agent reads an event at A, the event changes to B, and create_draft pins B because the server reads the item at creation, so every recheck reports pinned-current although the draft was written from A. Each pin parameter now also carries the named view the caller composed from. The server compares it with its own read using the pin comparison and refuses creation with basis-changed on any difference, creating nothing; the stored view stays the server's read, and changeKey is still never compared, since it moves on edits outside the named fields. Comparing the caller's view rather than a server-issued observation token keeps the server stateless between read and create. Agent-proposed while addressing the review; the operator reviews asynchronously.
