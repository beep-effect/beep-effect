# Effect reference workspace — aligned design (grill 2026-09-25)

Problem: `$HOME/YeeBois/dev/effect` is the Effect v4 source of truth that every beep-effect checkout
reaches through a gitignored `.repos/effect` symlink. It carries only a structural graft index, the
link is absent from most agent worktrees, and each further reference repo (effect-tsgo today,
t3code / opencode later) would need its own ad hoc index, path, and refresh. The operator wants one
consolidated reference folder per theme with one graft setup, refreshed on a timer, reachable from
every beep checkout by a stable name.

Evidence report: `2026-09-25-01-current-state.md` (same directory). Graft facts below cite the
machine-local Graft checkout at `$HOME/YeeBois/dev/Graft` (v0.18.0 installed via mise node 24.19.0).

## Locked decisions

| # | Decision | Ruling |
| --- | --- | --- |
| R1 | Layout | **Physically move** the clones to `$HOME/YeeBois/references/effect/<repo>`. No symlink shim is left at `$HOME/YeeBois/dev/effect`; stale paths fail loud. The moved primary has one linked worktree (`$HOME/YeeBois/dev/effect-worktrees/docgen-enforce-examples`), so the move ends with `git worktree repair` run from the moved primary. |
| R2 | Members | **`effect` and `effect-tsgo` only**, both deep tier. Adding a member is one manifest entry plus one command. `effect-smol` is excluded (last pulled 2026-07-14; effect `main` is the v4 codebase with `migration/v3-to-v4` checked in). t3code (23k tracked files, 6 worktrees) and opencode are deferred; when admitted they enter structural-only with `--only-dir` narrowed to their Effect-using packages. |
| R3 | Graft mode | **Workspace mode** (graft auto-splits a `.git`-less folder with two or more git children: each child keeps its own `graft/`, the parent holds only `graft/workspace.json`, parent queries federate with rank fusion). Never `--follow-nested-repos` (a mega-graph only pays off when members import each other's source; t3code/opencode import `effect` from npm). No `graft init` at parent or children (it writes instruction files into upstream clones; beep denies `graft init` in `.claude/settings.json`). CLI only, no MCP server (beep decision log 2026-09-09). Build with `GRAFT_NO_GITIGNORE=1` and ignore `graft/` through each child's `.git/info/exclude`, so pull-only upstream clones never get a dirty tracked `.gitignore`. |
| R4 | Deep model | **`claude-opus-5` through CLIProxyAPI.** Reuse `$HOME/.config/beep-graft/env` verbatim: `GRAFT_PROVIDER=openai`, `GRAFT_BASE_URL=http://127.0.0.1:8317/v1`, `GRAFT_MODEL=claude-opus-5`, `GRAFT_LLM_RETRIES=12`, `GRAFT_SYNTH_MAX_TOKENS=32768`, `GRAFT_SYNTH_JOBS=4`, `GRAFT_DUMP_DIR`, `DO_NOT_TRACK=1`. The `graft.deep` role in the model routing manifest already binds `claude-opus-5` × `proxy-workflow`. |
| R5 | Beep links | **Keep `.repos/effect`** pointing at the child clone `references/effect/effect`, so every `../.repos/effect/...` link in standards, skills, README, and the `greptile.json` ignore stays valid unchanged. **Add** one link per member (`.repos/effect-tsgo`) and **`.repos/effect-workspace`** → the parent, which is the federated `graft ask` target. |
| R6 | Provisioner | Grow `scripts/setup-effect-ref.sh` into a **workspace provisioner** driven by a checked-in `scripts/references.json` manifest (theme, root, members with `name`, `url`, `tier` ∈ {`deep`, `structural`}, optional `onlyDir`; no branch field, since R9 refreshes `main` only; the field shapes are normative in `SPEC.md` §Domain Model). Default root `$HOME/YeeBois/references/effect`, override `BEEP_REFERENCES_ROOT` (replaces `BEEP_EFFECT_CHECKOUT`). Idempotent: clones missing members, relinks drifted links, never touches a member that is dirty or off `main`. |
| R7 | Fleet | **One-off relink** over every `beep-effect*` clone and every `*-worktrees/*` checkout (census 2026-09-25: 144 checkouts, 40 linked, 104 missing). **`beep worktree new` provisions the links** as a new step in `runWorktreeNew` after `copyLocalFiles` (`packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts`). |
| R8 | Tooling home | **beep-effect.** New `commands/Refs/` group in `@beep/repo-cli` (`bun run beep refs plan\|refresh\|install-timer`) beside `commands/Graft/`. Reuse `internal/systemd/SystemdUnit.ts`, the `GraftDeep.service.ts` step/status/notification idioms, and the home-as-parameter rule. Generalize to a second theme only when one exists. |
| R9 | Refresh | **Nightly `systemd --user` timer at `03:30`** (beep's own deep refresh fires at 02:30), rendered by `beep refs install-timer`. Per member: `git pull --ff-only` only when clean and on `main` (otherwise skip and report); deep members run `graft build --deep --allow-partial -j N`; structural members run `graft build`. Reuse means only changed files are re-summarized. Unit uses `EnvironmentFile=$HOME/.config/beep-graft/env` and the same `env -i` allowlist as the GraftDeep unit. |
| R10 | Seed | The execution session **installs the timer and starts the unit once** (`systemctl --user start`). The opus-5 seed runs detached under systemd. The session verifies the structural tier and a federated `graft ask`; the deep tier is confirmed the next morning from the status file. No foreground deep build. |
| R11 | Lanes | **Fable 5.1 orchestrates.** Implementation lanes run on **Codex `gpt-6-astra` at `medium`** (`codex exec --model gpt-6-astra -c 'model_reasoning_effort="medium"'`), matching the ratified `codex.heavy × codex-cli` binding. `claude-opus-5` is spent only on the graft deep pass. |
| R12 | Packet | `goals/effect-reference-workspace/` from `goals/_template`, authored in a worktree of **beep-effect2** (beep-effect0 is the read-only graft owner clone and must not host lanes). Provenance: this grill, no exploration packet. Completion gate: yeet PR. |
| R13 | Docs sweep | **Live surfaces only.** `AGENTS.md` (Tool Routing bullet; graft block gains the reference routing line), `README.md` §"First-party history vs `.repos/effect`", `standards/effect-first-development.md`, `standards/schema-first-development-prompt.md` (drop the `.repos/effect-v4` hedge), `.claude/skills/{effect-first-development,schema-first-development,atom-reactivity-specialist,graft}/SKILL.md`, `.claude/agents/effect-first-developer.md`, `docs/runbooks/graft-local-recovery.md`, `greptile.json`, `scripts/knowledge-refs-rewrite.rules.json`, and the tests `setup-effect-ref.test.ts` / `worktree-fleet.test.ts`. `explorations/**` and `goals/**` history are frozen. |
| R14 | Home surfaces | **Operator-ratified follow-ups, not agent writes:** `~/.claude/rules/effect-coding-standards.md` (stale `.repos/effect-v4` / effect-smol pointer) and any memory pointer naming `$HOME/YeeBois/dev/effect`. Listed in `SPEC.md`; the operator applies them. |

## Non-negotiables

- Design order is schema → `Context.Service` contract → implementation. `LiteralKit` for member
  tiers and refresh outcomes; `HashMap`/`HashSet` only; never a plain `Set`/`Map`.
- Effect generators use `Effect.fn` / `Effect.fnUntraced`; `home` is a parameter, never
  `os.homedir()` at a call site.
- Reference clones are pull-only mirrors from the tooling's point of view. The refresh never
  resets, rebases, stashes, or checks out; a dirty or off-`main` member is skipped and reported.
- No writes into upstream clones' tracked files: `graft/` is excluded via `.git/info/exclude`,
  never `.gitignore`; `graft init` is never run.
- `$HOME` writes are limited to the rendered timer units under `$HOME/.config/systemd/user/`, the
  status file under `$HOME/.local/state/beep/refs/`, and the `.repos/*` symlinks inside beep
  checkouts. The provider env file is read, never written.
- Never run `graft build --deep` from an interactive agent session (AGENTS.md graft block).

## Graft facts the design relies on (v0.18.0, `$HOME/YeeBois/dev/Graft`)

| Fact | Source |
| --- | --- |
| A parent is a workspace when it has no `.git` and ≥ 2 git children; `graft build` there builds each child into its own `graft/` and writes `graft/workspace.json` | `src/graph/workspace.ts:1-24`, `isWorkspaceBuildRoot` at `src/graph/workspace.ts:97-101` |
| Child discovery uses `Dirent.isDirectory()` and `existsSync(<child>/.git)`, skipping dot-dirs; a symlinked child is **not** discovered (why R1 moves instead of linking) | `discoverWorkspaceChildren`, `src/graph/scopes.ts:329-341` |
| Parent `ask` fuses per-child rankings with reciprocal-rank fusion; `grep`/`map`/`check`/`callers` run per child and merge, labeled `<child>/` | `src/graph/workspace.ts:9-17`, `src/ask/fuse.ts:25-29` |
| `--follow-nested-repos` folds clones into one graph and persists in `.graft/config.json`; README says prefer the split "when you want each repo scored and refreshed on its own" | `src/cli.ts:345-352`, `README.md:477-484` |
| Commands walk up to the nearest `graft/`, so a beep checkout's `graft ask` never reaches the reference graph without an explicit `[dir]` | `README.md:491-493`, `src/cli.ts:149` |
| `--only-dir` is recorded in the graph fingerprint and honored by later no-flag builds | `src/cli.ts:361-367` |
| `graft build` writes `graft/` into `.gitignore` unless `--no-gitignore` / `GRAFT_NO_GITIGNORE=1` | `src/cli.ts:369` |
