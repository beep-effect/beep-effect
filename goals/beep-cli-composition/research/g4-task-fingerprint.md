# G4: per-task lint policy fingerprint

Gate fix G4 (D3, D12). Measured on 2026-10-31 against `main` at
`921b92fcd8`; the replay data is
[`g4-task-fingerprint-replay.json`](g4-task-fingerprint-replay.json), produced by
[`ops/g4-fingerprint-replay.ts`](../ops/g4-fingerprint-replay.ts).

## Result

| Measure | Before (v1, whole closure) | After (v2, per task) |
| --- | --- | --- |
| Commits that invalidate a policy task's fingerprint, last 400 first-parent | 243 for every task | 109 to 166, by task |
| Same, the 181-package lint tasks (`lint:laws`, `lint:jsdoc`, `lint:deprecated-apis`) | 243 | 115, 111, 126 |
| Task-instance invalidations (47 tasks, 600 instances) | 145,200 | 71,391 (−51%) |
| Same, excluding the 57 commits that touch a Turbo global input | 111,000 | 37,191 (−67%) |
| Cached tasks only | 140,602 | 68,433 (−51%) |
| Stale-green replays (a commit touches a task's true closure but not its inputs) | not measured | **0** across 47 tasks × 400 commits |
| Oracle closure modules missing from the declared inputs | — | **0** |

The 57 global-input commits (root `package.json`, `tsconfig*.json`,
`.bun-version`, `.nvmrc`) invalidate every Turbo task anyway, so the
non-global row is the saving the fingerprint itself controls.

## Design

`beep lint policy-fingerprint --write` stays the single owner. It reads
`turbo.json`, the root manifest and every workspace manifest, and:

1. Finds every task whose `dependsOn` names `//#lint:policy-fingerprint` (the
   authoring marker) or a generated seal.
2. Maps the task's script to `beep` argv: `beep-cli <argv>`, `bun run beep
   <argv>`, or `bun run <root script>` followed recursively. Shell operators,
   non-`beep` scripts and `bin-main.ts` fast paths (`ci`, the quality tasks)
   fail the computation instead of being guessed.
3. Walks the command tree statically from `commands/Root.ts`:
   `Command.make("<literal>")` and `Command.withSubcommands([...])`, through
   named imports, re-exports and barrels.
4. Reads the runtime import graph with the TypeScript parser: type-only
   edges are skipped, literal `import()` is an edge, workspace specifiers
   resolve through each package's `exports` (and `imports`) map.
5. Emits one seal task per command-path prefix,
   `//#lint:policy-fingerprint:<key>`, chained by `dependsOn`
   (`quality` → `quality-fallow` → `shared`). Each seal holds only what its
   command adds over its ancestors, so a group module's imports are declared
   once. A prefix that adds nothing hands its tasks to its parent.
6. Rewrites each policy task's fingerprint edge to its seal, writes a
   `lint:policy-fingerprint:<key>` script (`true`) per seal (Turbo hashes a root
   task only when it has a script), and records everything in
   `standards/policy-tools.fingerprint.json` (`policy-tools-fingerprint/v2`).

`//#lint:policy-fingerprint` remains the drift check (still a cheap policy
task). Nothing depends on it, so its inputs can be whole workspaces: every
workspace a seal reaches (`src/**`, manifest), the policy task manifests and
`turbo.json`. Any edit that can change a closure (an import, an export map, a
policy script) reruns it, and it fails until `--write` regenerates the seals.

Inputs are listed file by file (plus one `src/**/*.<ext>` glob per
non-TypeScript asset extension under a reached `src`, because assets are
read at runtime rather than imported). Directory globs were tried and
rejected: adding an unrelated file to a fully covered directory would then
change the generated inputs and fail the check.

### Cut policy (the one modelling assumption)

The shell (`bin.ts`, `bin-main.ts` and what they load) never enters
`src/commands`; dispatch edges into it are declarations in a shell entry or
literal `import()` (a lazy dispatch manifest). A static import of a command
module from any other shell module fails the computation. On the argv path,
each command's module contributes its imports except those whose bindings are
only that command's subcommands: siblings are registered, not run.

Today `commands/Root.ts` loads every group eagerly, so sibling command
modules are evaluated at startup. The fingerprint treats module evaluation of
non-path command modules as declarative (no observable top-level effects on
other commands); G3's lazy dispatch makes that literal. A non-literal dynamic
import in a reached module widens that workspace to `src/**`.

### Code changes that make closures narrow

- `Lint.command.ts` is now composition only. Every inline lint subcommand
  moved to its own module (`LintLaws`, `LintJsdoc`, `LintDeprecatedApis`,
  `LintCircular`, `LintPolicy`, `LintGoalPackets`, `ToolingSchemaFirst`,
  `PackageScripts`, `PolicyFingerprint`); shared flags live in
  `Lint/internal/LintPackage.ts`. Before the split every lint leaf reached
  920 modules; `lint laws` now reaches 386 including the shell.
- `lint deprecated-apis` imports `Quality/Tasks.ts` directly instead of the
  `Quality` barrel (its seal fell from 414 to 149 inputs).
- `lint judge-rubric` and `quality` import their `Qa` and `Cache` helpers
  from the defining modules instead of the group barrels.

## Seals

`shared`: 395 inputs (the shell's 360 modules and their manifests, the root
command module, root checker configuration, the root manifest and the
declaration). Drift check: 243 inputs.

| Seal | Parent | Inputs | Command prefix |
| --- | --- | --- | --- |
| `goals` | `shared` | 3 | goals |
| `goals-doctor` | `goals` | 322 | goals doctor |
| `goals-index` | `goals` | 293 | goals index |
| `knowledge` | `shared` | 426 | knowledge |
| `laws` | `shared` | 123 | laws |
| `lint` | `shared` | 3 | lint |
| `lint-circular` | `lint` | 5 | lint circular |
| `lint-deprecated-apis` | `lint` | 149 | lint deprecated-apis |
| `lint-ecosystem-polarity` | `lint` | 8 | lint ecosystem-polarity |
| `lint-effect-vitest` | `lint` | 19 | lint effect-vitest |
| `lint-identity-registry` | `lint` | 12 | lint identity-registry |
| `lint-jsdoc` | `lint` | 3 | lint jsdoc |
| `lint-judge-rubric` | `lint` | 34 | lint judge-rubric |
| `lint-laws` | `lint` | 23 | lint laws |
| `lint-opaque-roundtrips` | `lint` | 3 | lint opaque-roundtrips |
| `lint-package-scripts` | `lint` | 5 | lint package-scripts |
| `lint-package-test-typecheck` | `lint` | 21 | lint package-test-typecheck |
| `lint-reflection-artifacts` | `lint` | 37 | lint reflection-artifacts |
| `lint-roadmap-refs` | `lint` | 312 | lint roadmap-refs |
| `lint-schema-first` | `lint` | 29 | lint schema-first |
| `lint-tsconfig-overlay` | `lint` | 16 | lint tsconfig-overlay |
| `quality` | `shared` | 402 | quality |
| `quality-bun-audit` | `quality` | 8 | quality bun-audit |
| `quality-changeset-graph` | `quality` | 8 | quality changeset-graph |
| `quality-changeset-status` | `quality` | 1 | quality changeset-status |
| `quality-fallow` | `quality` | 4 | quality fallow |
| `quality-jsdoc-inventory` | `quality` | 8 | quality jsdoc-inventory |
| `quality-jsdoc-module-tags` | `quality` | 8 | quality jsdoc-module-tags |
| `quality-jsdoc-ratchet` | `quality` | 8 | quality jsdoc-ratchet |
| `quality-tsgo-rules` | `quality` | 8 | quality tsgo-rules |
| `topo-sort` | `shared` | 2 | topo-sort |
| `tsconfig-sync` | `shared` | 20 | tsconfig-sync |
| `version-sync` | `shared` | 92 | version-sync |

## Per task

`today` and `perTask` count fingerprint invalidations over the last 400
first-parent commits; the `non-global` columns exclude the 57 commits that
touch a Turbo global input. `oracle` is the size of the task's true closure.

| Task | Seal | Instances | Cached | Oracle | Today | Per task | Today, non-global | Per task, non-global | Stale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `//#changeset:status` | `quality-changeset-status` | 1 | no | 746 | 242 | 163 | 185 | 106 | 0 |
| `//#config-sync:check` | `tsconfig-sync` | 1 | yes | 380 | 242 | 109 | 185 | 52 | 0 |
| `//#fallow:audit:check` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:boundaries:advisory` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:boundaries:config-check` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:dead-code:check` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:fix-preview:advisory` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:flags:advisory` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:health:advisory` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:health:check` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#fallow:security:advisory` | `quality-fallow` | 1 | no | 749 | 242 | 164 | 185 | 107 | 0 |
| `//#goals:doctor` | `goals-doctor` | 1 | no | 670 | 242 | 151 | 185 | 94 | 0 |
| `//#goals:index-check` | `goals-index` | 1 | yes | 642 | 242 | 143 | 185 | 86 | 0 |
| `//#jsdoc:inventory:check` | `quality-jsdoc-inventory` | 1 | yes | 753 | 242 | 166 | 185 | 109 | 0 |
| `//#jsdoc:ratchet:check` | `quality-jsdoc-ratchet` | 1 | yes | 753 | 242 | 166 | 185 | 109 | 0 |
| `//#knowledge:refs-check` | `knowledge` | 1 | no | 767 | 242 | 162 | 185 | 105 | 0 |
| `//#knowledge:semantic-delta` | `knowledge` | 1 | no | 767 | 242 | 162 | 185 | 105 | 0 |
| `//#lint:allowlist` | `laws` | 1 | yes | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:circular` | `lint-circular` | 1 | yes | 369 | 242 | 111 | 185 | 54 | 0 |
| `//#lint:ecosystem-polarity` | `lint-ecosystem-polarity` | 1 | yes | 371 | 242 | 111 | 185 | 54 | 0 |
| `//#lint:effect-imports` | `laws` | 1 | yes | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:effect-imports-markdown` | `laws` | 1 | yes | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:effect-vitest` | `lint-effect-vitest` | 1 | yes | 383 | 242 | 126 | 185 | 69 | 0 |
| `//#lint:identity-registry` | `lint-identity-registry` | 1 | yes | 376 | 242 | 112 | 185 | 55 | 0 |
| `//#lint:jsdoc-module-tags` | `quality-jsdoc-module-tags` | 1 | no | 753 | 242 | 166 | 185 | 109 | 0 |
| `//#lint:jsdoc:root` | `lint-jsdoc` | 1 | yes | 367 | 242 | 111 | 185 | 54 | 0 |
| `//#lint:judge-rubric` | `lint-judge-rubric` | 1 | yes | 395 | 242 | 111 | 185 | 54 | 0 |
| `//#lint:markdown-fences` | `laws` | 1 | no | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:native-runtime:roots` | `laws` | 1 | yes | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:opaque-roundtrips` | `lint-opaque-roundtrips` | 1 | yes | 367 | 242 | 111 | 185 | 54 | 0 |
| `//#lint:package-scripts` | `lint-package-scripts` | 1 | yes | 369 | 242 | 111 | 185 | 54 | 0 |
| `//#lint:package-test-typecheck` | `lint-package-test-typecheck` | 1 | yes | 383 | 242 | 112 | 185 | 55 | 0 |
| `//#lint:reflection-artifacts` | `lint-reflection-artifacts` | 1 | yes | 399 | 242 | 122 | 185 | 65 | 0 |
| `//#lint:retired-effect-paths` | `laws` | 1 | no | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:retired-iri-authorities` | `laws` | 1 | no | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:roadmap-refs` | `lint-roadmap-refs` | 1 | yes | 660 | 242 | 147 | 185 | 90 | 0 |
| `//#lint:schema-first` | `lint-schema-first` | 1 | yes | 393 | 242 | 113 | 185 | 56 | 0 |
| `//#lint:schema-tag-idioms` | `laws` | 1 | no | 476 | 242 | 128 | 185 | 71 | 0 |
| `//#lint:tsconfig-overlay` | `lint-tsconfig-overlay` | 1 | yes | 378 | 242 | 112 | 185 | 55 | 0 |
| `//#lint:tsgo-rules` | `quality-tsgo-rules` | 1 | yes | 753 | 242 | 166 | 185 | 109 | 0 |
| `//#repo-sanity:bun-audit` | `quality-bun-audit` | 1 | no | 753 | 242 | 166 | 185 | 109 | 0 |
| `//#repo-sanity:changeset-graph` | `quality-changeset-graph` | 1 | yes | 753 | 242 | 166 | 185 | 109 | 0 |
| `//#repo-sanity:versions` | `version-sync` | 1 | yes | 451 | 242 | 117 | 185 | 60 | 0 |
| `//#topo-sort` | `topo-sort` | 1 | yes | 363 | 242 | 109 | 185 | 52 | 0 |
| `lint:deprecated-apis` | `lint-deprecated-apis` | 187 | yes | 502 | 242 | 126 | 185 | 69 | 0 |
| `lint:jsdoc` | `lint-jsdoc` | 182 | yes | 367 | 242 | 111 | 185 | 54 | 0 |
| `lint:laws` | `lint-laws` | 187 | yes | 386 | 242 | 115 | 185 | 58 | 0 |

## Soundness method

The replay builds each task's true closure with an oracle that shares no
parser or resolver with the generator: Bun's `Transpiler.scanImports`
(type-only imports erased by Bun) and `Bun.resolveSync`, with workspace
symlinks resolved to their sources. It applies the same cut policy, walks the
same argv path, and checks two things for every policy task:

1. Fidelity: every module in the oracle closure matches the task's declared
   seal chain (0 gaps).
2. Replay: for each of the last 400 first-parent `main` commits, a commit that
   touches any file in the oracle closure also touches the declared inputs
   (0 stale-green replays).

Both measures use the closure structure at the measured head, as the design
record's simulation did. Historical commits are replayed against today's
module graph; a commit that changed an import edge would, under v2, also have
regenerated the seals in the same PR (the drift check fails otherwise).

Reproduce from the repository root:

```sh
bun goals/beep-cli-composition/ops/g4-fingerprint-replay.ts --commits 400 --today 2c1ff256c1
```

`--today` names the last commit with the v1 declaration.

## What is left

- The shared seal is the floor (109 of 400): the shell reaches 360 modules
  through `@beep/schema`, `@beep/utils`, `@beep/repo-utils` and
  `internal/repo-run`. G3's lazy dispatch and W1's barrel work shrink it.
- Group modules with inline subcommands (`Quality.command.ts`,
  `Knowledge.command.ts`, `Goals`) still give every leaf the whole group's
  imports (about 400 inputs each). Moving those leaves into their own modules,
  as done here for Lint, is W1 hygiene.
- External dependency versions (`bun.lock`) are not fingerprint inputs, as
  in v1; the root manifest is.
