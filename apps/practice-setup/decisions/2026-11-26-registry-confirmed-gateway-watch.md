---
title: Require the registry to confirm a readable gateway install
date: 2026-11-26
reversal: Treat Enter as proof that Claude installed the expected gateway version.
governs:
  - src/Setup.program.ts#watchUntil
  - src/Setup.program.ts#watchForGateway
  - src/Setup.program.ts#installGateway
enforcedBy: []
---

A sign-in watch allows Enter as manual confirmation and asks the lawyer on timeout. A gateway watch uses Enter only to request an immediate registry check; only the expected registered version succeeds.
Reason: buffered keys cannot certify installation, and a saved sign-in marker can remain after the real session expires. Hand the file over and watch once more before failing.
Rejected: trust Enter over a readable registry. Only an unreadable registry falls back to the lawyer’s confirmation.
The race takes the first success and interrupts the loser, so an unreadable console does not stop the probe; a timed-out gateway watch can finish while the Enter loop has not confirmed a current version.
