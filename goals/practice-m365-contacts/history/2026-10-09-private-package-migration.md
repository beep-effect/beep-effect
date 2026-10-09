---
"@beep/m365": major
"@beep/identity": patch
"@beep/practice-m365-contacts": minor
---

Add personal contact and contact-folder verbs with full private export records,
zero-replay contact creates, null-safe responses and mailbox-bound pagination.
Replace the removed write-scope blacklist export with a decoded delegated read
scope allow-list. Consumers must remove imports of `M365_RESERVED_WRITE_SCOPES`
and use `M365DelegatedReadScope` to validate delegated scope inputs.

Register the private practice contact seeding application identity.

Add the private CSV contact census and reversible mailbox seeding application.

This receipt preserves the proposed version impact and migration instructions.
Main's private-workspace release policy (PR #1566) rejects queued changesets for
these three private packages, so it is retained with the goal rather than in
the release queue. Publication remains dormant.
