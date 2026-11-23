---
title: Law generators build well-formed UTF-16 text and compute its boundaries from the code points
date: 2026-11-23
reversal: Generate text from arbitrary strings and filter out ill-formed samples, reading boundaries from the scan under test.
governs:
  - test/support/generators.ts#CodePointPick
  - test/support/generators.ts#narrowAlphabet
enforcedBy: []
---

Package mirror of goal decision `p0-law-generators-well-formed-text`. Code points come from printable BMP scalars below the surrogate block (one, two and three UTF-8 bytes) plus 64 astral emoji from U+1F600, which picks above 0x2fff map onto, so no sample is discarded.
Every boundary is computed from the code points themselves, independently of the scan under test, and every range sits on scalar boundaries. Split surrogates stay negative fixtures.
The narrow alphabet is one BMP letter and one astral scalar: over two scalars a passage overlaps itself often, which the wide alphabet almost never produces, so the KMP fallback step and surrogate pairs inside a repeated passage are both exercised.
Rejected: filtered arbitrary strings, which discard most samples and let the oracle share the scan's bugs.
