---
title: "A pin compares a digest of named fields; changeKey is recorded and never compared"
date: 2026-11-10
reversal: "Switch the comparison to changeKey in the pure function and drop the view schemas; recorded pins already carry changeKey, so no journal migration is needed."
---

The driver schema documents changeKey as changing on every edit, and mail tagging writes categories onto inbound messages. A changeKey pin would report a draft stale after a tag, a reminder change or a read-state write. The server hashes only what the draft relied on: for an event, subject, start, end with zone, all-day and cancelled; for a message, its message id and whether a later message from another sender is in the conversation. Rejected: changeKey as the comparison. Source: exploration DECISIONS.md, entry pin-comparison (operator, 2026-11-10).
