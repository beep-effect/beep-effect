# beep CLI composition — Sources & Provenance

- **Source exploration:** none. This goal came from an operator grill
  (2026-10-21 to 2026-10-28) run with the `grill-with-docs` skill.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| Import-graph census of `packages/tooling/tool/cli/src` | Unit-to-unit edges, comments excluded | beep-effect | `packages/tooling/tool/cli/src` | Coupling | Summarized in `research/design-record.md` |
| Hosted CI job logs, check run 39569751919 | repo-cli test, coverage, docgen and lint-policy timings | beep-effect | GitHub Actions | Gate cost | Summarized in `research/design-record.md` |
| Fleet Turbo task timings | Task share and cache-hit rates | beep-effect | `goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv` | Gate cost | Cited |
| Check census baseline | repo-cli type-check cost | beep-effect | `standards/check-census.regression-baseline.jsonc` | Gate cost | Cited |
| Last 400 first-parent `main` commits | Invalidation simulation input | beep-effect | `git log --first-parent -400 --name-only` | Payoff | Summarized in `research/design-record.md` |
| Local repo-cli vitest runs, 2026-10-31 | G1 before/after wall time and isolation census | beep-effect | `packages/tooling/tool/cli/vitest.config.ts` | Gate cost | Summarized in `research/g1-parallel-vitest.md` |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| None | N/A | N/A | N/A |

## 3. External research sources

None.

## 4. In-repo capability references

- `goals/effected-promotion` owns the substrate kits this program adopts
  (`@beep/cli-kit`, `@beep/repo-workspaces`, the shared fence extractor).
- `goals/repo-cli-modularization` is the superseded predecessor.

## 5. Cross-links & provenance

- `standards/architecture/DECISIONS.md`, entry 2026-10-28 "One beep App
  Composes beep-Prefixed Command Tools".
- The full reader, mapper and verifier reports stayed in the authoring
  session's scratchpad; `research/design-record.md` keeps what later waves
  need.
