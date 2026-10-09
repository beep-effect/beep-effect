# Gap follow-up 7: root-script ownership, refs-check lane, external callers, slice drop-in

## Gap follow-up (2.C (regenerate task-facing package scripts through their owner command; update callers) and 4 'Script ports' (updated callers))

**Provenance.** Head `e62411d63f` (= main), lane `rsc-packet`. Date 2026-10-09. Read-only.
`C-ownership-facts.md` did not exist, so this is a standalone file. Commands: `rg`, `sed -n`,
`jq`, `git config -f <clone>/.git/config --get-regexp '^merge\.regenerate'`, `git log`,
`stat`, `systemctl --user cat agent-runs.slice`, and
`zsh -ic 'cd <checkout> && bun run beep lint package-scripts --help'`.

### (a) `beep lint package-scripts` does not own root `package.json` scripts

- **Scope is workspace members only.** `PackageScriptsPolicy.run`
  (`packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts:327-350`)
  iterates `resolveWorkspaceDirs(repoRoot)`. That function
  (`packages/tooling/library/repo-utils/src/Workspaces.ts:121-200`) expands the root
  `workspaces` globs (115 entries in `package.json`, none of them `.`) and returns only the
  child manifests. The root manifest is read only to get the globs.
  `PackageScriptsPolicy.kindOf` (`PackageScriptsPolicy.ts:237-246`) rejects any manifest
  outside that set with `Manifest outside workspace domain`. The class JSDoc (`:214`) says
  "Evaluates root workspace members and repairs only policy-owned script text". The command
  description (`commands/Lint/Lint.command.ts` `lintPackageScriptsCommand`, `:1119-1133`)
  is "Check or repair canonical workspace scripts", and `--help` lists only
  `--check | --write | --json`.
- **What is generated and what is hand-owned (inside a workspace manifest).**
  `scriptsBlockFromRecord` (`PackageScripts.schemas.ts:307`) splits a scripts record into
  three disjoint tiers of `ScriptsBlock` (`:243`):
  - `tasks`: `TaskScriptName` (`:76`), 17 task-facing keys (build, check, lint, lint:fix,
    test, test:property, test:integration[:parallel], coverage, docgen, audit,
    package-test-typecheck, codegen, lint:deprecated-apis, lint:jsdoc, lint:laws, doctest).
  - `impls`: `ImplScriptName` (`:112`).
  - `extras`: `ExtraScriptName` (`:221`), meaning every other key.

  `expectedBlock` (`PackageScriptsPolicy.ts:147-165`) rewrites a task's text only when the
  rule binding is `cli` or `indirection` (`bindingText`, `:142`). It removes a task whose
  rule is disabled or `absent` (`HashMap.remove`, `:154`). It leaves `owned` bindings
  hand-written (`:157`) and seeds a missing impl from `implScriptDefaults` (`:1168`) via
  `seedImplementation` (`:113-128`). It always passes `extras: actual.extras` through
  unchanged (`:164`). Kind `exempt` (`scratchpad`, `tools/*`, via `kindForDirectory`
  `:101-111`) is skipped entirely (`processManifest`, `:300-302`). Rules live in
  `taskScriptRules` (`PackageScripts.schemas.ts:514`).
- **How a removed script is handled.** In a workspace, removing an *extra* is a plain hand
  edit, and the policy never re-adds or reports it. Removing a governed *task* is reported
  as `missing-task` or `unexpected-task` (`taskDrift`, `:167-181`), and `--write`
  restores it. Root scripts are outside the policy, so `prepare`, `knowledge:refs-rewrite`
  (`package.json:419`), `knip` (`:418`), `impeccable:detect` (`:415`),
  `knowledge:refs-check` (`:450`) and the root `lint:package-scripts` (`:448`) are all
  hand-owned. Removing or porting one means editing root `package.json` by hand.
  `--write` will not regenerate them.
- **Coupling that does see root scripts.** `CacheCensusReport.rootScripts`
  (`commands/Cache/Cache.schemas.ts:361`) is filled from the root manifest
  (`commands/Cache/Cache.census.ts:578`). Workstation memory (lint-turbo-cache #1538, a
  memory note, not repo source) records that any root-script add or remove changes the
  scripts digest of every cached `//#` task. The `quality:cache-policy` cheap gate then
  fails with `configuration-drift` until a baseline review against
  `standards/cache-qualification-baseline.json` is recorded. The policy-tools fingerprint
  also lists root `package.json` as an input (`policyToolsFingerprint`,
  `Lint.command.ts:~993`). Separately, a removed root script whose `//#<name>` task stays
  in `turbo.json` leaves a dangling turbo task. `TurboConfigProof.ts:35-60` enumerates the
  `//#` tasks it proves.

### (b) Lane that runs `//#knowledge:refs-check` (`turbo.json:688`, `cache:false`, dependsOn `//#lint:policy-fingerprint`)

- **Hosted:** `.github/workflows/heavy.yml:43` matrix `lint-policy` runs
  `run_lane ci lane lint-policy` (`:239-240`). `CiLane.ts:1638` maps it to
  `beep lint policy --full` (descriptor `:396-402`, context `Heavy / Lint Policy`,
  `required: true`). `runRootLintPolicyTaskInternal` (`commands/Quality/Tasks.ts:~3187`)
  then calls `rootRepoLintPolicySteps(..., isCi(), …)` (`:3209`). With no base it is a full
  run, so the `lint:policy:medium` step carries `fullScopeStateTasks(hosted=true)`
  (`:3072`). That is `policyStateTasks` (`:2957`), which includes `policyGitDeltaTasks` =
  `["knowledge:semantic-delta", "knowledge:refs-check"]` (`:2956`).
- **Local:** a changed-scope `beep lint policy --base …` runs it in the separate
  `lint:policy:state` step (`:3075`). A local full run with no CI excludes it (`:2967-2968`,
  plus the comment at `:2952-2955`). No `.github/workflows` file and no Yeet source names it
  directly. That explains why the earlier string match missed it.

### (c) Out-of-repo callers of the script paths

Pattern: `setup-effect-ref.sh | enable-turbo-remote-reads | setup-regenerate-merge-driver |
scripts/onepassword | beep-secrets-layout`.
- **Zero hits** in `~/.config/systemd/user`, `~/.local/bin`, `~/.zshrc`, `~/.zshenv`,
  `~/.zprofile`, `~/.config/beep`, `~/.claude/settings.json` (+ local; `~/.claude/hooks`
  does not exist), `~/.claude/rules`, `~/.grok`, or the config files under `~/.codex` and
  `~/.cursor`. The only hits are non-caller residue: Codex worktree checkout copies under
  `~/.codex/worktrees/*`, a Codex rollout memory summary, and Cursor merkle-sync
  `worker.log` lines.
- **Clone git config:** 24 clones checked
  (`~/YeeBois/projects/beep-effect*/.git/config`). Exactly one, `beep-effect16`, has
  `merge.regenerate.driver` set. It points at that clone's **absolute path to
  `scripts/regenerate-merge-driver.sh`** (the driver itself, not the setup script), with
  `recursive=binary`. The other 23 have none, and no clone sets `core.hooksPath` or has a
  `.git/hooks` hit. This corrects C-scripts.md ("unset in all three local clones"). If the
  driver script is moved or renamed, `beep-effect16` merges of the 4 `merge=regenerate`
  paths (`.gitattributes:7-10`) will invoke a missing file. Re-run the owner setup there,
  or keep a shim.
- **In-repo (for completeness):** the only caller of the setup script is
  `.github/workflows/check.yml:256`, which then asserts that the configured driver contains
  `scripts/regenerate-merge-driver.sh` (`:258`). `scripts/cloud/`, `.cursor/`,
  `.claude/settings.json`, `.codex/` and `.github/` have no other hits.

### (d) Owner of `~/.config/systemd/user/agent-runs.slice.d/50-heavy-budget.conf`

- **Content:** `[Slice] MemoryHigh=48G MemoryMax=60G MemorySwapMax=8G
  ManagedOOMMemoryPressure=kill ManagedOOMMemoryPressureLimit=50%`. Its header says it was
  added 2026-10-06 after systemd-oomd killed browsers and the desktop app, and says to
  remove the file and run `daemon-reload` to undo.
- **No writer exists.** No file in `~/.local/bin`, `~/.config/beep`,
  `~/.config/systemd/user`, `packages/tooling`, `scripts/` or `docs/` names
  `50-heavy-budget` or `agent-runs.slice.d` (the repo hits are only the 50-oomd install
  comments in `scripts/systemd/agent-runs.slice:3-4,18`). `~/.local/bin/beep-heavy`
  (bash, 1804 B) only consumes the slice: `systemd-run --user --slice=agent-runs.slice -p
  MemoryMax=$mem -p MemorySwapMax=0 -p OOMPolicy=kill` (`beep-heavy:41-46`). It never
  writes a unit.
- **Provenance:** the drop-in and `beep-heavy` share an mtime (2026-10-06 01:42:51, 0.6 ms
  apart). Workstation memory (`oomd-app-slice-pressure-kills-neighbours`) records that both
  were hand-built by an agent session at the operator's request, as "workstation config,
  not yet a repo default". The owner is therefore the operator/workstation, created
  together with `beep-heavy`, with no installer.
- **Drift detail:** the installed `agent-runs.slice` (mtime 2026-08-30) matches the #888
  version (48358da036, 2026-08-30). It predates #984 (28511f6c37, 2026-09-03), which added
  `MemoryHigh=64G` and `50-oomd.conf` to the repo source. The installed unit was never
  re-synced. Effective limits come only from `50-heavy-budget.conf`.

### Proposed plan (implementing lane)

1. Treat root scripts as hand-owned. Remove or port `knowledge:refs-rewrite` (and any other
   root key) with a direct `package.json` edit. In the same PR, record the cache-policy
   baseline review (root-scripts digest moves every `//#` task), and drop or retarget the
   matching `//#` turbo task if there is one. Then run
   `bun run beep lint package-scripts --check`. It is a no-op for root but proves the
   workspace tiers.
2. If the brief wants root ownership, that is a policy extension (a new `PackageKind`
   such as `root`, with rules) and is design work, not a regeneration step. Log it as a
   Decision Log entry rather than assuming it.
3. Keep `knowledge refs --check` evidence on the hosted `Heavy / Lint Policy` lane. For a
   local proof of a rule move, run `beep lint policy --base origin/main`, because local
   full scope skips it.
4. For a merge-driver port, keep `scripts/regenerate-merge-driver.sh` resolvable (or ship
   a shim), and update `check.yml:256-258`. Then tell the `beep-effect16` owner to rerun
   the setup. No other external caller needs updating for the four script families.
5. Pick one systemd story and record it as a decision. Either adopt the
   `50-heavy-budget.conf` values into `scripts/systemd/` (replacing `MemoryHigh=64G` and
   `50-oomd.conf`) with an owner install command, or re-sync the installed unit to the repo
   and delete the drop-in. Today repo and machine disagree in three places.

### Open questions

- Whether the cache-policy `configuration-drift` effect of a root-script removal still
  holds at head was not re-run (no gates allowed). It is memory-sourced from #1538.
- Linked-worktree `config.worktree` files and the `-worktrees` roots were not scanned for
  `merge.regenerate`. Only the 24 primary clones' `.git/config` files were.
- Whether the operator wants `50-heavy-budget.conf` promoted to a repo default is not
  recorded anywhere. Memory says "not yet a repo default".
