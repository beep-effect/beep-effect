---
title: The capture preimage is the first eight occurrence elements, decoded through each field's schema
date: 2026-11-23
reversal: Give capture/v1 its own element order and decode the elements into a plain struct instead of through SourceTextIdentity.
governs:
  - src/Capture.ts#CaptureElements
  - src/Capture.ts#CaptureSchema
enforcedBy: []
---

The eight elements after the `capture/v1` domain tag are the first eight of `occurrence/v1`, in the same order (goal decision `p3-capture-id-in-text`).
Each element is decoded through the schema of its `SourceTextIdentity` field, so building the identity from decoded elements cannot fail; encoding reads the identity's fields.
Rejected: a separate element order, which would let a capture and the occurrences over it disagree about which source they name.
