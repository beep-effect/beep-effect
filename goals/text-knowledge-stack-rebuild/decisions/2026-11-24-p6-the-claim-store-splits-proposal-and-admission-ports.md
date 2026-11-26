---
title: "P6: the law claim store splits into LawClaimProposals and LawClaimAdmissions; the proposal layer cannot require the admission side"
date: 2026-11-24
lane: "p6"
reversal: "Merge the two ports back into one LawClaimStore"
---

Independent review of the P6 design. The first draft asserted that the claim_propose handler's requirements exclude AdmissionPorts, but AdmissionPorts is a plain interface, never a Context requirement (epistemics/src/Admission.ts:280), so the assertion was always true; LawAdmission was not excluded; and one LawClaimStore port with append(entry), openAdmission and admissions would let a proposal path store an Admission, whose decoding repeats no authority verification (epistemics/src/ClaimCore.schema.ts:224-226). The store splits: LawClaimProposals (appendProposed of a LawProposedClaimRecord with its GenerationFact and activity records only, findProposed, get, generation, activities, withPartition) and LawClaimAdmissions (openAdmission, binding, appendAdmission, admissions), provided to LawAdmission's layer only. The server's memory layer backs both from one state. The write-tools test asserts at the type level that the ClaimProposal layer's RIn and the toolkit handler layer's RIn exclude LawAdmission, LawClaimAdmissions and AttorneyAttestation, and property (c) checks that after a successful claim_propose the admission side holds no admission and no binding. Amends 2026-11-24-p6-law-claims-are-held-in-memory-until-a-host-persists-them.
