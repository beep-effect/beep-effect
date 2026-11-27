---
title: resolve holds a write again when its node moved to another text since the hold
date: 2026-11-26
reversal: Write theirs and merged on the node's current head whatever text it holds, and drop the in-transaction open check.
governs:
  - src/Admission.layer.ts#make
enforcedBy: []
---

A `theirs` or `merged` resolution is applied only while the node still holds the text the hold recorded (`movedSince`); otherwise the hold closes and the write is held again on the current head. A hold that recorded no head showed no text: its node had not reached the log, so a node that holds a text now has moved.
A `theirs` resolution of a held status move is exempt: it rewrites only the status token of the current text under the lifecycle guard, so it drops no other writer's text. A merged text replaces the whole text and takes the unmoved check.
`stillOpen` runs inside the resolve transaction, which holds the write lock, and fails when a `HoldResolved` for the hold committed after the fold's cursor. A re-judgment that appends nothing (held again on the same head, or refused) never reaches the log's own refusal of a second `HoldResolved`, so without this check it would answer for a hold another resolver closed; with both, of two resolvers exactly one settles a hold.
Rejected: writing the resolution on the current head whatever it holds (it overwrites a text the resolver was never shown), and relying on the log's `HoldResolved` refusal alone (a resolve that appends nothing goes unchecked).
