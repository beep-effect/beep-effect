---
title: "P4: evidence keeps position and a separate reported confidence signal"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Retain frozen row codecs and source digests so the read projection can be reverted without a rewrite."
---

epistemic tables own frozen current and legacy span codecs. Strict current rows split to TextAnchor and extractor-confidence signal; loose legacy rows derive endChar as startChar plus UTF-16 quote width. A row still failing current text constraints is a LegacyEvidenceUnresolved record retaining old fields and reason, never a verified position. A stored scalar is Present reported confidence with method legacy-reported, never a calibrated probability. New writes use a tagged position-and-signal JSON shape in the existing span column; old rows are never rewritten. Table row schemas are separated from domain read records; both query shapes are supported by the span SQL accessors and converters. Verification receipts and manifestation-key bytes are not reminted; association compares the recovered position only, and unresolved spans cannot verify. Frozen synthetic fixtures cover strict, loose-width, empty and over-bound quotes.
