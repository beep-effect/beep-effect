---
title: "P2: normalizeText takes the text first and the normalization second, the data-first order of every dual in @beep/text"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Swap normalizeText to (normalization, text) data-first and normalization-last curried, by a decision file, updating every caller in one commit."
---

Design section 1.7 writes normalizeText(normalization, text): NormalizedText. The implementation is dual(2, (text, normalization) => ...), so the data-first call is normalizeText(text, normalization) and the data-last call is normalizeText(normalization)(text). The repo's dual convention puts the data first, and every other dual of the package does: normalizeQuote(quote, normalization), mintQuoteKey(quote, normalization) (design 1.4), convertPosition(position, unit, sourceText) and slicePosition(position, sourceText) (design 1.5), resolve(sourceText, selector) (design 1.6) and reanchor(anchored, map, target) (design 1.8). The text is the data a normalization acts on, so section 1.7 is read as naming the parameters, not fixing a positional order, and its curried reading normalizeText(normalization)(text) is the data-last form the dual provides. Swapping the order would make normalizeText the one dual in @beep/text whose first argument is not the data, and its data-last form would curry over the text. Found by the verifier of commits 5 and 6.
