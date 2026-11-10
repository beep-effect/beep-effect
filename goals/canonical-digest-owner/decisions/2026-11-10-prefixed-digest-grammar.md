---
title: "One sha256: digest grammar in @beep/schema; no encoding version in the string"
date: 2026-11-10
lane: "docs/protocol-as-value-graduate"
reversal: "Add a second algorithm prefix or a versioned form in a superseding decision; stored values keep decoding because the grammar only widens."
---

A self-describing digest is sha256: plus 64 lowercase hex digits, the form ContentDigest and SourceTextDigest already use. @beep/schema owns it beside Sha256Hex and domain digests brand over it. The encoding version stays out of the string: the schema naming a preimage contract carries it, so two digests of the same bytes never differ for a reason the hash cannot see. Bare Sha256Hex stays valid wherever it is stored. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.
