# C3 Turbo facts — documentation verification

Lane: documentation-verification for the C3 package-task migration.
Checkout: `ttc-c3-grill` worktree. Read-only; no git mutations.
Date: 2026-09-08.

## Pin / version

| Item | Value |
|---|---|
| Root `package.json` pin | `turbo` `^2.10.12` |
| Installed | **2.10.12** (`bunx --bun turbo --version`) |
| `turbo.json` `$schema` | `https://v2-10-2.turborepo.dev/schema.json` |
| Live docs host | `https://turborepo.dev/docs` (`turborepo.com/docs/*` 301s here) |
| Version banner on live pages | **none visible** on configuration / run / caching / env pages fetched 2026-09-08 |
| Docs source used | live `turborepo.dev` + GitHub `main` MDX (may be slightly ahead of 2.10.12) |

Repo `turbo.json` already uses the future-flag shape:

- `futureFlags: { affectedUsingTaskInputs, filterUsingTasks, globalConfiguration }` all `true`
- `global: { ui, inputs, env, passThroughEnv }` — no top-level `globalDependencies` / `globalEnv` / `globalPassThroughEnv`
- No `//#` root tasks yet
- Package tasks include `lint`, `check` (`outputs: []`), `coverage`, `package-test-typecheck` (`dependsOn: ["^transit"]`, `cache: false`), `transit` (`dependsOn: ["^transit"]`)
- Task `env` already uses wildcards (`EMAIL_*`, `NEXT_PUBLIC_*`, `BEEP_TEST_*`); `global.passThroughEnv` uses `PORTLESS_*`, `AWS_*`, `SST_*`

Verdict vocabulary: `VERIFIED` / `CONTRADICTED` / `UNVERIFIED`. Quotes ≤ 15 words. Local dry-runs used `--dry-run=json` only (writes nothing).

Canonical URLs:

- https://turborepo.dev/docs/reference/configuration
- https://turborepo.dev/docs/reference/run
- https://turborepo.dev/docs/crafting-your-repository/configuring-tasks
- https://turborepo.dev/docs/crafting-your-repository/running-tasks
- https://turborepo.dev/docs/crafting-your-repository/caching
- https://turborepo.dev/docs/crafting-your-repository/using-environment-variables
- https://turborepo.dev/docs/reference/system-environment-variables
- https://turborepo.dev/docs/messages/missing-root-task-in-turbo-json
- https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/reference/configuration.mdx
- https://turborepo.dev/blog/2-9
- https://turborepo.dev/blog/2-10
- https://github.com/vercel/turborepo/releases/tag/v2.9.0
- https://github.com/vercel/turborepo/releases/tag/v2.10.0

---

## 1. Root task syntax

**Verdict:** VERIFIED

- The `turbo.json` `tasks` key for a root-only task **is** `"//#<script>"`, not the bare script name. Example from docs: `"//#lint:root": {}` next to a package task `"lint"`.
  - https://turborepo.dev/docs/crafting-your-repository/configuring-tasks
  - https://turborepo.dev/docs/messages/missing-root-task-in-turbo-json
- The matching script **must exist** in the **root** `package.json`. Docs: “Root tasks are the scripts defined in the monorepo's root `package.json`.” Registering `//#build` without that script is the `missing-root-task-in-turbo-json` error.
- Invocation:
  - `turbo run lint:root` from the workspace root
  - `turbo run //#lint:root` from any workspace
  - Combined: `turbo run lint lint:root`
  - Local: `turbo run //#check --dry-run=json` is accepted (exit 0) even though `//#check` is **not** registered; it selects `packages: ['//']` and schedules **0 tasks**. A root `package.json` script is **not** auto-registered — without the `//#` key it is not a Turbo task.
- Package task `dependsOn` a root task: **yes**, via `"//#name"`. Gotchas doc: `"dependsOn": ["//#codegen"]`. Missing-root-task page: “Other tasks may then depend on `//#build`.”
  - https://github.com/vercel/turborepo/blob/main/skills/turborepo/references/configuration/gotchas.md
- Root task `dependsOn` package tasks:
  - Unqualified `"typegen"` on a root task resolves as **`//#typegen`** (other root tasks), not workspace package `typegen`. Discussion: “by design.”
    - https://github.com/vercel/turborepo/discussions/11586
  - `"^build"` from the root is generally empty (root has no package dependencies) unless an umbrella package depends on the workspace.
  - Explicit `"pkg#build"` **works** (documented workaround in that discussion; same `web#lint` → `utils#build` form as configuration.mdx).
- Do **not** depend on a root task whose script itself invokes `turbo` (infinite loop). Docs: “this would cause an infinite loop.”
- Skill guidance: “Prefer package tasks over Root Tasks.” Root tasks reduce per-package parallelism, caching, and filtering.

Local extra: root `package.json` already has `check`, `lint`, `knip`, `doctest`, etc. None are Turbo root tasks today. `turbo run knip` → `Could not find task \`knip\` in project` until `//#knip` is registered.

---

## 2. Root task `inputs`

**Verdict:** VERIFIED (with one residual: no live root-task dry-run in this repo)

- Input globs are “relative to the package’s `package.json`”. For a root task that directory **is the repo root**, so `packages/**/src/**` / `apps/**` / `goals/**` are legal globs into workspace trees. Docs do not forbid crossing package boundaries for **inputs** (they do require **outputs** stay inside the repository root).
  - https://turborepo.dev/docs/reference/configuration
- `$TURBO_DEFAULT$` = Turbo’s default input set: source-controlled files **in the package**, plus always-included `package.json` / `turbo.json` / lockfiles. It is **not** “every file in the repo.” Declaring `inputs` without `$TURBO_DEFAULT$` **replaces** the default (including `.gitignore` handling).
- For the **root package**, `$TURBO_DEFAULT$` therefore means git-tracked files **owned by the root workspace** (files not belonging to another workspace package) — locally confirmed by `turbo query affected --packages` tagging `//` with `FileChanged` for `goals/time-to-certainty/*` (not under `packages/` or `apps/`).
- `$TURBO_ROOT$` = “glob relative to the repository root instead of the package directory.” Inside a root task this is redundant with a plain relative glob (root package dir = repo root) but still valid. Package tasks use it to reach root files (`$TURBO_ROOT$/tsconfig.json`) instead of `../`.
- With `globalConfiguration: true`, `global.inputs` are **prepended to each task’s inputs** (including a future root task), so a root task also hashes those files unless the task negates them.
- This repo’s package `check` task already demonstrates `$TURBO_ROOT$`-style reach: dry-run `resolvedTaskDefinition.inputs` rewrites `global.inputs` as `../../../../.bun-version` etc. from `@beep/schema`, and `tasks[].inputs` includes both those root files and 367 package-local files (`src/**`, `package.json`, …) — `$TURBO_DEFAULT$` expanded.

Residual: cannot dry-run a real `//#` task here (none registered). The glob-into-workspace claim is from the path-resolution rules, not a root-task experiment.

---

## 3. `--affected` and the root package / `affectedUsingTaskInputs`

**Verdict:** VERIFIED

Default (flag off): `--affected` is **package-level**. Any changed file in a package selects **all** tasks in that package. Docs: “By default, `--affected` operates at the package level.”
- https://turborepo.dev/docs/reference/run#--affected
- https://turborepo.dev/docs/reference/configuration (futureFlags)

Root package special case (expected: “root is affected only when root-level files change”):

- **VERIFIED locally.** `origin/main...HEAD` on this branch touches only `goals/time-to-certainty/PLAN.md` and `.../research/decisions.md`. `turbo query affected --packages` returns exactly one item: `{ "name": "//", "path": "", "reason": { "__typename": "FileChanged" } }`. `turbo run check --affected --dry-run=json` lists `packages: ['//']` and **0 tasks** (no `//#check`).
- `turbo ls --affected --output=json` reports `count: 0` — **`turbo ls` omits the root package** even when query/run consider `//` affected. Do not use `ls --affected` as the root-inclusion oracle.

`affectedUsingTaskInputs: true` (this repo; default `false`):

- Changes selection from package-level to **task-level**: a task is selected only when changed files match **that task’s `inputs`**.
- Example: `inputs: ["$TURBO_DEFAULT$", "!README.md"]` → README-only change does **not** select `build`.
- **Still always-select-everything:** root configuration files, lockfiles, and `globalDependencies` / (with the new shape) equivalent global inputs that participate in the global hash. Docs: those changes “still select every task regardless of task inputs.”
- Implication for a root task with `inputs: ["packages/**/src/**"]`: **yes**, with the flag on, that root task becomes affected when any matching package src changes — selection is by the task’s declared inputs, not by “files owned by `//`.” Without the flag, only a root-owned file change would mark `//` affected, and then *all* root tasks would run.

GitHub 2.9.0 notes also mention improved root-level `$TURBO_ROOT$` inputs and “removal of the root package as an automatic global trigger” (root changes no longer auto-bust every package).
- https://github.com/vercel/turborepo/releases/tag/v2.9.0
- https://turborepo.dev/blog/2-9

---

## 4. `--affected` defaults (base/head, `--filter`, `--filter=//`)

**Verdict:** VERIFIED

Base / head:

- Default comparison: `main...HEAD`, equivalent to `--filter=...[main...HEAD]`.
  - https://turborepo.dev/docs/reference/run#--affected
- Overrides: `TURBO_SCM_BASE`, `TURBO_SCM_HEAD`.
  - https://turborepo.dev/docs/reference/system-environment-variables
- Skills filter rule adds fallback order: `TURBO_SCM_BASE` → GitHub Actions CI base ref (`GITHUB_BASE_REF`) → `main` or `master`.
  - https://github.com/vercel/turborepo/blob/main/skills/turborepo/references/filtering/RULE.md
- CLI help (2.10.12): `--affected` = “packages that are affected by changes between the current branch and `main`”.
- Shallow checkouts can mark every package changed (docs).

`--affected` × `--filter` = **intersection**, not union. Docs: “The two flags intersect.” 2.10 headline: composable `--affected` / `--filter`.
- https://turborepo.dev/docs/reference/run#--affected
- https://turborepo.dev/blog/2-10

Local:

| Command | `packages` | tasks |
|---|---|---|
| `check --affected` | `['//']` | 0 |
| `check --affected --filter=//` | `['//']` | 0 |
| `check --affected --filter=@beep/schema` | `[]` | 0 (schema not affected; intersection empty) |
| `check --filter=@beep/schema --filter=//` | `['//', '@beep/schema']` | 7 (schema graph; no root `check`) |

Multiple `--filter` flags are a **union**; `--affected` then intersects that union.

`--filter=//`:

- **Works on `turbo run`:** selects the root package named `//`. `turbo run check --filter=// --dry-run=json` → `packages: ['//']`, 0 tasks.
- **Does not work on `turbo ls`:** `--filter=//`, `--filter=.`, `--filter=./` all return 0 packages. `turbo ls` never lists `//` (full `ls` count is 142 workspace packages).
- Official run/filter pages do **not** document `--filter=//`. Behaviour is from the internal package name `//` (task ids `//#task`, `extends: ["//"]`) plus local experiment.
  - `extends: ["//"]` is package-`turbo.json` inheritance, not a filter.
  - https://turborepo.dev/docs/reference/configuration

---

## 5. Default `envMode`, inline script env, and hash contents

**Verdict:** VERIFIED (inline-hashing claim held, with a docs-language caveat)

Default `envMode` is **`strict`**. Confirmed by:

- configuration.mdx / run `--env-mode` docs
- CLI help (`--env-mode`; possible `strict` / `loose`)
- Local dry-run top-level `"envMode": "strict"` and per-task `"envMode": "strict"`
- https://turborepo.dev/docs/reference/run#--env-mode-option
- https://turborepo.dev/docs/crafting-your-repository/using-environment-variables

Strict mode: only vars declared in `env` / `globalEnv` (plus `passThroughEnv` / `globalPassThroughEnv` and built-ins `PATH`, `SHELL`, `SYSTEMROOT` / `HOME` / `PWD` / `APPDATA`) are **injected** into the child. Loose: all process env is available at runtime; **hashing is still limited to declared vars**.
- https://github.com/vercel/turborepo/blob/main/skills/turborepo/references/cli/commands.md

Inline assignment in the **script string** (`"doctest": "BEEP_VITEST_DOCTEST=1 vitest run"`):

- **Runtime visibility:** yes, regardless of `env`. Turbo’s command is the package-manager script (`"command": "bun run beep:check"` locally). The PM/shell applies `VAR=1 cmd` after Turbo spawns the process. Strict mode filters Turbo-injected env, not assignments the script itself performs.
- **Hashing:** the literal is part of `package.json` script text. `package.json` is **always** an input. Changing `=1` to `=0` busts the hash **without** listing the var in `env`. `env` is for values that come from the **caller / process environment**.
- Docs caveat (do not over-read): “Turborepo will not be able to detect the inline variable” refers to `export MY_VARIABLE=123 && next dev` **as an environment value** — Turbo hashes env at task start and cannot see values created inside the process. That is a different claim from “script text is hashed.” Both are true.
  - https://turborepo.dev/docs/crafting-your-repository/using-environment-variables

What the hash includes (docs + dry-run):

| Layer | Contents | Source |
|---|---|---|
| Global hash | resolved task definitions (root + package `turbo.json`), lockfile, root `package.json`, source of internal packages depended on by the root, `globalDependencies` **or** (flag on) `global.inputs` file contents, `globalEnv` values, behaviour-changing flags / `futureFlags`, passthrough CLI args after `--` | https://turborepo.dev/docs/crafting-your-repository/caching |
| Task hash | package files (`inputs` / `$TURBO_DEFAULT$`), always `package.json` + `turbo.json` + lockfile, task `env` values, dependency task hashes, `hashOfExternalDependencies` | configuration + caching pages |
| Not hashed | `passThroughEnv` / `globalPassThroughEnv` values (unless also in `env`/`globalEnv`) | configuration.mdx: “Passthrough values do not contribute to hashes” |
| Dry-run extras | `tasks[].hash`, `hashOfExternalDependencies`, `inputs` map of `path → git hash`, `resolvedTaskDefinition`, `command` (script invocation) | local experiment A |
| Global dry-run | `globalCacheInputs.files` (here `{".gitattributes": "<sha>"}`), `environmentVariables.specified.env` = `global.env`, `.specified.passThroughEnv` = `global.passThroughEnv` (wildcards preserved), `hashOfInternalDependencies` | local experiment A |

Local `globalCacheInputs.rootKey` is the constant string `I can’t see ya, but I know you’re here`.

Changing any `futureFlags` value itself “affects the global hash.”

---

## 6. `filterUsingTasks` future flag

**Verdict:** VERIFIED (and CONTRADICTED vs the “skip missing scripts” expectation)

Default: `false`. This repo sets `true`.
- https://turborepo.dev/docs/reference/configuration
- https://turborepo.dev/blog/2-9

Documented meaning: `--filter` resolves against the **Task Graph**, not only the Package Graph.

- Git-range filters (`--filter=[main]`) match changed files against task `inputs`.
- `...` traverses **task** dependencies/dependents, not merely package relationships.
- A task is selected only when its declared inputs match the changed files (for those git-range filters).
- Root configuration / lockfile / `globalDependencies` still select all tasks.
- Independent of `affectedUsingTaskInputs`.
- 2.10 fix: `filterUsingTasks` no longer incorrectly adds dependents to the task graph.
  - https://github.com/vercel/turborepo/releases/tag/v2.10.0

**Not** the flag’s meaning: “`--filter` skips packages that lack the script without error.” That skip is **default Turbo behaviour** for a task that *is* registered in `turbo.json` (packages without a matching `package.json` script are omitted). Local: `turbo run check --only --dry-run=json` → 142 package tasks, no `//`, no error.

If the task name is **not** in `turbo.json` at all, Turbo errors even with `--filter`: `Could not find task \`knip\` in project` / `definitely-missing`. `filterUsingTasks` does not change that.

---

## 7. `globalConfiguration` future flag

**Verdict:** VERIFIED

Default: `false`. This repo sets `true`. Must be enabled in the **root** `turbo.json`. Using the old top-level names then **errors**.
- https://turborepo.dev/docs/reference/configuration
- https://turborepo.dev/blog/2-9

Rename map:

| Existing key | New location |
|---|---|
| `globalDependencies` | `global.inputs` |
| `globalEnv` | `global.env` |
| `globalPassThroughEnv` | `global.passThroughEnv` |
| `ui` | `global.ui` |
| `envMode` | `global.envMode` |
| `cacheDir` / `cacheMaxAge` / `cacheMaxSize` | `global.*` |
| `concurrency` | `global.concurrency` |
| `daemon` | `global.daemon` (deprecated; removal in 3.0) |
| `noUpdateNotifier` | `global.noUpdateNotifier` |
| `dangerouslyDisablePackageManagerCheck` | `global.dangerouslyDisablePackageManagerCheck` |
| `remoteCache` | `global.remoteCache` |
| `experimentalObservability` | `global.experimentalObservability` |

**Semantic difference (not a rename):**

- Legacy `globalDependencies`: matching files go into the **global hash** → any change misses **every** task.
- `global.inputs`: files are **prepended to each task’s inputs** for **per-task** hashing, so a task can negate them (`!tsconfig.json` in that task’s `inputs`).

This repo’s `global.inputs` (`.bun-version`, `.nvmrc`, root `package.json`, tsconfigs) showed up in `@beep/schema#check` as `../../../../.bun-version` etc. in `resolvedTaskDefinition.inputs` — matches the new semantics.

---

## 8. `--continue` values and default

**Verdict:** VERIFIED

CLI 2.10.12: `--continue[=<CONTINUE>]`, `[default: never]`, values `never | dependencies-successful | always`.
- https://turborepo.dev/docs/reference/run#--continueoption
- `bunx --bun turbo run --help`

| Value | Behaviour |
|---|---|
| `never` (flag omitted) | An error **cancels all tasks**, including independent siblings. |
| `dependencies-successful` | Dependents of the failure are cancelled; **siblings whose deps succeeded keep running**. |
| `always` | Everything continues, including dependents of failed tasks. |
| `--continue` with **no value** | Treated as **`always`**. |

Turbo then exits with the highest observed exit code regardless of mode.

Skills CLI note: values must use `=`; otherwise the token may be parsed as a **task name**.
- https://github.com/vercel/turborepo/blob/main/skills/turborepo/references/cli/commands.md

So: one failure in a run with many independent tasks — **siblings do not keep running under the default**. They do under `dependencies-successful` or `always`.

---

## 9. The `with` task key

**Verdict:** VERIFIED (semantics) / UNVERIFIED (hash participation, root-task support)

Semantics:

- `with` starts additional tasks **alongside** the declaring task (no `dependsOn` ordering). Intended for long-running / persistent processes. Example: `"dev": { "with": ["api#dev"], "persistent": true, "cache": false }`.
- Persistent tasks cannot be `dependsOn` targets (they never exit); `with` is the supported coordination.
- `--parallel` is deprecated in favour of `persistent` + `with` (2.9; CLI help).
  - https://turborepo.dev/docs/reference/configuration
  - https://turborepo.dev/docs/crafting-your-repository/configuring-tasks
  - https://turborepo.dev/blog/2-9

Hashing: **not documented**. Local dry-run: every task has `"with": []`, but `with` is **absent** from `resolvedTaskDefinition` (keys: `cache`, `dependsOn`, `env`, `inputs`, `interactive`, `interruptible`, `outputLogs`, `outputs`, `passThroughEnv`, `persistent`). Caching page hashes “resolved task definitions”; if `with` is dropped from that object it may not join the task hash as a sibling-graph edge. A `turbo.json` text change can still miss via the global hash. No mutation experiment (worktree is read-only).

Root tasks: docs example is package-qualified (`api#dev`). Nothing says `with` cannot name `//#dev`; nothing says it can. **UNVERIFIED**.

---

## 10. `cache: true` with no `outputs`

**Verdict:** VERIFIED

- `cache` default is `true`.
- “Empty or omitted outputs cache no files, although logs remain cached when task caching is enabled.”
- Caching page: “Turborepo always captures the terminal outputs of your tasks.”
- Therefore: a cache **hit still skips execution** and **replays logs**; it does **not** restore files that were never declared.
- `outputs: []` vs omitting `outputs`: configuration.mdx treats them the same (“empty or omitted”). No hidden default output glob when omitted.
  - https://turborepo.dev/docs/reference/configuration
  - https://turborepo.dev/docs/crafting-your-repository/caching

Local `@beep/schema#check` (`outputs: []` in `turbo.json`):

- `resolvedTaskDefinition.outputs` = `[]`, `cache` = `true`
- dry-run `outputs` = `null`, `expandedOutputs` = `[]`
- `cache`: `{ "local": false, "remote": false, "status": "MISS", "timeSaved": 0 }` — the task is still a cache **candidate** (status is MISS, not “uncacheable”)

`cache: false` (this repo’s `package-test-typecheck`, `coverage`, `dev`) disables output caching and forces execution when selected.

---

## 11. `--dry-run=json` and run-summary shape

**Verdict:** VERIFIED (dry-run, from experiment + docs) / UNVERIFIED (exact `.turbo/runs` field names — `--summarize` writes files, not run)

### `--dry-run=json` (also documented as `--dry=json`)

Docs list: `taskId`, `task`, `package`, `hash`, `hashOfExternalDependencies`, `command`, `inputs`, `outputs`, `dependencies`, `dependents`, `environmentVariables`.
- https://turborepo.dev/docs/reference/run#--dry--dry-run

Local experiment A (`turbo run check --dry-run=json --filter=@beep/schema`, turbo 2.10.12):

**Top-level keys:** `envMode`, `frameworkInference`, `globalCacheInputs`, `id`, `monorepo`, `packages`, `scm`, `tasks`, `turboVersion`, `user`, `version`

Observed: `envMode=strict`, `turboVersion=2.10.12`, `version=1`, `packages=['@beep/schema']`, `scm={type: git, sha, branch}`, `frameworkInference=true`.

**Per-task keys:** `cache`, `cliArguments`, `command`, `dependencies`, `dependents`, `directory`, `envMode`, `environmentVariables`, `excludedOutputs`, `expandedOutputs`, `framework`, `hash`, `hashOfExternalDependencies`, `inputs`, `logFile`, `outputs`, `package`, `resolvedTaskDefinition`, `task`, `taskId`, `with`

| Claim | Result |
|---|---|
| hash lives at `tasks[].hash` | **yes** (e.g. `@beep/schema#check` → `52475abac4dfc06d`) |
| `tasks[].inputs` with file hashes | **yes** — object `path → git sha`, 373 entries for schema#check |
| `expandedInputs` | **absent** (there is `expandedOutputs`, not `expandedInputs`) |
| `hashOfExternalDependencies` | **present** (task + `globalCacheInputs`) |

`cache` on a task is `{ local: bool, remote: bool, status: "MISS"|"HIT"|…, timeSaved: number }` even in dry-run. JIT/deferred inputs may report `hash: null` (configuration.mdx).

`environmentVariables`: `{ specified: { env, passThroughEnv }, configured, inferred, passthrough }`.

### `--summarize` → `.turbo/runs/<run-id>.json`

Docs (no field-level schema, no version banner):

- Path: `.turbo/runs` (skills: `.turbo/runs/<run-id>.json`)
- Contents: affected packages; executed tasks with **timings and hashes**; files included in cached artifacts
- Use: inspect how `inputs`/`outputs` globs expanded, which inputs caused a miss, timing deltas
  - https://turborepo.dev/docs/reference/run#--summarize

Exact per-task fields `local` / `remote` / `miss` / `timeSaved` / `execution exitCode` are **not listed** on the run page. Closest observed analogue is dry-run `tasks[].cache.{local,remote,status,timeSaved}`. `--summarize` was not run (it writes). No `.turbo/runs/*.json` in this worktree.

---

## 12. Env var handling in hashes (`env` / `passThroughEnv` / wildcards)

**Verdict:** VERIFIED

- `env` / `global.env` (`globalEnv`): **hashed** and, in strict mode, injected.
- `passThroughEnv` / `global.passThroughEnv`: injected in strict mode, **not hashed** unless also listed in `env`/`globalEnv`.
- Wildcards / negations **are** supported on `env` (and `globalEnv`): `*`, `!*`, `FOO*` / `BEEP_*`, `!FOO` / `!MY_API_DEBUG`, escaped `*`/`!`.
  - https://turborepo.dev/docs/reference/configuration
- Docs do **not** separately specify wildcard syntax for `passThroughEnv`, but this repo already ships `PORTLESS_*` / `AWS_*` / `SST_*` in `global.passThroughEnv` and dry-run echoes those patterns unchanged in `globalCacheInputs.environmentVariables.specified.passThroughEnv` — runtime accepts them.
- Framework inference may auto-add prefixes (`NEXT_PUBLIC_*`, `VITE_*`).
- Precedence: `global.env` applies to **every** task; per-task `env` applies to that task. Docs do not state override-vs-union when both match the same key; treat as **union of patterns** (both contribute to hash/allowlist). Same for pass-through. Local `check` has `rtd.env: []` and still inherits `global.env` at the global-hash layer (`specified.env`: `BEEP_ESLINT_PROFILE`, `VITE_COSMOS_SPIKE`).

---

## 13. `interruptible`, `interactive`, `persistent` (2.10)

**Verdict:** VERIFIED (present in 2.10; not 2.10-new)

All three exist in configuration.mdx and appear on local `resolvedTaskDefinition` (`persistent: false`, `interruptible: false`, `interactive: false` for `check`).

| Key | Default | Notes |
|---|---|---|
| `persistent` | `false` | Long-running; cannot be depended on; interactive by default; `cache: false` typical. |
| `interactive` | `false` (`true` for persistent) | Must be used with `persistent`; allows stdin in the TUI. |
| `interruptible` | `false` | Persistent + `turbo watch`: restart when affected files change. |

No 2.10-specific change found; `--parallel` deprecation pointing at `persistent`/`with` is 2.9. Graceful SIGINT/SIGTERM forwarding is a 2.10 runtime change that matters for persistent tasks.
- https://turborepo.dev/docs/reference/configuration
- https://turborepo.dev/blog/2-10

---

## 14. Root tasks and `--filter` / `--affected`

**Verdict:** VERIFIED (with a CONTRADICTION of “`--filter=//` unions root into `--affected`”)

Does `turbo run lint:knip --filter=@beep/schema` run `//#lint:knip`?

- There is no `lint:knip` script (root has `knip`, not `lint:knip`) and no `//#knip` task. `turbo run knip --filter=@beep/schema` **errors**: task not in project.
- For a **registered package** task: `turbo run check --filter=@beep/schema` does **not** include `//` (`packages: ['@beep/schema']` only).
- `turbo run //#lint --filter=@beep/schema` **does** put `//` in `packages` (task-id selector `//#lint` names the root package) but still schedules 0 tasks because `//#lint` is unregistered. So: **bare task name + package `--filter` does not run a root task; an explicit `//#name` CLI selector includes `//` in the package set.**

Does `--affected` with no root change **skip** a root task?

- **Expected yes**, and local evidence is consistent: `--affected` is package-level (or task-inputs with the flag). Root tasks live on `//`. `//` is affected only when a root-owned file changes (or, with the flag, when that root task’s `inputs` match).
- This branch **does** have a root-owned change (`goals/**`), so we observed inclusion of `//` rather than the skip. The skip is the complementary case (package-src-only delta → `turbo query affected` would omit `//` → a `//#task` would not run).
- That is why a C3 ruling “root tasks always run unfiltered” is the safe operational choice: `--affected` will drop them on package-only PRs.

Is `--filter=//` a way to **always** include the root, including with `--affected`?

- **CONTRADICTED.** Multiple `--filter`s union; `--affected` **intersects** the filter set.
- `--affected --filter=//` ≡ “root package AND affected” → includes `//` only when `//` is affected (local: yes, because `goals/` changed). On a package-only PR it would be **empty**, not a forced include.
- To always run a root task: invoke it **without** `--affected` (e.g. `turbo run //#lint:knip` or `turbo run lint:knip` from root), or add an explicit `//#task` CLI target. Do not expect `--affected --filter=//` to pin the root in.

`turbo ls` cannot be used to prove this (`ls` never lists `//`).

---

## 15. Turbo 2.9 / 2.10 release-note deltas

**Verdict:** VERIFIED (collected). No version banner on live docs; blogs identify 2.9 and 2.10.0.

### 2.9 — https://turborepo.dev/blog/2-9 + https://github.com/vercel/turborepo/releases/tag/v2.9.0

- **`futureFlags` introduced** as opt-in 3.0 migration: `globalConfiguration`, `affectedUsingTaskInputs`, `filterUsingTasks`, plus `watchUsingTaskInputs`, `pruneIncludesGlobalFiles`, `errorsOnlyShowHash`, `longerSignatureKey`, `experimentalObservability`.
- `affectedUsingTaskInputs`: `--affected` selects by task `inputs`, not whole packages.
- `filterUsingTasks`: `--filter` at task granularity; git-range uses inputs; `...` uses Task Graph.
- `globalConfiguration`: top-level keys move under `global`.
- `$TURBO_ROOT$` inputs / root-level affected handling; “removal of the root package as an automatic global trigger.”
- `turbo query` (incl. `affected`) stable; `turbo-ignore` deprecated.
- `with` + `persistent` replace deprecated `--parallel`.
- Root-task `//#` execution fix (“root-level tasks not executing”).
- `--dry-run` cache-status reporting aligned with real execution.
- Strict mode forwards `TURBO_*`; more default pass-throughs.
- Boundaries: subpath imports, Bun builtins (Boundaries itself landed experimental in **2.4**, not 2.9/2.10).
  - https://turborepo.dev/docs/reference/boundaries
  - https://turborepo.dev/blog

### 2.10 — https://turborepo.dev/blog/2-10 + https://github.com/vercel/turborepo/releases/tag/v2.10.0

Headline blog (2.10.0): graceful shutdown, deferred input hashing (`jit` / `dependencyOutputs`), **composable `--affected` + `--filter` (intersect)**, local cache eviction (`cacheMaxAge` / `cacheMaxSize`, default in 3.0).

Also in the GitHub 2.10.0 notes (relevant to this packet):

- `--affected` + `--filter` composable; lockfile-changed packages included; `turbo query affected` detects **affected root tasks** and respects SCM env vars
- `filterUsingTasks` no longer incorrectly adds dependents; git filters support two-dot ranges
- JIT / dependency-output hashing; incremental task caching; dirty `.gitignore` respected
- Root-task docs clarified
- Boundaries: circular deps detection, parallelized checks (not a new feature intro)
- Windows `ComSpec`/`PATHEXT` pass-through
- **No** user-facing `--continue` change; **no** `--dry-run` schema change called out beyond lockfile-during-dry-run

2.10.12 (installed) is a patch on that line; this worktree did not enumerate 2.10.1–2.10.12 patch notes.

---

## Local experiment A — `turbo run check --dry-run=json --filter=@beep/schema`

**Verdict:** VERIFIED (exit 0, turbo 2.10.12)

Command writes nothing. Top-level keys: `envMode`, `frameworkInference`, `globalCacheInputs`, `id`, `monorepo`, `packages`, `scm`, `tasks`, `turboVersion`, `user`, `version`.

- `packages`: `['@beep/schema']` (filter worked; root **not** included)
- `tasks`: 7 — `@beep/data#build`, `@beep/fc-runs#build`, `@beep/identity#build`, `@beep/schema#build`, `@beep/schema#check`, `@beep/types#build`, `@beep/utils#build` (`check` `dependsOn: ["^build"]`)
- `@beep/schema#check`: `hash=52475abac4dfc06d`, `command=bun run beep:check`, `inputs` dict 373 files, `hashOfExternalDependencies` present, **no** `expandedInputs`, `outputs=null` / `expandedOutputs=[]`, `with=[]`, `cache.status=MISS`, `envMode=strict`
- `globalCacheInputs.environmentVariables.specified.env` = repo `global.env`; `.passThroughEnv` = repo `global.passThroughEnv` including `BEEP_*`-style wildcards

---

## Local experiment B — `turbo run check --affected --dry-run=json`

**Verdict:** VERIFIED (exit 0)

- `packages`: `['//']` — **root package appears**
- `tasks`: **[]** (0) — no `//#check` registered, and no workspace package is affected
- `scm.branch`: `ttc/c3-package-tasks-grill`; sha `964fa2bb61…`
- Why `//` is affected: `origin/main...HEAD` is docs-only under `goals/` (root-owned)
- Corroboration: `turbo query affected --packages` → `[{ name: "//", path: "", reason: FileChanged }]`; `turbo ls --affected` → 0 packages (ls hides `//`)

---

## Implications for C3 (not rulings — facts only)

1. Register root lanes as `"//#<script>"` **and** keep the script in root `package.json`. Invoke with `turbo run <script>` or `turbo run //#<script>`.
2. `$TURBO_DEFAULT$` on a root task is **not** the whole repo. To hash/select on `packages/**` / `apps/**` / `goals/**`, declare those globs (plain relative or `$TURBO_ROOT$/…`). With `affectedUsingTaskInputs: true` that also drives `--affected`.
3. `--affected` will **drop** root tasks on package-only PRs. `--filter=//` does **not** force them back in when combined with `--affected` (intersection). Run root tasks unfiltered, or target `//#name` explicitly.
4. Inline `VAR=1 cmd` in the script string is fine for strict mode and for hashing (via `package.json`). Put caller-supplied values in `env` (hashed) or `passThroughEnv` (not hashed).
5. `outputs: []` + `cache: true` still caches **logs** and can HIT; use `cache: false` only when execution must always run.
6. Default `--continue=never` cancels siblings; quality lanes that want “run every independent task” need `--continue=dependencies-successful` (or `always`).
7. `filterUsingTasks` is **not** the missing-script skip. Missing-from-`turbo.json` still errors.

---

## Open questions / residual ambiguity

1. Exact `.turbo/runs/<id>.json` per-task field names (`exitCode`, `cache` local/remote/miss, `timeSaved`) — docs describe contents, not schema; `--summarize` not run (writes).
2. Whether `with` participates in the task hash (`with` missing from `resolvedTaskDefinition`).
3. Whether `with: ["//#dev"]` is valid.
4. `passThroughEnv` wildcard grammar is demonstrated locally but not spelled out next to `env` in configuration.mdx.
5. `global.env` ∩ task `env` same-key precedence (union assumed; docs silent).
6. Live-site version banner: none on fetched pages; GitHub `main` MDX may describe flags slightly newer than 2.10.12.
7. Complementary `--affected` skip (package-src-only delta, `//` absent) was not observed on this branch because `goals/` *did* change.

---

## Orchestrator amendment — live probes (2026-09-08, turbo 2.10.12, `futureFlags` on)

Run after the Grok lane finished, with a temporary commit adding `//#c3-probe`
(`inputs: ["packages/tooling/tool/cli/src/commands/Lint/**"]`) and `//#c3-probe-docs`
(`inputs: ["research/**"]`) plus two root scripts, then `git reset --hard 964fa2bb61`. Full
table in `c3-lane-task-table.md` §0.2.

- **Fact 1 / 2 confirmed live:** `//#name` runs via `turbo run name`; `tasks[].hash` and
  `tasks[].inputs` (path → blob sha) are present; root inputs glob into workspace
  directories; a root task may `dependsOn` a package task (`@beep/schema#check`).
- **Fact 3 sharpened:** with `affectedUsingTaskInputs`, `--affected` selects a root task by
  **its own declared inputs**: no diff → nothing; `research/README.md` edit → only
  `//#c3-probe-docs`; `packages/drivers/freshbooks/README.md` edit → freshbooks and
  dependents, no root task; `Lint.command.ts` edit → `//#c3-probe` plus `@beep/repo-cli#check`
  and dependents; `AGENTS.md` edit (undeclared) → nothing.
- **Fact 14 amended:** the predicted "package-only PR drops root tasks" holds only for a root
  task whose inputs do not cover the changed package files. With honest inputs the root task
  is selected. `--affected --filter=//` intersects (confirmed: empty on a package-only edit).
- **Fact 5 confirmed live:** `envMode: strict`; inline `VAR=1 cmd` reaches the child; a
  declared `env` caller variable reaches the child and changes the hash; `passThroughEnv`
  reaches the child and does not change the hash; an undeclared caller variable is stripped
  and does not change the hash.
- **Fact 10 confirmed live:** `cache: true` with no outputs → `cache hit, replaying logs` on
  the second run.
- **Fact 11 sharpened:** `--summarize` wrote `.turbo/runs/<id>.json` with per-task `hash`,
  `cache: { local, remote, status, timeSaved }`, `execution.exitCode`; root `taskId` is
  `//#<script>`.
- **Fact 8 confirmed:** `--continue` default `never`; values `never`,
  `dependencies-successful`, `always` (CLI help 2.10.12).
- **Probe hygiene:** an uncommitted edit to root `package.json` or `turbo.json` is a global
  input change and selects every task under `--affected`; commit probe config before
  measuring selection.

## Stage C2 amendment — explicit selectors and Git metadata (2026-09-11)

Verified against the installed **Turbo 2.10.12** using the production root task
registrations, globals and dependency edges in scoped synthetic repositories
under `/tmp`. The checkout receives no Git writes. The executable evidence is
`packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`; run from the CLI
package with `bunx --bun vitest run test/root-tasks-turbo-inputs.test.ts --pool=threads`.

- **F-A: explicit root selectors bypass affected filtering.** With
  `TURBO_SCM_BASE=base`, `TURBO_SCM_HEAD=HEAD`, and `--affected`, passing all 40
  `//#<script>` selectors returns all 40 tasks even for a non-input edit.
  Bare names preserve declared-input filtering. Use bare task names in affected
  invocations; retain `//#<script>` for configuration keys, dependencies, summary
  IDs and ledger IDs. This qualifies the earlier invocation guidance and the
  expectations in section 14; the two selector forms are not interchangeable.
- The fixture commits its configuration, creates `base` at the first commit,
  then makes a README-only second commit. README is an input of
  `lint:roadmap-refs` and `lint:typos`, so the clean affected result contains those
  two tasks plus their `lint:policy-fingerprint` prerequisite. A non-input edit
  adds no tasks; requesting the remaining bare names returns zero tasks.
  Every declared-input row is checked alone and alongside the two whole-tree
  tasks, with exact task-set equality including prerequisite edges. Row isolation
  matters because many production rows deliberately share source/config inputs.
- **F-B: whole-tree inputs need explicit Git exclusions.** Both root tasks that
  include `**/*` now include `!.git/**` and `!**/.git/**`. The Git fixture writes
  a previously absent loose blob with `git hash-object -w`, confirms the object
  exists, adds nested Git metadata, and asserts **all 40 hashes are unchanged**
  and all resolved input maps exclude Git paths. This prevents object-store churn
  from becoming a task input. Fable's pre-fix probe established the inclusion bug;
  this regression case verifies the corrected production declarations.

These are selection/hash proofs from real Turbo dry runs, not checker execution,
cache-hit economics, hosted proof, or binary-walker certification. Stage D must
use bare root task names for every affected invocation it introduces.
