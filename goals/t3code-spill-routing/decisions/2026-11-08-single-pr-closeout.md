---
title: "Closeout lands in one PR by operator ruling"
date: 2026-11-08
lane: "t3code-goals-closeout"
reversal: "Run goals set-status <slug> active, which turns the closeout record back into a proposal, in a packet-state PR"
---

The operator ruled on 2026-11-08 that these three goals reach completed-retained in one single PR, regardless of the packets' two-PR closeout, to keep the merge queue clear. So this PR commits status completed-retained with a closeout record naming itself, instead of a proposedCloseout adopted later. That puts the committed record ahead of its evidence: set-status guards only the proposal path, and no completion receipt can exist before the merge. The check runs afterward: goals completion refresh on this lane, from which a failure reopens the packet.
