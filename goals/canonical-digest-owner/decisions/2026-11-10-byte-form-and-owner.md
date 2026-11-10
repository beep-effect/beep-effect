---
title: "Canonical bytes are RFC 8785 and @beep/jsonc owns them"
date: 2026-11-10
lane: "docs/protocol-as-value-graduate"
reversal: "Supersede with a decision naming another owner; the swaps are import changes held byte-equal by test, so reverting them restores the old encoders."
---

The canonical byte form is RFC 8785 output and JsoncFingerprint in @beep/jsonc is its only implementation. A new encoder in @beep/schema was rejected: @beep/jsonc already depends on @beep/schema, so that would be a cycle or one more copy. A differential run found the epistemics, PacketCore and semantica encoders byte-identical to it on plain JSON. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.
