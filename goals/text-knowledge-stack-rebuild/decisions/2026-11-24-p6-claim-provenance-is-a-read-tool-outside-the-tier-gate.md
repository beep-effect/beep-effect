---
title: "claim_provenance is a read-only tool that answers Missing and skips the tier gate"
date: 2026-11-24
lane: "p6"
reversal: "Dispatch claim_provenance through dispatchWithTierGate like claim_propose."
---

claim_provenance writes nothing, so it carries readOnly true, idempotent true, destructive false and openWorld false and runs without an approval. Its only failure is Missing, returned for an absent claim and for a claim whose scope the principal may not traverse, so the answer never reveals that a denied claim exists. The matter wall is enforced inside ProvenanceTraversal, not by the tool layer. The toolkit spans are renamed to LawClaimToolkit.claimPropose and LawClaimToolkit.claimProvenance so both conform to the span naming law.
