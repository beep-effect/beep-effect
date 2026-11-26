---
title: "The test claim store serializes partitions and refuses a knowledge-start regression"
date: 2026-11-24
lane: "p6"
reversal: "Restore the unserialized test double; property (f) then only checks that both appends return."
---

The use-cases test double for `LawClaimProposals` runs every `withPartition` body under one permit and refuses an append whose knowledge start is earlier than the latest stored in its scope, the refusal the claim log makes as `KnowledgeStartRegression`. Property (f) of the write-tools test therefore fails if `ClaimProposal` stops flooring its activity at the partition's last knowledge start, which it would not with a store that accepts any order.
