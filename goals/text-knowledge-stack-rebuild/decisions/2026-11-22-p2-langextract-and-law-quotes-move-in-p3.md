---
title: "P2: langextract offset ranges, locate and history, and the law-practice quote projections, move in P3; P2 re-points their imports only"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Re-express convertTextOffsetRange on convertPosition inside the P2 PR by a decision file; its consumers are langextract, law-practice server OccurrenceProjection and two law-practice tests."
---

The census sends langextract TextOffsetRange and Utf16TextRange, and law-practice TextQuote, SourceRef and SourceQuote, to P2 and P3. The PLAN P2 row names none of them. P3 rewrites the langextract handoff and IrToLaw over the annotation document, so re-expressing their spans in P2 would edit the same code twice and put a behaviour change (refusal types, yield points, the million-unit limit) inside the mechanical package move. P2 changes only import paths in those files; the NFKC cluster defect found in VerifiedSpan.normalization.ts is fixed by its own small PR off main (decision p2-nfkc-clusters-join-on-the-normalized-mark), not inside P2. A P2 test in @beep/langextract asserts that convertTextOffsetRange and convertPosition agree on generated well-formed text and valid ranges for both shared units, so P3 starts from a proved equivalence. GroundedExtraction and the attempt records that embed it stay byte-identical.
