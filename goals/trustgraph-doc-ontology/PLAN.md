# TrustGraph Documentation Ontology Plan

## Current Plan

- Treat the packet as artifact-complete research precedent and reclassify it to
  `reference`.
- Keep [SPEC.md](./SPEC.md) as the authoritative workspace contract.
- Use the scripts under [scripts/](./scripts) to regenerate and verify the
  artifact set.
- Treat [history/outputs/](./history/outputs) as generated deliverables, with
  [ops/manifest.json](./ops/manifest.json) as the machine-readable index.
- Do not run the live TrustGraph config round-trip probe: no TrustGraph instance
  is running. Local structural verification is the retained proof (641 quads;
  SHACL conformant).
