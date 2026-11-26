---
title: "LawAdmission stays out of the host layer in P6"
date: 2026-11-24
lane: "p6"
reversal: "Add LawAdmissionLayer to LawPracticeServerLive once a production resolver and attestation exist."
---

The design lists `LawAdmission` in `LawPracticeServerLive`'s output, but `LawAdmissionLayer` needs a `SourceTextResolver` and an `AttorneyAttestation`. The server ships neither for production (P6 ships a test attestation only and no host admits in P6), and adding them would grow the layer's requirement beyond `LawPrincipal` and `MatterAuthority`. `LawPracticeServerLive` therefore outputs `OfficeActionReview`, `IrToLaw`, `LawClaimProposals` and `LawClaimAdmissions`; a host that admits composes `LawAdmissionLayer` over them with its own resolver and attestation. Code: `server/src/Layer.ts`.
