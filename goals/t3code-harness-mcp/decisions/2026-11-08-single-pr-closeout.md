---
title: "Closeout lands in one PR by operator ruling"
date: 2026-11-08
lane: "t3code-goals-closeout"
reversal: "In a packet-state PR, run goals set-status <slug> active, delete the proposedCloseout it leaves (a matching verified receipt would otherwise still project the packet as completed), and set the reopened phase back to pending"
---

The operator ruled on 2026-11-08 that these three goals reach completed-retained in one single PR, regardless of the packets' two-PR closeout, to keep the merge queue clear. So this PR commits status completed-retained with a closeout record naming itself, instead of a proposedCloseout adopted later. That puts the committed record ahead of its evidence: set-status guards only the proposal path, and no completion receipt can exist before the merge. The session that owns the closeout lane runs the refresh after merge and reads each packet's outcome; if that session has ended, the orchestrator does. Refresh records an outcome without failing or reopening anything, so for any outcome other than verified, that owner opens a packet-state PR reopening the packet.
