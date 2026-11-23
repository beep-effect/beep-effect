---
title: "P2: a re-anchored range the target text cannot hold is Unmapped split-boundary"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Add an UnmappedReason for a target range past the text, or treat it as quote-mismatch, by a decision file before P3 records a re-anchoring."
---

Section 1.8 step 6 builds the TextAnchor from the target slice and verifies it, and a refusal is Unmapped split-boundary. A LocatorMap carries no text length, so a map whose target ranges run past the end of the target capture's text passes LocatorMapCheck, and the slice of such a range is shorter than the range: TextAnchor.make would throw on the width check instead of reaching verification. reanchor therefore checks the end of the image against the target text first and returns Unmapped split-boundary, the outcome verification gives for an end past the text (invalid-anchor). No new UnmappedReason is added: the design fixes the four reasons, and a range the target text cannot hold is a range whose boundaries are not boundaries of that text. A kept part that falls past the end is still quote-mismatch, because the kept comparison runs first. The segment lookup that compose and reanchor share is a binary search in src/internal/segments.ts, beside internal/scalars.ts; it is not exported from the package.
