# Turbo cache input boundaries

This audit covers the root task graph and every workspace `turbo.json` at
Turbo 2.10.13. The proof-epoch fixture is test data, not workspace configuration.

## Rules used in the audit

Turbo's default inputs honor Git ignores. Explicit positive globs can also
include ignored files, even when `$TURBO_DEFAULT$` appears in the same array.
For example, `**/package.json` can include installed dependency manifests and
Next build manifests. Adding `$TURBO_DEFAULT$` does not restrict that glob to
Git-visible files.

Three ignored trees are the largest such leaks, so every task whose globs reach
them excludes them (quality audit M8, 2026-11-02):

- `!.claude/worktrees/**` (`!$TURBO_ROOT$/.claude/worktrees/**` in a package
  overlay) on every task whose inputs glob from the repository root: a root
  `//#` task's `**`-prefixed glob, or any `$TURBO_ROOT$/**` glob. Each nested
  lane is a full checkout; with twelve lanes `//#lint:retired-iri-authorities`
  hashed 624,191 inputs in 3.5-5.1 s per dry run, against 60,645 inputs in
  0.4 s after the fix. The scanners all list files through `git ls-files`, so
  the lanes were never read. The "Root-reaching task inputs" test in
  `packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts` fails when a
  tracked `turbo.json` adds such a glob without the exclusion.
- `!**/node_modules/**` on the Fallow and typos rows. Fallow may read
  installed manifests while it resolves dependencies, so its rows hash
  `bun.lock`, which fixes the installed tree, instead of the tree itself.
  Typos honors the Git ignore and never reads them.
- `!**/src-tauri/target/**` on `coverage`, `package-test-typecheck`, the
  `**/*` law scans and the Fallow rows. The desktop tests read `src-tauri`
  configuration and source, never Cargo build artifacts.

Match each task's inputs to its consumer. A directory named `build` inside
source is still an input when the command scans it. Authored documentation and
tracked generated source must remain inputs when consumed. Apply exclusions to
the relevant task, rather than globally hiding outputs from tasks that read them.

Package prose and test sources stay out of the roles that cannot read them
(quality audit K3 and M10, 2026-11-02). `transit`, `build`, `check`, `test`
and `test:property` keep `$TURBO_DEFAULT$` and subtract the package-root
`README.md`, `CHANGELOG.md` and `LICENSE`; `build` and `transit` also subtract
`test/**`. No build, typecheck or test reads those files: tests that touch a
README write a fixture copy, imported Markdown lives under `src/`, and the
README generator (`effect-drizzle`'s `readme` script) writes the README rather
than reading it. Before this, one README edit in `@beep/utils` replayed every
dependent's `test` through `^transit` and `@beep/utils#transit`, and a test
edit replayed every dependent's `check` through `^build`. Everything else in
the default set stays keyed, including runtime files outside `src` (`data/`,
`assets/`, `configs/`, `schema.json`, `docker/`) and Markdown nested under
`src/`; the exclusions are package-relative, so a `$TURBO_ROOT$` glob into
another package keeps that package's prose. An overlay cannot re-include what
the root excludes: Turbo applies every negation after every inclusion, so an
override that needs `test/**` restates the root list without `!test/**` (see
Workspace overrides). `packages/tooling/tool/cli/test/package-role-turbo-inputs.test.ts`
pins the boundary with a native fixture: prose and test edits replay nothing
downstream, while `src`, `data/` and nested `src` Markdown edits still do.

Bun loads package-local `.env` and `.env.*` files. Only the tasks whose
command consumes them hash them: `test`, `test:property`, `doctest`,
`lint:jsdoc`, `lint:deprecated-apis`, and the `build` overrides of the Vite and
Next apps. `lint`, `check` and `build` dropped `.env`/`.env.*` on 2026-11-02
(quality audit R8): Biome and tsrs read no dotenv file, and the `.env` globs are
package-relative, so the only invalidation they bought was a package-local
dotenv edit. Transit nodes keep the default Git-visible package inputs minus
package prose and `test/**`.

The Vitest instrumentation runtime tests create temporary `.runtime-*`
directories inside their fixture tree. The root Git ignore excludes only those
temporary directories, so interrupted tests cannot feed generated TypeScript
and traces back into default test and transit inputs. Authored fixtures remain
inputs. A native Turbo 2.10.13 probe verified both producer and downstream test
hashes before, during and after an equivalent artifact was created.

`outputs` specifies files to restore. Validation tasks can cache successful
results and logs without file outputs. An aggregate that invokes integration
checks or mutates source cannot safely skip those operations merely because its
subcommands have separate uncached Turbo definitions.

Use `dependsOn` to include implementation dependencies. Shared Vitest aliases
are real inputs, and docgen must include the generator's source dependency graph.
Package override arrays replace the parent array unless they use
`$TURBO_EXTENDS$`.

These rules were checked against the official
[configuration documentation](https://github.com/vercel/turborepo/blob/v2.10.13/apps/docs/content/docs/reference/configuration.mdx),
[caching documentation](https://github.com/vercel/turborepo/blob/v2.10.13/apps/docs/content/docs/crafting-your-repository/caching.mdx),
and [SCM input implementation](https://github.com/vercel/turborepo/blob/v2.10.13/crates/turborepo-scm/src/package_deps.rs).
Grok documentation research and independent Codex source audits were reconciled
against the installed binary's native hash probes. Suggestions that did not
match the actual task implementation were discarded.

## Package task review

| Task | Cache boundary |
| --- | --- |
| `doctest` | Source, tests, shared Vitest files and the utils dependency graph; no file outputs required. Every nested `node_modules` is excluded (`!**/node_modules/**`): fixture packages under `test/fixtures/*` carry Vitest result caches in `node_modules/.vite/vitest/**` that each run rewrites, which made `@beep/repo-cli#doctest` miss on every rerun (audit G4, 2026-11-02). |
| `lint:deprecated-apis` | Explicit source globs must follow the dedicated type-aware Oxlint profile's output exclusions; policy fingerprint and transit carry implementation dependencies. |
| `lint:jsdoc` | Explicit source globs exclude artifacts ignored by the JSDoc scanner; policy fingerprint carries implementation changes. |
| `lint:laws` | Law inputs retain authored source and policy files; generated declarations and reports are excluded when the scanner excludes them. |
| `build` | Defaults retain package source and configuration; the workspace tsgo wrapper is an explicit input. Package prose and `test/**` are excluded, except in the builds whose compiler program includes `test` (overrides below). Declared outputs restore build products. No dotenv inputs: `tsrs` reads none, and the Vite/Next apps declare `.env*` in their overrides (below). |
| `@beep/api-docs#build` | TypeScript validation emits no files; `outputs: []` is intentional. |
| `lint` | Defaults plus shared Biome/rule configuration; Storybook also scans sibling stories. No dotenv inputs. |
| `lint:fix` | Uncached mutation. |
| `check` | Package inputs (tests included), the workspace tsgo wrapper and upstream builds; existing app-specific external inputs retained. Package prose excluded. No dotenv inputs. |
| `test` | Defaults minus package prose, shared Vitest files and aliases, package dependency transit and shared utils transit; fast-check seed/count are hashed. |
| `test:property` | Same test boundary with explicit fast-check settings. |
| `package-test-typecheck` | Uncached diagnostics/receipt task; outputs declare the package result receipt. |
| `test:integration` | Uncached external-state checks; shared aliases remain selection inputs. |
| `test:integration:parallel` | Same external-state boundary. |
| `test:integration:serial` | Same external-state boundary with its lane-specific environment. |
| `coverage` | Uncached coverage/ratchet computation; coverage files are declared outputs. |
| `codegen` | Uncached source generation. |
| `audit` | Uncached aggregate: implementations include integration checks and source generators. |
| `transit` | Defaults honor Git ignores and propagate dependency source and runtime-file changes; package prose and `test/**` are excluded, so a dependency's test or README edit replays no dependent. |
| `docgen` | Package transit plus `@beep/repo-docgen#transit`; generated docs/proof files remain outputs. |
| `dev` | Persistent and uncached; upstream builds run first. |
| `storybook` | Persistent and uncached. |
| `storybook:build` | Static outputs plus sibling stories, styles, assets and sources. |
| `storybook:start` | Persistent, uncached preview after static build. |
| `test:storybook` | Uncached browser checks. |

## Root task review

The policy fingerprint is generated by
`bun run beep lint policy-fingerprint --write`. Each policy task depends on one
generated seal task, `@beep/repo-cli#lint:policy-fingerprint:<key>`, whose
inputs are the modules its `beep` command reaches beyond its parent seals plus
the root files those modules read; the seals chain to
`@beep/repo-cli#lint:policy-fingerprint:shared` (the CLI shell, the root
manifest and the root TypeScript configuration). `//#lint:policy-fingerprint`
is the drift check: nothing depends on it, and it fails until `--write` follows
an import edit. A new policy task declares
`dependsOn: ["//#lint:policy-fingerprint"]`; `--write` rewrites that edge to its
seal.

Two refinements from quality audit M9 (2026-11-02):

- The seals are script-less tasks of the CLI workspace, like `transit`, not root
  tasks with a `true` script. Turbo hashes the root `turbo.json` into every root
  task, and `!turbo.json` cannot remove it, so a root seal replayed all 188
  `lint:laws`, 183 `lint:jsdoc` and the `lint:deprecated-apis` tasks on any
  `turbo.json` edit: 29 commits on `main` in the two weeks to 2026-11-02 touched
  `turbo.json` and no global input. A CLI task hashes the CLI manifest and
  overlay instead, and the manifest is a shared input already.
- Root checker configuration is no longer a blanket shared input. Each family
  (Oxlint configs with the `tsdoc.json` their plugins read, `biome.jsonc`,
  `_typos.toml`, the Fallow config and plugin, the lint-policy sweeps, the
  fingerprint declaration, `turbo.json`) goes to the seals whose closure holds
  a code-level string literal naming a family file, or naming the tool that
  discovers it (`oxlint`, `biome`, `typos`, `fallow`). Comments and help text
  never count. The CLI shell's dispatch manifest names the `fallow` group, so
  the Fallow family stays shared; `lint:laws` and `lint:jsdoc` now replay only
  for the Oxlint family among checker configs. The routes live in
  `packages/tooling/tool/cli/src/commands/Lint/internal/PolicyRootFiles.ts`;
  `policy-fingerprint-turbo-inputs.test.ts` re-derives every live chain's reads
  from its declared modules and fails on a missing file. Design and soundness replay:
`goals/beep-cli-composition/research/g4-task-fingerprint.md`. Root task inputs must match the command's scan scope; the root JSDoc
scanner reads `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}` and `infra/**/*.ts`,
excluding `apps/labs`, `.context` directories and dynamically discovered workspace
directories. The static Turbo inputs retain those three source roots and the
source-only lab/context exclusions. Scripts, tools and scratchpad sources do not
invalidate this task. Package manifests remain inputs, including lab manifests,
because they affect workspace discovery.

The static source globs conservatively include sources inside workspaces: Turbo
cannot express the scanner's dynamically discovered directory exclusions. A
workspace source edit can therefore invalidate the root task even when that
workspace is handled by package JSDoc. Excluding all apps or packages would hide
real standalone sources; narrowing this remaining overapproximation requires a
maintained representation of the scanner's workspace discovery.

| Tasks | Audit decision |
| --- | --- |
| `lint:policy-fingerprint` | Drift check over every workspace a seal reaches, the declaration and every routed root file; the generated `@beep/repo-cli#lint:policy-fingerprint:<key>` seals carry each command's precise closure. |
| `lint:jsdoc:root` | Include the source trees its scanner reads; exclude artifacts according to that scanner. |
| `lint:native-runtime:roots`, `lint:schema-first`, `lint:identity-registry`, `lint:effect-imports`, `lint:tsgo-rules`, `lint:allowlist` | Match source and configuration inputs to the corresponding scanner; preserve authored nested source. |
| `lint:package-scripts`, `config-sync:check`, `repo-sanity:changeset-graph`, `repo-sanity:syncpack`, `repo-sanity:sherif`, `repo-sanity:versions`, `topo-sort` | Workspace metadata inputs must not expand into installed dependency or generated build manifests. |
| `lint:roadmap-refs` | Read the roadmap and goal/exploration targets; retain arbitrary referenced target existence. Other repository trees are irrelevant. |
| `lint:judge-rubric` | Precise rubric input and policy implementation dependency retained. |
| `lint:circular`, `lint:ecosystem-polarity`, `lint:reflection-artifacts` | Keep precise source/reflection globs; do not exclude legitimate nested source by directory name. |
| `lint:effect-imports-markdown` | Retain authored Markdown consumed by the scanner, including internal docs it actually reads. |
| `lint:markdown-fences`, `lint:retired-effect-paths`, `lint:entity-kit-freeze`, `lint:retired-iri-authorities`, `lint:schema-tag-idioms` | Cached since 2026-11-02 (audit G10; `lint:entity-kit-freeze` since 2026-11-06, which also reads its committed baseline `standards/entity-kit-freeze.baseline.jsonc`). Each lists tracked files with `git ls-files`, reads their working-tree bytes, and reads nothing else: no clock, no network, no `.beep` state. `lint:markdown-fences` also spawns the repository's `tsrs` against the root `tsconfig.json`; its inputs already cover every TypeScript source and tsconfig, and the compiler's identity rides on the root dependency hash. The git listing is the one place the scanner and the hash diverge (a file staged without a byte change is not re-hashed), which `lint:effect-imports` and `lint:opaque-roundtrips` already accept. |
| `goals:index-check` | Retain goal inputs and implementation dependency. |
| `knowledge:semantic-delta`, `knowledge:refs-check`, `goals:doctor`, `changeset:status` | Remain uncached; Git state and reference/packet checks are not qualified for result replay. `goals:doctor` in particular runs `git log --since=<days>` and `git log -n 4000`: its staleness and completion-gate advisories depend on the clock and on git history, neither of which is a Turbo input (audit G10 verdict, 2026-11-02). |
| `lint:deprecated-imports` | One root Biome pass for the project-domain `noDeprecatedImports` rule (off in the per-package `lint` task so `biome check .` stops scanning the whole repo per package). Inputs: every source file under apps/packages/infra, their manifests, `biome.jsonc` and `bun.lock` (deprecations come from dependency declarations). |
| `lint:oxlint`, `lint:shadcn`, `lint:typos` | Remain uncached; preserve each scanner/report contract. `lint:shadcn` also reads the theme stylesheets, `components.json`, tsconfig paths, and package exports. |
| `lint:jsdoc-module-tags` | Cached since 2026-11-02 (audit G10): it lists tracked files with `git ls-files`, keeps `.patterns`, `apps`, `packages` and `tooling` sources by extension, and greps each for `@module`. The inputs mirror that scan and exclude generated artifact trees. |
| `lint:holds` | Cached since 2026-11-02 (audit G10). The check path reads the ledger (`hold-ledger/**`), the root manifest, `osv-scanner.toml`, `syncpack.config.ts` and the workspace manifests the ledger anchors name; the clock is read only by `holds update` and the probe writer, and installed `node_modules` manifests only by the probe. |
| `jsdoc:inventory:check` | Cached since 2026-10-06: the inventory is a pure function of workspace manifests, `docgen.json`, `tsdoc.json` and the TypeScript sources of every workspace, so the inputs cover `{packages,apps,infra}` plus the `scratchpad` (srcDir `.`, minus its docgen excludes; `.ts` and `.tsx`) and `tools` workspaces; artifact directories are excluded. The scan counts tracked and untracked-but-not-ignored files (`git ls-files --cached --others --exclude-standard`), the same set Turbo hashes, so `git add` of an unchanged file cannot reuse an inventory that never counted it. Fixture trees stay inputs: they are not gitignored, so a fixture file under a source root is scanned. The excluded directory names are the ones `listSourceFiles` skips (`node_modules`, `.turbo`, `dist`, `build`) plus gitignored artifact trees. The declared `.beep/ci/jsdoc-documentation.inventory.*` outputs restore on a hit; that restore is how the cheap-gates ratchet hands its inventory to the pre-push `quality:jsdoc-ratchet` lane, keyed by content hash rather than a file path. It was the single largest cost of a warm `bun run lint` (about 250 s) and of cheap-gates (`quality:jsdoc-ratchet:regenerated`, p50 344 s, until perf audit M7). |
| `jsdoc:ratchet:check` | Depends on `jsdoc:inventory:check` and the fingerprint; inputs are the committed totals baseline and every `{packages,apps}/**/src/**` TypeScript file, fixture trees included, because the zero-legacy gate reads every tracked or untracked-but-not-ignored `src` file (`isPackageSourceFile`) with no directory filter; only `node_modules` is excluded, so the glob walk stays out of installed trees. The cheap-gates `quality:jsdoc-ratchet:regenerated` lane runs this task. Turbo skips it when the inventory task is red. |
| `lint:tsconfig-overlay` | Every `tsconfig*.json` under `apps`, `infra` and `packages` (overlays, owners and build configs), artifact directories excluded. |
| `lint:package-test-typecheck` | Workspace manifests, `tsconfig*.json`, test sources under `test/` and the committed blind-spot baseline. |
| `lint:schema-catalog` | The schema-first source globs (`SchemaFirstIncludedGlobs`, `docs` trees excluded), every workspace manifest the owner resolver reads, the root `tsconfig.json`, and the committed per-package shards under `standards/schema-catalog/` plus the retired single-file catalog path. Added 2026-11-02 so the cheap-gates lane restores from cache instead of re-walking the tree (~25 s). The hosted Repo Sanity lane still calls the CLI directly. |
| `lint:effect-vitest` | Exactly the scanner's D9 globs (`EffectVitestSourceFileGlobs`: `*.test`/`*.spec` files and `test/**/*.ts` under `apps`, `packages`, `infra`, fixtures included, `node_modules` excluded) plus the committed inventory and primitives graph the pin checks read; a tripwire pins the inputs to those constants. Check mode writes nothing. |
| `fallow:health:check`, `fallow:health:advisory`, `fallow:boundaries:advisory`, `fallow:flags:advisory`, `fallow:security:advisory`, `fallow:fix-preview:advisory`, `fallow:dead-code:check`, `fallow:boundaries:config-check` | Cached since 2026-11-02 (quality audit K2). The nine Fallow rows share one input set: every code file Fallow can discover (`**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,html,css}`), manifests, tsconfigs, `.gitignore` files, the root tool configuration its plugins read (`*.{json,jsonc,yml,yaml,toml}`, `.*.{json,jsonc,toml}`, `.changeset/config.json`), `standards/fallow.*.jsonc` (both regression baselines and the generated boundaries config), `bun.lock`, and the source trees, minus Git-ignored build output. The outputs restore the envelope and the raw report it cites, `BEEP_PROOF_BASE` stays in the key, and a tool failure exits non-zero even in advisory mode, so Turbo never caches one. `packages/tooling/tool/cli/test/fallow-turbo-cache.test.ts` replays two runs against a fixture built from these rows and checks the live repository: every file `fallow list --files` reports must be a hashed input. |
| `fallow:audit:check` | Remains uncached: it diffs against the commit behind `BEEP_PROOF_BASE`, a ref name such as `origin/main` that can move while the key stays the same. |
| `repo-sanity:bun-audit` | Remains uncached because vulnerability data can change independently of source. |

Root tasks also hash root workspace dependencies through Turbo's internal
dependency hash. A task's displayed `inputs` map alone does not explain every
possible invalidation.

## Local full-scope lint plan (2026-10-06)

A warm `bun run lint` on a clean tree spent about 6 minutes, of which 4m20s was
the `lint:policy:medium` phase waiting on three uncached root tasks
(`jsdoc:inventory:check` 251 s, `knowledge:semantic-delta` 101 s,
`knowledge:refs-check` 25 s) while its 156 other tasks replayed from cache in
zero seconds. Three decisions follow:

- `jsdoc:inventory:check` is cached (row above).
- The two git-delta knowledge checks compare the merge-base archive with HEAD.
  They stay uncached, and a local full-scope plan (no review base, no PR) no
  longer runs them: hosted full-scope plans and the changed-scope `lint:policy`
  run, which carries an explicit base, still do. Run them by hand with
  `bun run beep knowledge semantic-delta` and `bun run beep knowledge refs --check`.
- The overlay, test-typecheck, effect-vitest and JSDoc ratchet checks moved from
  repo-cli subprocess steps into cached root Turbo tasks inside the medium and
  state phases. `quality:test-tsgo` stays a repo-cli step because its Turbo task
  (`package-test-typecheck`) is uncached by tripwire ruling, and since 2026-11-02 the
  lint-policy plan is its only owner: root `bun run check` no longer runs it a second
  time. The root documentation
  program (`lint:jsdoc`) runs oxlint with `.oxlintrc.docs.json` and no persistent result cache.
  Turbo owns package and non-workspace documentation caching: inputs include the docs config,
  `tsdoc.json` and `@beep/lint-rules` source. The documentation input digest includes the
  dependency lock and plugin manifest. Deprecated-API shards use the dedicated oxlint
  configuration; no ESLint profile environment or result cache remains.

## Changed-scope Lint Policy (2026-11-02)

Pull requests run `Heavy / Lint Policy` changed-scope (quality audit K1):
`heavy.yml` passes `--affected --base origin/<base>` to `ci lane lint-policy`,
which runs `beep lint policy --affected`. Pushes to `main` and scheduled runs get
no affected shape and run `--full`. Yeet's pre-push `quality:lint-policy` lane
replays the pull-request shape. `beep lint policy` with no flags is the same
changed scope against `origin/main`.

A changed-scope run first decides whether to widen to the full sweep
(`commands/Quality/internal/LintPolicyScope.ts`). It widens when the change set
touches any of these:

- a deleted or renamed path;
- a changed source file whose head content carries `@deprecated` (only an added
  tag can create findings in unchanged callers, so the head side is enough);
- a `tsconfig*.json`/`jsconfig*.json`, `bun.lock`, any `package.json`,
  `.bun-version`, `.nvmrc`, `bunfig.toml` or `patches/`;
- a `turbo.json`;
- a root `.oxlintrc*` or Biome profile, `_typos.toml`, `tsdoc.json`,
  `standards/lint-policy.sweeps.jsonc` or the policy fingerprint;
- a file in the policy fingerprint seals, `packages/tooling/policy-pack/`, or
  the repo-cli `commands/Lint/` tree.

The log line names every escalation:
`lint:policy: scope=full (escalated: <class> <path>; …)`.

Otherwise Turbo's `affectedUsingTaskInputs` selection decides which tasks run.
That selection is only as sound as the task's declared inputs, the same claim a
cache hit makes. So only `cache: true` tasks run changed-scope: the cheap and
medium graphs, plus the cached state tasks (`lint:jsdoc-module-tags`,
`jsdoc:inventory:check`, `jsdoc:ratchet:check`). The D2 git-delta and clock
checks and the uncertified binary walkers (`knowledge:semantic-delta`,
`knowledge:refs-check`, `goals:doctor`, `lint:oxlint`, `lint:shadcn`,
`lint:typos`) stay unfiltered. They run in a second Turbo graph alongside the
medium one, with one slot of the policy width (the medium graph keeps the rest),
so the inventory and semantic-delta long poles overlap as they do in the single
full-scope graph. `lint-policy-scope.test.ts` fails if a task's `cache` flag and
its graph disagree.

`lint:jsdoc` and `lint:deprecated-apis` are package tasks. Changed scope does not
run them per package (one repo-cli boot plus one plugin load each, audit M16).
Instead it runs one root oxlint per task over the package directories that a
`turbo run lint:jsdoc lint:deprecated-apis --affected --dry=json` probe selects:
the same per-package input sets, read from Turbo. If the probe fails, the plan
keeps the per-package Turbo tasks.

The documentation plugin is bundled to plain JS on every run
(`commands/Quality/internal/DocsOxlintPlugin.ts`, about 0.03 s). It is loaded
through a gitignored derived config written beside the source config
(`PREBUILT_DOCS_OXLINT_CONFIG` in that module). `.oxlintrc.docs.json` stays authoritative for lefthook,
editors and direct runs, and a failed build falls back to it.

## Workspace overrides

- `apps/oip-web`: build hashes its consumed `.env*` files and `ANALYZE`.
  Its script pins `NEXT_DISABLE_PWA=1`; a caller's value cannot change that build.
- `apps/professional-desktop`: build hashes `.env*` and the Vite-exposed
  `TAURI_*` family. Check extends inherited inputs before adding sibling stories
  and the external drizzle path.
- `apps/todox`, `apps/beep-effect-web`, `apps/labs/trustgraph-workbench`,
  `apps/labs/semantica`, `apps/labs/lejeune-bolt-workbench`: `next build` and
  `vite build` load `.env*` themselves, so each build override declares `.env*`
  now that the root `build` task no longer does.
- `apps/storybook`: lint includes the sibling stories it scans; existing check
  dependencies and uncached dev port passthrough remain. Dev-only HMR port
  settings do not affect the static build.
- `apps/labs/api-docs` and `infra`: no-output build overrides match their commands.
- `apps/docket-intake`, `apps/labs/api-docs`, `apps/labs/ciops` and the six
  `apps/practice-*` apps build with `tsrs -p tsconfig.check.json`, whose program
  includes `test`; `apps/todox` and `apps/oip-web` run `next build`, which
  typechecks a `tsconfig.json` that includes `test`. Their build overrides
  restate the root inputs without `!test/**` (an `$TURBO_EXTENDS$` overlay cannot
  undo a root exclusion). `package-role-turbo-inputs.test.ts` derives this set
  from each build's compiler program and fails when an override is missing or
  drifts from the root list.
- `packages/tooling/library/ai-sync`: inherited check/audit inputs retain the
  consumed agent settings files. `ai-sync check` reads only its committed
  `src/_generated` files and the two settings files, so the inherited prose
  exclusion is safe; its test pins the `$TURBO_EXTENDS$` head of the overlay.
- `packages/tooling/tool/cli`: test and property-test inputs include the root
  Turbo configuration read by their native configuration regressions; unrelated
  packages retain their narrower test inputs.
- `packages/foundation/primitive/types` and
  `packages/foundation/modeling/identity`: intentional uncached lint overrides
  remain. This audit does not promote their cache qualification status.

`packages/tooling/policy-pack/repo-configs` builds regenerate tracked allowlist
source. Its build remains fresh and includes the root allowlist as an input.

`infra/lambda/turbo-cache` is not a root workspace. Its standalone artifact
publisher is not an active Turbo build task, so adding a Turbo override there
would not fix any root task.

## Verify a suspected miss

Run the same root command twice with `--summarize`, keeping the checkout and
environment stable. A root command may launch several Turbo invocations; inspect
every new summary and match the exact `taskId`.

```sh
bun run test -- --filter=@beep/provenance --summarize
bun run test -- --filter=@beep/provenance --summarize
```

Compare the task hash, input map, dependency hashes and cache status. A different
hash indicates changed computation identity. The same hash with a miss points
to cache availability, read/write policy, cleanup or verification failures.
Transit nodes without executable scripts do not prove an executable cache miss.

For a boundary change, test both directions: unrelated output writes must leave
the hash stable, and consumed source/configuration changes must invalidate it.
The CLI's native Turbo fixture tests cover every root task's declared direct
input, artifact stability for the corrected boundaries, package test aliases/dependency propagation,
and the docgen tool dependency graph. The fixtures initialize a committed Git
repository so they exercise normal Git-ignore semantics.

`REGEN_GOLDENS=1` requests mutation. The variable is hashed globally so a
regeneration result cannot seed the ordinary test cache: Turbo still writes
cache entries during forced execution. The CLI forces execution for this mode,
including repeated invocations, while retaining normal caching when it is unset
or disabled. Invoke raw Turbo with `--force` if regenerating outside the CLI
wrapper.

Some scanners consume generated-looking files. For example, package law checks
read TypeScript under `docs` and `.beep`; those files must invalidate that task.
Changing scanner scope is a separate behavior change. Cache exclusions must not
conceal files the scanner still checks.

## Extra work after a cached root check

`bun run check` first runs Turbo's package check/build graph. An unscoped
invocation then runs `quality:tsgo-smoke` as a separate CLI step. The graph's
`FULL TURBO` result does not cover that step. The repo-wide test-typecheck
step (`quality:test-tsgo`) runs once, at the end of the lint-policy plan
(`bun run lint`, `bun run beep lint policy`, the `quality:lint-policy` pre-push
lane and hosted Lint Policy); a check-only session that wants it runs
`bun run beep quality test-tsgo` directly. Until 2026-11-02 root check ran it
too, so `audit packages` and a check-then-lint session walked the test files
twice against an uncached task.

The test-typecheck step discovers packages whose normal check does not cover
all tests, skips covered packages, and dispatches `package-test-typecheck` for
the remainder. That task is deliberately uncached and writes a result receipt.
The smoke step checks the installed compiler's Effect diagnostic behavior
outside Turbo. Reusing either result would require a separate reviewed contract
covering compiler/patch identity and, for test checks, restored receipts. This
input-boundary audit preserves those fresh checks.
