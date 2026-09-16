# Quality runtime inventory

Inspected 2026-09-15 at base `d142324fe0`. This is a read-only source and installed-launcher inventory, not a new execution benchmark. Concurrent implementation may supersede these script values. No hosted jobs, dependency installs, or quality suites ran for this report.

Coverage and doctests are the clearest remaining Node-hosted Vitest candidates. Most ordinary tests, integration tests, property tests, docgen, Knip, and repository CLI logic already request Bun. Compiler and formatter workloads often execute native binaries; changing their JavaScript launcher cannot move the substantive work to Bun.

## Setup does not determine the child runtime

`.github/actions/setup-monorepo-ci/action.yml:204` installs Bun; lines 215–219 optionally install Node using a lane override or `.nvmrc`. `.github/workflows/heavy.yml:42` currently overrides coverage to Node 22.22.3. These steps make executables available. They do not prove which runtime a task or its workers execute.

The repository CLI has a Bun shebang (`packages/tooling/tool/cli/src/bin.ts:1`). Its lane definitions can spawn `bun`, `bunx`, native executables, Docker, or package scripts. `bun run <script>` does not turn every executable named inside that script into a Bun process. Node-shebang tools remain Node candidates unless the invocation explicitly changes that runtime. Worker witnesses are still required before accepting an execution claim.

## Task inventory

Paths below are relative to the repository root. `CiLane.ts` means `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`; generator means `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts`.

| Task | Current executable chain and owner | Runtime implication |
| --- | --- | --- |
| Coverage | `CiLane.ts:1338` invokes the root coverage operator, concurrency 3. Workspace scripts use `bunx vitest run --coverage`, with package exclusions/config overrides. Example: `packages/foundation/modeling/schema/package.json:12`. `vitest.shared.ts:249` selects V8. | Node by normal Vitest shebang dispatch; hosted reference is Node 22.22.3. The pilot separately witnessed actual Bun workers running the same provider. Preserve coverage populations, per-package baselines, branch counts, and runtime-specific behavior before adoption. |
| Doctest | `CiLane.ts:1185` schedules Turbo `doctest`. Generator lines 1191, 1218, 1247, 1269, 1290, 1316 prescribe `BEEP_VITEST_DOCTEST=1 bunx vitest run`. | Still a Node-hosted Vitest candidate. Requires a separate doctest-plugin, example-isolation, timeout and TSX qualification. Ordinary-test success does not cover this task. |
| Unit and property | `CiLane.ts:1497` selects unit tasks; lines 1435–1445 schedule `test:property`. Generator lines 1174, 1204, 1230 prescribe `bunx --bun vitest run ...`; property scripts delegate to `beep:test`. | Already Bun-hosted Vitest in almost every inspected package. Native Bun test is a runner migration, not a Node-to-Bun runtime switch. |
| Integration | `CiLane.ts:1496` selects integration tasks. Generator lines 1179, 1209, 1235 prescribe `bunx --bun vitest run test/integration ...`. | Already Bun-hosted. Containers, PGlite/WASM, databases, network and external tools retain their own costs. |
| Docgen | Package implementation defaults use `bunx --bun --no-install docgen` (generator 1181, 1211, 1237). Docgen's own package uses `bun run src/bin.ts` (`packages/tooling/tool/docgen/package.json:35`). Root `package.json:367–368` enters the Bun CLI. | Already Bun at the docgen entrypoint. Typechecking or other children still need separate attribution; do not claim every child is Bun merely because the entrypoint is. |
| Check and test typechecking | Generator 1167 and 1197 uses `tsgo -p tsconfig.check.json` followed by test checks. `Quality/Tasks.ts:2740–2755` also owns aggregate test-tsgo/smoke checks. | `.bin/tsgo` resolves to `tools/tsgo-shim/tsgo.js`. Its Node launcher resolves the installed Effect compiler artifact and execs it (lines 1–21). The compiler is TypeScript-Go, confirmed by installed `@effect/tsgo/README.md:1–3,215–217`. Bun can only alter launcher overhead here. |
| Library build | Generator 1163, 1193, 1219 uses `tsc -p tsconfig.json && bun run babel`; some packages use only `tsc`. Installed `typescript/bin/tsc:1` and `@babel/cli/bin/babel.js:1` have Node shebangs. | Actual JavaScript compiler/emitter work is a possible later Node-to-Bun study. Require emitted-file/declaration/source-map equivalence and total build measurement. Do not conflate this with native `tsgo` checking. |
| Application build | Current manifests use Next/Turbopack, Vite, Storybook, or `tsgo`; examples include `apps/todox/package.json`, `apps/professional-desktop/package.json`, `apps/storybook/package.json`. | Mixed JavaScript launchers and native/browser/compiler work. Needs application-specific child-runtime evidence; no blanket Bun speedup claim. |
| Package lint | Generator 1169, 1199, 1225 uses `biome check .`. Installed `@biomejs/biome/bin/biome:39–48` resolves and spawns the platform binary. | Biome's substantive work is native. Its Node bootstrap is not the lint engine. Root oxlint and typos are likewise native-tool work, not JavaScript runtime migration targets. |
| Lint policy and repository checks | `CiLane.ts:1420` executes `bun run beep lint policy --full`. Root scripts `package.json:416–449` route many laws/inventory checks through the Bun CLI, alongside typos and compiler checks. | Mostly already Bun orchestration plus native children. Optimize the slow constituent task rather than changing the job's setup runtime. |
| Knip | `Quality/internal/KnipRatchet.ts:407–418` invokes `bun run knip --reporter json`; root `package.json:387` maps to `knip-bun`; installed `knip/bin/knip-bun.js:1` has a Bun shebang. | Already Bun, including the ratchet's actual analyzer child. |
| Fallow | Root `package.json:370–380,430–443` plus the Bun quality wrapper. Installed `fallow/bin/fallow:3–4` dispatches `runBinary('fallow')`; installed README line 57 describes default analysis as Rust-native. | Switching the launcher does not switch the analyzer engine. |
| Security/SAST/secrets | `Quality/Quality.command.ts:1177` invokes gitleaks; around 1207 uses the OSV scanner container; 1285–1315 invokes Semgrep through Docker. `CiLane.ts:538` explicitly distinguishes the hosted pinned gitleaks image from local replay. | Scanner/container work, not Node test-runner work. The runtime of GitHub action wrappers is separately controlled by those actions. |
| Storybook tests | `apps/storybook/package.json` delegates to `bun run scripts/run-storybook-tests.mjs`; that script line 69 spawns bare `vitest run --config vitest.storybook.config.ts`. | Bun orchestration, ordinarily Node-shebang Vitest child, plus browser execution. Candidate only after browser/addon compatibility and actual worker witnesses. |
| Other lanes | `CiLane.ts:1325–1334` invokes `bunx commitlint`; 1424–1431 executes Nix; desktop IPC and ecosystem lanes run package-owned commands at 1342–1361. | Commitlint is a smaller JavaScript candidate. Nix, browser rendering and native desktop work do not become Bun workloads. Inspect individual package scripts before changing them. |

## Exceptions and scope

A direct scan of current `packages/**/package.json` and `apps/**/package.json` found 139 `beep:test` scripts: 138 explicitly use `bunx --bun`, while `@beep/identity` uses `bunx vitest run` (`packages/foundation/modeling/identity/package.json:31`). This is a manifest count, not the set of tasks selected by a particular PR. The scan found 133 coverage scripts, all plain `bunx vitest`; 28 explicit doctest implementations, all plain `bunx vitest`; and 90 explicit integration implementations using `bunx --bun`.

The infrastructure workspace is separate from those counts. `infra/package.json:38–40` combines Bun-hosted Vitest with a Lambda task that runs its own typecheck, native `bun test`, and bundle/zip checks. Its build is intentionally a no-op (line 32).

## Change ownership and recommended order

Workspace scripts are governed by the canonical package-script generator. Coverage rules are marked `owned` in generator lines 827–841, preserving package-specific commands; test/docgen/doctest defaults live at 1163–1316. Change the owning policy through its supported mechanism and run `bun run beep lint package-scripts --write`; preserve package exclusions and special configurations. The root CLI's task planning lives in `commands/Quality/Tasks.ts`, and hosted lane selection in `commands/Ci/CiLane.ts`. Node setup pins remain necessary for other consumers even if coverage changes.

1. Qualify Bun-hosted Vitest coverage first using the existing pilot evidence. Explain the five differing source coverage counts and observed memory increase; do not rewrite baseline expectations to hide a provider difference.
2. Consider doctests next, then the identity test exception. Their remaining Node invocation is concrete, but benefit has not been measured.
3. Consider JavaScript `tsc`/Babel build children only as a separate artifact-equivalence experiment. Storybook needs separate browser/addon qualification.
4. Do not sell native compiler, Biome, oxlint, Fallow, scanner, or already-Bun work as Node migration savings. Setup, cache misses, queue time, retries and external services remain separate contributors.

No duration, memory, or billed saving is inferred from this inventory. The earlier pilot worker witnesses support the coverage runtime observation only; the other rows are source-defined launch behavior pending execution witnesses where needed.
