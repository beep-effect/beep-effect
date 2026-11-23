---
title: "P2: a Refined selector over a base that is not Unique resolves to the base's outcome"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Resolve by inside every candidate of an ambiguous base and report the summed count, by a decision file before P3 builds on resolve."
---

Decision p2-selector-resolution-semantics says Refined resolves by inside the segment base selects, and that a composite is NotFound when a part is NotFound and otherwise Ambiguous with the product of the counts. It does not say what by is resolved in when base is Ambiguous: there is no single segment, and Resolution carries a count, not the candidates. resolve therefore does not evaluate by over an ambiguous or absent base; the Refined outcome is the base outcome (Ambiguous with the base count, or NotFound). The product rule stays for Range, whose parts are both resolved over the whole text. The outcome still fails closed exactly when it should: a Refined selector is Unique only when its base is Unique and by is Unique inside it. Counting every by match inside every base candidate would need candidate enumeration, which the design rules out (callers that need candidates search for them explicitly), and a nested Refined would multiply that work.
