---
title: "P0: makeClaimCore and the other builders take one options object, and valid is the existing ValidTime"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Return to positional builder arguments or a bare Interval for valid time, by a decision file before P4 opens; the L4 design file is edited in the same change."
---

makeClaimCore and the other layer builders take one options object, matching makeClaimEnvelope, so a slice passes its proposition and id schemas by name. The valid field of a claim core is the existing ValidTime schema (Unknown or Interval) rather than a bare interval, so a record that asserts no valid interval is representable. The shared canonical set codec and the rule that annotation and anchor records carry no id field are recorded in decision p0-items4-6-9-annotation-document-shape.
