---
title: "P2 corrects P0: three stored columns hold an anchor shape, one derived key hashes a receipt, and legal_position_relator.grounding holds none"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Edit this file if a re-measurement on origin/main finds another column; SPEC and the census follow it."
---

Measured by the P2 provenance map. Stored anchor shapes: epistemic_evidence.span (EvidenceSpan), epistemic_evidence_verification.verified_anchor (a TextAnchorVerificationReceipt; a VerifiedTextAnchor is runtime-only and cannot be stored) and law_practice_patent_citation_event.grounding (a receipt). epistemic_evidence_verification.manifestation_key is a SHA-256 over the canonical JSON of the encoded receipt, so any change to the encoding of TextAnchor, SourceTextIdentity or the receipt would orphan every key. law_practice_legal_position_relator.grounding is a LegalPositionGrounding and holds no anchor. The P0 text that counts four columns and calls verified_anchor a VerifiedTextAnchor (decision p0-rq4, decision p0-census-dispositions, SPEC, census section f, DECISIONS.md) is read with this correction. The rule does not change: their bytes stay. P2 pins one frozen row per anchor column and one golden manifestation key before any code moves.
