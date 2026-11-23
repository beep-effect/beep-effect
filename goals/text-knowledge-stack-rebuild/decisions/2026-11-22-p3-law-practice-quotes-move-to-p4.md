---
title: "P3: the langextract offset ranges move in P3; the law-practice TextQuote, SourceRef and SourceQuote move in P4"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Re-express the three law-practice shapes in the P3 PR by a decision file"
---

Decision `p2-langextract-and-law-quotes-move-in-p3` sent the law-practice `TextQuote`, `SourceRef` and `SourceQuote` to P3 beside the langextract ranges. P3 takes the langextract ranges: `TextOffsetRange` and `Utf16TextRange` become `Position`, and `convertTextOffsetRange` becomes `convertPosition` with its refusals, including `ill-formed-text`. Their consumers are the law-practice `OccurrenceProjection` and two tests, lejeune `Normalize` and `Rules`, and two citation-extraction-engine ops scripts. The three law-practice shapes have no annotation reader: `TextQuote` and `SourceRef` locate ReviewHub evidence by quote, and `SourceQuote` feeds claim evidence, which P4 rewrites with `EvidenceSpan`. They move in P4, where `TextQuote` becomes the `@beep/text` quote selector.
