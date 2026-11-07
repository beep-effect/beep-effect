---
title: "Remove the seven unconsumed party factory bindings"
date: 2026-11-07
lane: "refactor/party-domain-kinds"
reversal: "Re-bind the factory in party-domain when a party use-case or server module consumes it"
---

Party-domain bound seven @beep/epistemics factory families (ClaimEvidenceReview, EvidenceVerification, Contradiction, ContradictionDetection, EdgeEndpoint, LogicalEdgeIdentity, ClaimProjection) to party ids to satisfy the P1b acceptance criterion. None is imported outside party-domain's own barrels, README and Factories.test.ts. Party's actual review, party-server ReviewLoop, partitions the parties of a collision case under an evidence digest and does not use ClaimEvidenceReview. Law-practice's claim projection imports the epistemic slice's binding, not party's. Remove the bindings, their root barrels and test/Factories.test.ts, along with the six fallow code-duplication annotations they needed. The identifier-distinctness proof the party SPEC requires now rests on the kept Claim envelope (test/Claim.test.ts pins @beep/party-domain/entities/Claim/). The Claim envelope binding stays because party uses it. Epistemic ownership is unchanged: the 2026-10-21 architecture decision still has each slice bind the foundation factories for itself when it needs them. Rejected: rebuilding ReviewLoop on ClaimEvidenceReview (its partition verdict does not fit a single-assertion review), keeping them as ready-made vocabulary (dead code with a duplication waiver).
