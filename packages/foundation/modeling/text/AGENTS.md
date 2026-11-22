# @beep/provenance

Pure provenance value models for the repo.

- This is a `foundation/modeling` package.
- Keep it domain-safe: no capability, driver, tooling, app, slice, server,
  table, UI, or live Layer dependencies.
- Keep it product-agnostic: no claim/evidence/IP-law semantics. Anchors point at
  source text; confidence and meaning belong to the consuming slice.
- Use schema-first models and `$ProvenanceId` identities.
