# Crispen debt ledger — quality-gate-ratchets

- **Ratchet-module shared skeleton** (2026-07-06): CoverageRegression /
  KnipRatchet / JSDocRatchet (+ Tasks.ts step plumbing) share a ~40-line
  baseline-read/compare/exit shape that fallow audit flags as 4-instance
  duplication (suppressed inline per repo grammar). Deliberate deferral:
  extract a shared `internal/RatchetSupport.ts` (read-baseline, compare,
  advisory rendering, exit mapping) in a follow-up — in-PR extraction was
  out of crispen scope per the goal's locked decision 1.
- **vitest.setup.ts Bun-API shim complexity** (2026-07-06): 8 complexity
  suppressions are inherent to runtime emulation; revisit only if the
  coverage lane moves off node or Bun ships istanbul-compatible coverage.
