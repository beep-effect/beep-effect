# Declaration-Only Builds — Sources & Provenance

- **Source exploration:** `explorations/build-pipeline-simplification` — primary ledger:
  `explorations/build-pipeline-simplification/research/SOURCES.md`.
- This goal mines no upstream source and ports no code. Its evidence is the
  exploration's measurements and in-repo capabilities.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| none | No external source is mined | n/a | n/a | n/a | n/a |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| none | n/a | n/a | Nothing is vendored or ported |

## 3. External research sources

The external landscape (Bun, tsdown, rolldown, Rslib, Effect build practice)
is cited in the exploration's ledger, sections 2 and 3. It supports the
non-goals here and nothing in the implementation.

## 4. In-repo capability references

| Brick | Package / owner | Path | Use |
| --- | --- | --- | --- |
| Generated build and check defaults | `@beep/repo-cli-kit` | `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts`, `PackageScriptsPolicy.ts` | change the values, regenerate |
| Package scaffolds | `@beep/repo-cli` | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`, `packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts` | drop the `babel` key |
| Check-program census and gate | `@beep/repo-cli` | `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts`, `CheckCensusGate.ts`, `standards/check-census.regression-baseline.jsonc` | build-versus-check proof |
| Build output contract test | `@beep/repo-cli` | `packages/tooling/tool/cli/test/build-turbo-outputs.test.ts` | extend for declaration-only output |
| Emit settings | repo root | `tsconfig.base.json` | declaration-only emit |
| Task graph | repo root | `turbo.json` | `build` outputs, `check` dependencies |
| Bundle probe | `@beep/effect-drizzle` | `packages/ecosystem/effect-drizzle/test/bundle-build.ts` | fix stale comment, add validity assertions |
| Compiler runbook | docs | `docs/runbooks/typescript-toolchain.md` | describe the new build |
| Release Lane rule | standards | `standards/architecture/14-ecosystem-packages.md` | constraint: owns any publish lane |

## 5. Cross-links & provenance

- Exploration: [`README.md`](../../../explorations/build-pipeline-simplification/README.md),
  [`BRIEF.md`](../../../explorations/build-pipeline-simplification/BRIEF.md),
  [`DECISIONS.md`](../../../explorations/build-pipeline-simplification/DECISIONS.md),
  [`MAP.md`](../../../explorations/build-pipeline-simplification/MAP.md).
- Measurements: [Experiment 3](../../../explorations/build-pipeline-simplification/research/experiments/2026-11-10-reverification-and-check-sweep.md)
  and its [raw rows](../../../explorations/build-pipeline-simplification/research/experiments/2026-11-10-check-sweep.tsv);
  [Experiment 2](../../../explorations/build-pipeline-simplification/research/experiments/schema-build-timings.md).
- Earlier coherence fix this goal builds on: #1874, recorded in
  `goals/repository-simplification-residue/SPEC.md`.
