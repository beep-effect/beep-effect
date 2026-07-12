# Sources — pretext-driver

The research for this packet lives in the parent exploration; this file is
the pointer set, not a duplicate.

## Primary

- `explorations/computable-workspace-geometry/RESEARCH.md` — full pretext
  technical map (mechanism, purity boundary, per-engine determinism scope,
  accuracy corpus 7680/7680 × 3 browsers, benchmarks, limits), the
  docks×blocks×pretext isomorphism, and the divergence-cost audit.
- `explorations/computable-workspace-geometry/DECISIONS.md` — Q1 seam
  ratification (consume/wrap as driver; entrypoint law; revisit triggers).

## Upstream

- npm `@chenglou/pretext` (v0.0.8 at research time, MIT, zero runtime deps).
- Local clone for API reference: `~/YeeBois/dev/pretext` — README.md (API
  glossary), RESEARCH.md (measurement design + rejected approaches),
  PLATFORM_BUGS.md (emoji width, system-ui hazards), AGENTS.md (maintenance
  doctrine), src/measurement.ts (EngineProfile quirk fences).

## In-repo proof material

- `scratchpad/computable-layout/` — fixture oracle capture (Chrome/150),
  FontMetricsSnapshot v0 + v1 codecs, pure-breaker tests, and
  `full-circle.test.ts` (metrics → dock kernel geometry).
- `standards/architecture/03-driver-boundaries.md` and
  `07-non-slice-families.md` — routing and dev-safe driver duties.
