# @beep/epistemic-domain

Schema-first claim, evidence, activity, contradiction-triage, and usage models.

## Verified evidence

`EvidenceVerification` is an append-only sidecar: it links an existing
`EvidenceId` to a provenance `VerifiedTextAnchor` without changing the core
`Evidence` entity. Its manifestation key seals the evidence id, exact
`SourceTextIdentity`, and exact UTF-16 anchor. Repeating that exact payload is
idempotent under the persistence constraint; source or anchor drift creates a
new manifestation instead of rewriting history.
