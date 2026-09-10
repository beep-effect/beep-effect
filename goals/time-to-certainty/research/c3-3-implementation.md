# C3.3 implementation results

## Stage A

Implemented the package-local scanner on `ttc/c3-3-laws-task`. No git writes or graft commands
ran. Stage B task registration, fleet runs, policy-plan rewiring, and packet lifecycle changes
were not started.

### Decisions and rejected alternatives

1. Added `LawsPackageScope`, `LawsPackageFinding`, and `LawsPackageReport` before the worker;
   `LawsPackageLaw` is a LiteralKit. Scope records the package, repository root, actual config
   path, and selected laws. Reports retain per-law counts, diagnostic text, advisory status,
   strict failure, and the actual project source-file count. All four schemas have fast-check
   round-trip coverage using `S.toArbitrary` and `effect/testing`.
2. Extended `TsMorphProjectInspectionRequest` with `loadTsconfigFiles`, whose constructor and
   decoding default is true, and an explicit `packageSyntax` factory selecting the tsconfig
   entrypoint, `mode: syntax`, `referencePolicy: workspaceOnly`, and false preload. The project
   pool separates ordinary and explicit-file projects. The existing root-scoped project
   options and default remain unchanged. Rejected changing the global root default or reusing
   a preloaded project for the package request. A fixture deliberately includes an unrelated
   root file in its package config: ordinary inspection sees three files, package inspection
   sees exactly its two discovered files, and returning to the package pool still sees two.
3. Provided a `LawScanProject` service around the package worker. Terse-effect, native-runtime,
   and the shared frozen-grant-set/effect-fn scan scaffolding reuse it; absent that service,
   their existing project acquisition paths remain. Package-test-imports reuses the existing
   source-root ownership walker and module-specifier detector on the shared SourceFiles,
   reading every package manifest without creating a second project. Rejected copying the
   detectors, retaining subprocesses, or changing the root law commands.
4. Preserved the package TS/TSX expansion from amendment 6, including files outside src/test,
   with artifact and declaration exclusions. Each detector retains its diagnostic exclusions;
   ecosystem exclusion applies to terse-effect/native-runtime, and tests remain excluded from
   those four syntax laws but included in package-test-imports. Terse-effect stays advisory;
   other laws retain their existing strict-failure policy, including native-runtime warnings.
   The CLI uses `lint laws:` prefixes and fails at the first failing report row. The scanner
   collects every selected law's result in one process/project. Empty packages skip the four
   syntax laws but still perform package-test-import ownership discovery. Non-packages paths
   omit that law and explain why.
5. **Explicit contract deviation requiring Fable's ruling before landing:** the brief assumes
   a package-root `tsconfig.test.json`, but repo-cli, todox, ciops, and infra do not have one.
   The resolver prefers it when present, otherwise uses that package's `tsconfig.json` solely
   for compiler options with config preload disabled, adding the full package TS/TSX surface
   explicitly. The actual selected path is recorded in `LawsPackageScope`. An asynchronous
   question offered this fallback or creating missing overlays; no answer was received during
   this launch. The fallback is implemented and tested, but is not represented as an approved
   amendment. Rejected falling back to the repository root, creating a fleet of unrequested
   config files, or silently omitting package tests.
6. Kept the deprecated-API code, `Quality/Tasks.ts`, ESLint configs, Turbo task declarations,
   workspace manifests, and root commands unchanged. The structure-only fingerprint writer
   and check remain the canonical declaration proof; no content digest or task registration
   was introduced.

### Stage A — files

- goals/time-to-certainty/research/c3-3-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts
- packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts
- packages/tooling/tool/cli/src/commands/Laws/LawsPackage.model.ts
- packages/tooling/tool/cli/src/commands/Laws/LawsPackage.ts
- packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts
- packages/tooling/tool/cli/src/commands/Laws/index.ts
- packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts
- packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts
- packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts
- packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts
- packages/tooling/tool/cli/test/laws-package.test.ts
- packages/tooling/tool/cli/test/lint-workers.test.ts

### Verification commands and exit codes

The two test files are `test/laws-package.test.ts` and `test/lint-workers.test.ts`, run from
`packages/tooling/tool/cli`. `<touched TS>` means the twelve TypeScript paths above. Tests use
scoped fixtures, platform services, no Bun globals, and no Git-writing fixture commands.
The executable worker test spawns the real CLI against a package fixture; the in-process
command test proves no law subprocess is requested and a finding produces failure.

| Command | Exit | Result |
| --- | --- | --- |
| `bun run beep architecture` | 0 | Read-only command index before creating the Laws modules. |
| `bunx biome check --write <touched TS>` | 0 | Final formatting pass. Initial test pass found unused imports, subsequently removed. |
| `bunx biome check <touched TS>` | 0 | Twelve files, no fixes, final 1,021 ms. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 1, 0 | Hoisted the new scope factory's compiled decoder; final pass has no diagnostics. |
| `bunx --no-install vitest run --pool=threads <touched tests>` | 0 | Both files, 25/25 tests, final 30.08 s. |
| `bunx --bun vitest run --pool=threads <touched tests>` | 1, 0, 0 | Initial live fixture lacked a tsconfig; supplied its explicit fixture overlay. Final 25/25, 20.47 s. |
| `bun run beep lint schema-first` | 0, 0 | Final inventory has no missing/stale entries, candidates, or advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0, 0 | Final saved report `exitStatus: 0`; nine inherited-adjacent nonblocking findings, zero introduced. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0, 0 | Final saved report `exitStatus: 0`, zero findings. |
| `bun run beep lint policy-fingerprint --write` | 0 | Repeated after CLI source edits; declaration and Turbo inputs remain byte-identical to the starting tree. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current declaration and materialized inputs. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx --no-install tsgo -p /tmp/c3-3-focused.json --pretty false` | 1 | Environment: the Node wrapper's child spawn returned EPERM. |
| `bunx --bun --no-install tsgo -p /tmp/c3-3-focused.json --pretty false` | 1, 0 | Final source-resolving check is clean. Intermediate introduced annotation, literal helper, unused-import, test Effect-boundary, and nested-layer diagnostics were repaired. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace check. |
| `bun run beep laws <law> --check [--advisory] --include <package files>` | 0 for all 12 | Final root-command parity: four laws on each of identity, schema, and repo-cli; all diagnostic counts remain zero. |
| `cmp turbo.json /tmp/c3-3-turbo-before.json` | 0 | Turbo configuration is byte-identical to the initial tree. |

The focused tsgo config extends the actual CLI config, includes the two touched test files
and their source imports, removes project references, and sets no-emit/non-composite/
non-incremental options, repository rootDir, and local Node/Bun type roots. It is supporting
proof, not canonical package verification. Node and Bun test runs were concurrent with each
other, so their wall times are test evidence rather than comparable performance benchmarks.

### Measurements

Each before/after worker probe ran from the repository root with `/usr/bin/time -f
'wall=%e maxRSS=%M exit=%x' bun run beep lint laws --package <directory>`. Measurements were
sequential, with final after probes separated from the test/check fan-out. RSS is GNU time's
maximum resident set size in KiB, not aggregate RSS across concurrent processes. All six
worker probes exited 0. The brief's historical identity baseline was 14.3 s / approximately
1.0 GB; the table uses the fresh baseline from this launch instead.

| Package | Before wall | After wall | Before max RSS (KiB) | After max RSS (KiB) | After project files |
| --- | ---: | ---: | ---: | ---: | ---: |
| `@beep/identity` | 12.76 s | 2.69 s | 1,027,272 | 1,065,364 | 21 |
| `@beep/schema` | 13.91 s | 3.59 s | 1,302,316 | 1,521,936 | 349 |
| `@beep/repo-cli` | 21.49 s | 8.35 s | 2,825,780 | 3,911,464 | 746 |

Wall reductions are 78.9%, 74.2%, and 61.1%; RSS increases are 3.7%, 16.9%, and 38.4%.
This is a wall-time improvement, not a memory improvement. The shared package project holds
test source alongside production source, and the existing CLI boot/import cost remains.
No fleet concurrency change, cache-hit claim, hosted timing, or whole-proof speedup follows
from these three samples. The synthetic negative fixture proves the source boundary directly:
exactly two package files, no imported dependency file, and no unrelated root preload.

All three baseline workers reported zero terse, native-runtime, frozen-grant-set, and
effect-fn diagnostics; their final package workers report the same zero findings. The
one-violation-per-law fixture separately exercises nonzero results and failure/advisory policy.

The final direct root-command comparison executed all four root laws on the same discovered
package surfaces (21, 349, and 746 files respectively), with `--check` and terse-effect's
`--advisory`. All twelve commands exited 0 and all touched/warning/error/violation counts
were zero, matching the package reports. Full ephemeral logs are under `/tmp/c3-3-parity-*`;
this paragraph preserves the outcome without depending on those temporary files.

### Blockers, baseline notes, and verification split

The missing package-root test-overlay assumption remains a design-contract blocker, described
in decision 5. The implementation uses the documented package-config fallback; no user reply
ratified it in this launch. Fable must accept that amendment or replace it with explicit
package-root test overlays before calling the implementation an exact match to the brief.
All requested sandbox checks pass; no sandbox check failure is being waived.

Fable owns `bun run beep quality package-verify @beep/repo-cli`,
`bun run beep quality package-verify @beep/repo-utils`, Node coverage/ratchet, docgen acceptance,
and the hosted lane. This lane did not run or claim those checks. The required baseline-row
notes for new source modules are:

| New source row (CLI-relative) | Coverage handoff |
| --- | --- |
| `src/commands/Laws/LawsPackage.model.ts` | Four schema round trips exercise constructors and codecs. Fable must measure and establish the coverage row; 100% coverage has not been claimed. |
| `src/commands/Laws/LawsPackage.ts` | Fixtures cover the five detectors, explicit/no-preload scope, missing overlay, lab/app/infra inventory, ecosystem exclusions, root-owned TSX, empty package, and command failure. Fable must measure branch coverage, including malformed/missing configuration and platform failures, before establishing the row. |

Existing rows for the Laws facade/scanners, lint command, package-test-import detector, and
TSMorph model/service also require Fable's coverage evaluation. No coverage baseline or
exemption file was edited. The missing local Effect symlink was handled by reading the parent
checkout's canonical reference; it was not installed or rewired. The reference checkout and
installed Effect snapshot differ on arbitrary derivation, so the explicitly required
`S.toArbitrary` was additionally verified against the installed snapshot source and exercised
on both runtimes.

No git write command, protected-path edit, manifest rewrite, package-task registration,
policy-plan change, or Stage B work was performed. The named files and this results section
are the handoff. Stop after Stage A.
