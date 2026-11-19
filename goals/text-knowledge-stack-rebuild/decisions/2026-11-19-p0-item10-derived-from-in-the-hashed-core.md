---
title: "P0 item 10: derivedFrom lives in the hashed core; L4-3 loses its support half; retraction is its own record"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
reversal: "Move derivedFrom to a separate Derivation record with an explicit acyclicity check over the log, by a decision file before P4 opens; L4-3 is restated over that graph in the same change."
---

What a claim was derived from is true at creation and never changes, so derivedFrom is a set of ClaimId in the immutable core, sorted on the preimage. Because a ClaimId is the hash of a preimage that contains its derivedFrom ids, a core cannot name itself or any later core: derivation is acyclic by construction. supportAtCreation is a set of OccurrenceId and an admission's grounding is a list of anchor receipts, so neither forms a graph over claims and the support half of L4-3 is deleted from the ledger with that reason. L4-3 is restated: the ClaimId changes when derivedFrom changes; every log built through the minting function has an acyclic derivation graph (checked with effect/Graph isAcyclic on generated logs); a Challenge cycle is accepted by the log. Retraction is a record that points at a core (claim, actor, reason, time), like Challenge and Admission, never a mutation; L4-4 is stated over it: a claim whose derivedFrom is non-empty and wholly retracted is flagged by the closure, transitively.
