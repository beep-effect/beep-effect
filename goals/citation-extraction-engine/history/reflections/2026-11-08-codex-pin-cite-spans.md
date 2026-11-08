---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Join original upstream cleaning observations before qualifying a final span substring assertion.
    explanation: The original pin-cite test cleans raw input before parsing. Replaying its cleaned parser input alone would omit that upstream behavior; the retained replay recomputes the same ordered pure builtin cleaning and independently checks the canonical output.
  - category: implementation-improvement
    confidence: high
    instruction: Compare both verified component coordinates and the actual selected substring with original independent operands.
    explanation: A correct-looking substring alone could conceal a wrong occurrence or coordinate conversion. Every pin-inclusive range is checked in both UTF-16-backed source evidence and original Python-point coordinates.
todos:
  - Qualify the original tag-balancing and long-diff annotation utilities.
  - Complete generic retained host/model/callback protocols and all outstanding representation/fidelity laws and exhaustive accounting.
---

# Original pin-inclusive source ranges

The source's standalone pure builtin cleaning and subsequent parser call are joined
to each original equality. The public extraction pipeline composes those same
ordered cleaners before parsing; this finite result proof does not imply general
retained Document or cleaner-container protocol equivalence. Actual verified
components determine the selected source text. Expected model observations,
coordinates and substrings remain independent expectations, never engine inputs.
