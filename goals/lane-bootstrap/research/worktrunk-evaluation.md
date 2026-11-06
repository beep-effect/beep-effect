# Worktrunk Evaluation

Date: 2026-11-06. Reference checkout: `~/YeeBois/dev/worktrunk` at `6fdb42ab3`
(2026-11-06, Cargo version 0.81.0). Public docs: <https://worktrunk.dev>.
License: MIT OR Apache-2.0 (permissive; patterns may be ported with attribution,
nothing is vendored here).

## Question

Worktrunk is a popular git-worktree manager "designed for running AI agents in
parallel". The operator asked whether `lane-bootstrap` should adopt it, port
its best patterns into the Effect CLI, or ignore it.

## Verdict

Do not adopt it as the lane creator and do not re-implement it. Harvest five
patterns into this packet (ranked below). Two of them amend decisions the
exploration took on 2026-10-05; those amendments are recorded as decision files
in `decisions/`.

## What Worktrunk is

- A Rust CLI, about 170k lines across `src/`, 5.5k commits between 2025-10-16
  and 2026-11-06, one primary author. Shipped in Arch `extra` (0.80.0 at the
  time of writing), Homebrew, cargo, winget, conda.
- Worktrees are addressed by **branch**; the path is a MiniJinja template over
  repo and branch variables (`worktree-path`, user config). State a path cannot
  carry is stored per branch in git config (`worktrunk.state.<branch>.*`),
  caches and logs under `.git/wt/`.
- Lifecycle **hooks** (`pre-`/`post-` x `switch`, `start`, `commit`, `merge`,
  `remove`) as shell templates in `.config/wt.toml` or user config. `pre-*`
  blocks, `post-*` runs detached with logged output. Project hooks need a
  one-time approval recorded in `~/.config/worktrunk/approvals.toml`.
- `wt step copy-ignored`: copies gitignored material from the primary worktree
  into a new one, **reflinked** on APFS, btrfs, XFS and ReFS; `.worktreeinclude`
  narrows the set.
- `wt list`: progressive table with working-tree flags, ahead/behind, forge CI
  and review state, and two local predicates computed with no network:
  `integrated` (content already in the default branch via different history:
  merge-tree, cherry, patch-id) and `would_conflict` (dry `git merge-tree`
  against the default branch). `--format=json` emits a versioned envelope
  (schema 2).
- `wt merge`: local commit, squash, rebase, pre-merge hooks, fast-forward,
  remove. `wt step prune`: bulk removal of integrated worktrees with a
  `--min-age` guard (default one day) so a lane just cut from main is not read
  as merged.
- `wt step tether`: run a command and kill its process tree when the worktree
  disappears, even when another tool removed it.
- Agent plugins. The Claude Code plugin registers `WorktreeCreate` and
  `WorktreeRemove` hooks so worktrees the harness creates for
  `isolation: "worktree"` are born through `wt switch --create` and removed
  through `wt remove`; a `PermissionRequest` hook auto-approves entering a
  worktree that sits where the template puts its branch. Session hooks write a
  per-branch activity marker shown in `wt list`. Codex, Pi, OpenCode and
  Gemini get markers and a configuration skill.
- Extension: `[aliases]` templates and `wt-<name>` executables on `PATH`
  become subcommands (the `git-foo` convention).
- Engineering doctrine worth reading (`AGENTS.md`): fail rather than
  force-remove across a check-then-act gap; cleanup is a separate action, never
  a side effect; plumbing and exit codes over parsing porcelain; immutable
  object ids over list positions; network only when asked; approvals select an
  immutable plan once, never re-read config mid-operation.

## What beep already has

`packages/tooling/tool/cli/src/commands/Worktree/` (about 9k lines):
`worktree new` (sibling worktree from `origin/main`, submodules, `bun install`,
regenerate merge driver, local-only file copy, reference symlinks),
`worktree remove --archive` (tracked patch, untracked tree and `.beep` material
preserved under `refs/archive/worktrees/*` plus a residue root, live-checkout
fence shared with `yeet sweep --retire`), `worktree restore-material`,
`worktree doctor`, `worktree fleet` (derived mirror of every checkout),
`worktree reap`, `quality residue-reap` and `tmpfs-reap`. `yeet` owns commit,
push, PR, review threads and merge; `main` is PR-only.

`explorations/fleet-coordination/research/T1-prior-art.md` already classified
Worktrunk (with uzi, gwq, amux, agentree) as "worktree lifecycle managers:
pure ergonomics, not coordination". That classification stands.

## Why not adopt it

1. **The removal side has no counterpart.** Archive residue, the live-checkout
   fence, the `yeet sweep --retire` handshake, systemd proof units that pin
   lanes and the packet registry are all beep-specific. Wrapping `wt` for
   creation would leave two layout authorities, which is the sprawl this packet
   exists to end (223 checkouts at census).
2. **State scope.** Worktrunk's state lives in one repository's `.git`. The
   lane registry must span seats (several clones), so it belongs under
   `~/.local/state/beep` as `registry-implementation` decided.
3. **Overlap with yeet.** `wt merge`, LLM commit messages, the picker and the
   statusline solve problems yeet, commitlint and PR-only `main` already own.
4. **Surface cost.** A Rust binary on every agent surface (cloud bootstrap,
   Codex sandbox, Junie, Cursor) buys path templating that
   `Worktree.service.ts` already does in a few lines.

## Why not re-implement it

Most of its bulk is the interactive picker, shell integration, forge polling,
LLM commits and the merge pipeline. None of that is in the lane-bootstrap
mission. The valuable parts are small ideas, listed next.

## Patterns to harvest, ranked

| # | Pattern | Worktrunk source | Beep landing | Effect on this packet |
| --- | --- | --- | --- | --- |
| 1 | Route harness-created worktrees through the sanctioned creator via Claude Code `WorktreeCreate`/`WorktreeRemove` hooks | `plugins/worktrunk/hooks/hooks.json`, docs `claude-code.md` "Worktree isolation" | `.claude/settings.json` hooks calling `beep worktree add`/`remove` | Amends `desktop-app-lanes` (adopt, never fight): adopt only lanes the hooks cannot reach. Decision file `2026-11-06-route-harness-worktrees-through-beep.md`. Verify the installed Claude Code emits both events before wiring. |
| 2 | Local `integrated` and `would_conflict` predicates via `git merge-tree`, cherry, patch-id | `src/git/repository/integration.rs`, docs `list.md` "Default branch" | `worktree fleet` and the drainable class in residue-reap | Beep squash-merges, so ancestry checks lie and `mergedAtHead` needs the forge. The local checks give drain-on-empty an offline fallback and the base-conflict P0 inbox an early signal. Decision file `2026-11-06-local-integration-and-conflict-predicates.md`. |
| 3 | Reflink seeding of ignored material from the owning seat | `wt step copy-ignored`, docs `step.md` "Copy-on-write" | the bootstrap seed step (graft seed source already decided) | `/home` is btrfs here (`stat -f`), so `cp --reflink=always` of `node_modules` and built `dist` trees is nearly free. Measure first: Bun hardlinks already dedupe installs and the shared turbo cache restores dists, so the win may be install wall-clock only. Stays inside the no-new-install-backend non-goal. |
| 4 | Reaper min-age guard | `wt step prune --min-age` | drainable class in residue-reap (`legacy-drain`) | Prevents a lane just cut from `main` from being read as merged. Cheap; record in `legacy-drain` when it starts. |
| 5 | Branch-addressing shortcuts (`pr:N`, `^`, `-`) | docs `switch.md` "Shortcuts" | `beep worktree add pr:<n>` / `open pr:<n>` | Shortens orphaned-PR takeovers. Nice-to-have; no decision needed. |

Not harvested, with reasons:

- TOML shell hooks with an approvals file: bootstrap steps here are typed Effect
  code in one repository; a hook language and approval store add surface
  without a second consumer.
- LLM commit messages and `wt merge`: commitlint, yeet and hosted CI own them.
- `tether`: beep's problem is the inverse (units pin lanes, the reaper checks
  units before trees); already handled by the drainable predicate.
- Per-branch state in git config: correct for a single-repo tool, wrong for a
  registry that spans seats.

## Operator-facing recommendation

Do not install `wt` on the workstation as a second lane creator. If it is
installed for personal use, set `worktree-path` to the fleet lanes directory
and add a `post-start` hook that runs the beep adoption pass, so the registry
stays the single source of truth.
