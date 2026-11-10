---
title: "Refuse values outside plain JSON; drop only undefined members"
date: 2026-11-10
lane: "docs/protocol-as-value-graduate"
reversal: "Widen or narrow the pre-pass in a superseding decision and update the refusal-table test with it."
---

The owner returns a typed failure for a non-finite number, a bigint, a lone surrogate, a non-plain object and an undefined array element. One named pre-pass drops object members whose value is undefined, because every legacy encoder and JSON.stringify already treat such a member as absent. The legacy encoders coerced the rest silently, so two different values could share a digest. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.
