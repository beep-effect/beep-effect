---
title: "P4: bind admission actions to exact claims in trusted state"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Replace the trusted binding resolver and its refusal tests together without granting schema-decoded authority."
---

Occurrence membership establishes support, not human approval of a proposition. Keep all P0 HumanAdmissionToken fields. A trusted resolver maps authenticated action and exact revision to a re-minted ClaimId or a versioned canonical claim-set digest with trusted immutable membership. The verifier checks the supplied checked ClaimRecord against that binding and all actor/action/revision/scope fields before admission. Caller metadata and a standalone claimed digest cannot establish the binding. Missing, stale or mismatched binding refuses without writes. L4-2 includes two claims A and B sharing occurrence O: a token authorizing A must refuse B.
