---
title: "P4: decode assessment input before replacing a coordinate"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Change coordinate codecs and refusal encoding together while preserving original records on failure."
---

updateAssessment accepts encoded input and a declared coordinate key. It decodes through the caller-supplied coordinate codec with S.decodeUnknownEffect before replacing the decoded value or evaluating any gate. Keep encoded and decoded sides distinct and preserve decoding service requirements. Malformed input returns InvalidAssessment with sanitized issue and the original unchanged record, and invokes the gate zero times. L4-6 adds this falsifier alongside totality, commute and owner monotonicity cases. Effect 4.1.5 source: .repos/effect/packages/effect/src/Schema.ts:1536.
