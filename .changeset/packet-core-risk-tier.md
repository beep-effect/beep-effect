---
"@beep/repo-cli": minor
---

Add the operator risk-tier override to the packet control-plane core: the
`PacketRiskTier` Light/Standard/Full vocabulary, the `risk-tier-overridden`
CAS event with its recorded challengeable reason, last-wins override
derivation in the fold and trace projection, `planRiskTierOverride` on the
guarded transition writer, and the `beep goals set-risk-tier` command
(preview-first, stream-and-trace only, refusing packets without an event
stream).
