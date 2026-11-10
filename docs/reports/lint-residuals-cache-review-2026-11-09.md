# Cache review for the lint residuals wave

Reviewed against `c8fab679000e` (first wave) and `34818446d0c` (second wave,
after the `origin/main` merge) on branch `perf/lint-residuals` (the residuals
lane of the 2026-11-09 lint efficiency plan, following PR #3014). Reviewer:
Claude Opus 5.5 (perf/lint-residuals seal stage).

`bun run beep cache audit` reports three configuration-drift findings, all on
root (`//`) tasks, plus non-blocking `configuration-source-drift` on
`turbo.json`. Every drift comes from a `turbo.json` input change made in this
lane. Three further root tasks change cache posture and are recorded here although
the audit does not assess uncached tasks.

## `//` (root)

- `//#lint:effect-vitest`: adds `!{apps,packages,infra}/**/.*/**`. The task's
  inputs are pinned to `EffectVitestSourceFileGlobs`, and that list gains the
  same negation. The scanner walks with `dot: false`, so it never reads a dot
  directory. Measured: a test-shaped file planted under a gitignored
  `vitest-instrumentation/.runtime-x` directory was not scanned (3,738 files, no
  findings), while the same file in a non-dot sibling was scanned (3,739 files,
  two new findings). Before the change the dry-run hash moved when residue was
  planted (`ffc2cb6d…` to `e3b2d8c1…`); after it the hash stays `2a439296…` with
  residue planted or removed, and editing a real test file still re-keys it.
  The `standards/effect-vitest.inventory.jsonc` `scope` array carries the same
  line. The inputs only lose files the scanner never reads.
  The row also adds `{apps,packages,infra}/**/vitest*.config.{ts,mts,js,mjs}`
  (fix stage, from the new exported `EffectVitestConfigFileGlobs`, which the
  scanner now reads instead of a private constant). The browser-mode filter
  parses every such config, and a project with `browser: { enabled: true }`
  drops the EV006 rows of the files its `include` globs match.
  `packages/drivers/graph-3d` and `packages/ontology/client` have such projects
  over test files with 21 and 13 `expect(` calls, so a config edit changed the
  result without re-keying the task. The inputs only grow.
- `//#lint:effect-imports`: the code row now restates the scanner's exported
  `EffectImportsCodeGlobs` (apps, `apps/storybook/.storybook`, packages, infra,
  scripts, goals, explorations, scratchpad, tools, research, `.claude`,
  `.github`, root sources) and its exclusions (`.repos`, `node_modules`, `dist`,
  `build`, `vendor`, `coverage`, `storybook-static`, `.git`, `.beep`,
  `worktrees`, `packages/**/docs`, `.claude/worktrees`, `.next`, the residue
  family). The old row hashed only `{apps,packages,infra}`, so 631 tracked
  sources the scanner reads were unhashed (scratchpad 479, goals 138, `.claude`
  4, explorations 3, tools 1, root 6). A planted `scratchpad/` file with a root
  `effect` import failed the law without re-keying the task. After the change
  the row hashes 9,898 files and a Python emulation of the walk reproduced the
  scanner's 9,820 files with none missing from the inputs. This is a soundness
  fix: the inputs only grow (+631/-0).
- `//#lint:effect-imports-markdown`: the row now hashes `**/*.{md,mdx}` minus
  the Markdown walk's exclusions (the generated/vendor names, `.git`, `.beep`,
  `worktrees`, `**/docs/modules`, `docs/generated`, `docs/_internal`,
  `.claude/worktrees`, `.next`, the residue family). The old row hashed five
  documentation roots while the scanner reads every git-visible Markdown file
  (5,195), so a planted package `.md` failed the law without re-keying it. The
  emulation reproduced 5,195 files with none missing; inputs grow +4,479/-0.
  The fix stage then made the row `cache: false` with
  `env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"]` and moved it to
  `policyTrackedDiscoveryTasks`: the walk keeps only git-visible paths, and
  Turbo hashes a gitignored file that matches `**/*.{md,mdx}`. With an ignored
  `tmp/` probe carrying a root `effect` import, `git add -f` on a copy of the
  index (`GIT_INDEX_FILE`) left the dry-run hash at `4a3dd1d7…` while the scan
  went from no finding to one touched file, so a cache hit could replay a pass
  over a failing corpus. This removes reuse and grants nothing. Standalone cost
  is about 3.7-3.8 s wall warm and 6.3-7.1 CPU-s.
- `//#lint:schema-tag-idioms`, `//#lint:jsdoc-module-tags`: `cache: true`
  becomes `cache: false` with `env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"]`, the
  treatment #2826 gave the other tracked-discovery laws. Both list candidates
  with `git ls-files` and read working-tree bytes. With a copy of the index that
  stages one untracked `.patterns/` probe (`GIT_INDEX_FILE`), both dry-run hashes
  stayed identical while `jsdoc-module-tags` went from pass to fail and
  `schema-tag-idioms` from 10,778 to 10,779 scanned files, so a cache hit could
  replay a result for the wrong file set. Both move to
  `policyTrackedDiscoveryTasks`; this removes reuse and grants nothing.
- `@beep/repo-cli#lint:policy-fingerprint:lint-deprecated-apis` (generated by
  `bun run beep lint policy-fingerprint --write`): adds the new module
  `packages/tooling/tool/cli/src/commands/Lint/LintDeprecatedApis.schemas.ts`,
  which the deprecated-apis command now imports for its partition plan. The seal
  inputs only grow.

The `//#lint:deprecated-apis` command now runs `--full` as three sequential
oxlint partitions instead of one process; its Turbo row, command, outputs and
environment are unchanged, and the run re-proves that the partitions' file
inventories union to the single-run inventory.

## Second residuals wave (seal after the `origin/main` merge)

The lane merged `origin/main` at `fda98a2c4bd`; the merge took `main`'s
`standards/cache-qualification-baseline.json`, so this request re-records the
first wave above together with the change below. After the second wave,
`bun run beep cache audit` reports two configuration-drift findings,
`//#lint:effect-imports` (first wave, unchanged) and `//#lint:effect-vitest`,
plus the non-blocking `configuration-source-drift` on `turbo.json`.

- `//#lint:effect-vitest`: adds `!**/dist/**` to the row and to
  `EffectVitestSourceFileGlobs`, which the row is pinned to; the inventory
  `scope` array carries the same line. `tsc` emits `dist/test/*.d.ts`
  declarations that the `{apps,packages,infra}/**/test/**/*.ts` glob matched, so
  a checkout with built dists scanned and hashed generated files a fresh
  checkout lacks (47 such files in this checkout, all gitignored, none named by
  an inventory row). The exclusion is spelled `**/dist/**` because the shared
  `FsUtils` walk prunes a directory named by exactly that shape. Measured by the
  implementing track: the scanner read 3,744 files instead of 3,791 (exactly 47
  fewer) and the sorted 533-row finding list was byte-identical before and
  after. Before the change the dry-run hash differed between a checkout with a
  built `dist/test` and one without (`4ba26b46…` vs `7acf7bfe…`); after it the
  two agree, and editing a real test file still re-keys the task. At seal time
  the dry run hashes 3,959 inputs with none under `dist/`. Turbo applies the
  row's negations to its config globs too, so the browser-mode config walk now
  ignores the same `!` entries as the source walk (it ignored only
  `node_modules` before): a `dist` or dot-directory vitest config is neither
  hashed nor read, which a discovery fixture pins. The inputs only lose
  generated files the scanner no longer reads.
- `standards/effect-vitest.inventory.jsonc` is re-written by
  `bun run beep lint effect-vitest --write`: two stale exception rows whose
  findings moved into support files when test files were split (#3005, #3028)
  are removed, and about 20 rows have their `id`/`line` refreshed. It is a
  committed input of the same task, so this re-keys it once; no exception or
  reason is added.
- The knowledge doctor (`knowledge doctor ci`) now runs abreast of the medium
  graph in the Lint Policy plan instead of in a stage of its own, and its
  merge-base side extracts only the seal inputs. It is a plan step, not a Turbo
  task, so no Turbo row, input, output or environment changes.
- The `@beep/repo-cli` source edits (`Knowledge*.ts`, `Lint.schemas.ts`,
  `EffectVitestScan.ts`, `Quality/Tasks.ts`) stay inside existing seal input sets:
  `bun run beep lint policy-fingerprint --write` produced no change to
  `standards/policy-tools.fingerprint.json` or to the generated seal rows.

## Scope

This review adds no qualification and no exception rows. It changes no cache
writer credentials, artifact outputs or trust policy. Scope
(`@beep/identity#lint`, `@beep/types#lint`), profile `local-linux-x64-bun1.4.4`
and epoch `qualification-v3` are copied unchanged from
`standards/cache-qualification-baseline.json`. Reviews of other subjects carry
forward.
