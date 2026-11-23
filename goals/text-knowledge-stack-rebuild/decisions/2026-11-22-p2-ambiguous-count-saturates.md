---
title: "P2: an Ambiguous count saturates at Number.MAX_SAFE_INTEGER, so a count there is a lower bound"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Carry the count as a bigint or a saturation flag in Resolution.Ambiguous, by a decision file before P3 builds on resolve."
---

Decision p2-selector-resolution-semantics makes a composite with an ambiguous part Ambiguous with the product of the counts, and Resolution.Ambiguous carries that count as S.Int, whose check is Number.isSafeInteger. A Quote count is at most the text length, but a Range multiplies the counts of its two parts and a Range may nest Ranges, so the product grows without bound: a Range of two Ranges of the quote a over ten thousand a counts 10^16 selections, past 2^53, and the Ambiguous constructor threw. Resolution outcomes are values, never errors (SPEC error boundaries), and Selector is a wire-decodable recursive union, so any decoded selector could reach the throw. resolve therefore saturates the product at Number.MAX_SAFE_INTEGER. Both factors are safe integers, so a product at or below the cap is exact and a product above it is finite; a saturated count is a lower bound on the true count. Ambiguity still fails closed, and no caller reads the count as anything but how many selections matched, which a lower bound past 2^53 still answers. A bigint count or a saturation flag would change the encoded shape of Resolution for a case no real selector reaches.
