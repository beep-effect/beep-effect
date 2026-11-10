# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `declaration-only-builds` | Library builds emit declarations only: remove the Babel pass and JavaScript emit from generated package builds, then type-check each package's source once if the census proves build and check agree. | none | Generated build defaults: `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts` (`ImplScriptDefault` rows for `library`, `tool`, `ecosystem`, `infra`) and `PackageScriptsPolicy.ts`, applied with `bun run beep lint package-scripts --write`. Package scaffolds: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`, `Architecture/OperationPlanPackageJson.ts`. Check-program census: `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts`, `CheckCensusGate.ts` (`beep quality check-census`). Build output contract: `packages/tooling/tool/cli/test/build-turbo-outputs.test.ts`. Emit settings: `tsconfig.base.json`. Task graph: `turbo.json` (`build`, `check`). Runbook: `docs/runbooks/typescript-toolchain.md`. NET-NEW: none. |

Gated candidates (not scaffolded; a fired gate reopens this packet at
`decompose`):

| Candidate | Gate | Source |
| --- | --- | --- |
| Publish lane for an ecosystem member (manifest projection, attw/publint, pure annotations and JavaScript in the shipped output) | Release Lane activation under `standards/architecture/14-ecosystem-packages.md` | DECISIONS Q2, Q4 |
| Source-resolved checking, no project references | Per-project wall ratio under about 1.3x on a re-run of Experiment 3, or stale-`dist` failures recur | DECISIONS Q7 |
| Bundler for library builds | Bun ships declaration emit and per-module output, or the repo adopts `isolatedDeclarations` | DECISIONS Q1 |

Handed elsewhere, not candidates of this packet:

- SchemaCompiler: `effect-schema-parity` DEFER ruling and its re-entry triggers (DECISIONS Q5).
- App bundle and start-up measurement: `explorations/INBOX.md` bullet dated 2026-11-10 (DECISIONS Q6).

## Sequencing

One goal, three PRs in order (BRIEF "Solution Sketch"):

1. Baseline and proof harness, plus the three stale findings. No behaviour
   change, so it can merge while the others are still being written.
2. Declaration-only build. Needs PR 1's baseline to show what it bought. Its
   own hosted gate proves nothing reads `dist/*.js`.
3. Check once. Conditional on PR 1's census result. Cut first if the appetite
   runs out or any diagnostic difference shows up.

PR 2 changes a global Turbo input (`tsconfig.base.json`), so it invalidates
every package's build cache once. Land it when the merge queue is quiet and
tell the sibling verification goals before and after.

## First Vertical Slice

PR 1. When it lands, an agent can run `beep quality check-census` and read, for
every package, whether the build program and the check program report the same
diagnostics cold, with warm incremental state, and after a cache restore; and
the packet holds a repo-wide number for what the Babel step and JavaScript emit
cost. Verified by the census gate's own tests and by the committed baseline.
That result decides whether PR 3 exists.

## Open Risks Inherited From The Brief

- A hidden reader of `dist/*.js`; PR 2's hosted gate decides, a named
  per-package override is the patch.
- Incremental or cache-restored builds reporting fewer diagnostics than a cold
  run on a beta compiler.
- `TSRS_FAST=1` is set for checks and not for generated builds.
- Check configs use the repo root as `rootDir`; the reason is not yet known.
- An own-`build` edge on `check` changes filtered runs; `verification-route`
  and `route-soundness-repair` own affected-routing.
- `publishConfig.exports` will point at JavaScript that no longer exists, while
  every package is `private: true`.
- Wall-time baselines move under `local-proof-under-ten`, `hosted-setup-tax`,
  `heavy-pool-diet` and `certainty-scorecard`.
- Babel catalog entries may have another consumer.
