# Effect Reference Workspace Spec

## Objective

One consolidated reference folder, selected by `rootDefault` or `BEEP_REFERENCES_ROOT`, holds
the upstream Effect clones agents read as truth (`effect`, `effect-tsgo`), indexed by graft in **workspace mode** and
refreshed nightly with a `claude-opus-5` deep tier. Every beep-effect checkout, including every
fleet worktree, reaches it through three stable links: `.repos/effect` (child), `.repos/effect-tsgo`
(child), and `.repos/effect-workspace` (federated parent). Membership is a checked-in manifest;
adding a repo is one entry and one command. Grilled 2026-09-25
(`research/2026-09-25-00-aligned-design.md`, rulings R1–R14); no source exploration packet.

## Non-Goals

- A mega-graph (`--follow-nested-repos`), `graft init` at any level, or a graft MCP server (R3).
- Indexing `effect-smol`, `t3code`, or `opencode` in this packet (R2). The manifest must make
  adding them trivial; admitting them is a later decision.
- A theme-agnostic tool outside beep-effect (R8). One theme exists; generalize when a second does.
- Editing operator-owned `$HOME` files other than rendering the timer units, writing the status
  file, and creating `.repos/*` links (R14). `~/.claude/rules/*` and memory files are follow-ups.
- Running `graft build --deep` in the foreground of any agent session (R10).
- Rewriting frozen `explorations/**` or `goals/**` prose that names the old path (R13).
- Fixing the nix-devshell bun / DuckDB loader clash recorded in
  `research/2026-09-25-01-current-state.md`. Lanes work around it.

## Source Hierarchy

1. The operator's objective as recorded in `research/2026-09-25-00-aligned-design.md` (R1–R14,
   non-negotiables). Cite rulings as `(Rn)`.
2. `AGENTS.md`, `CLAUDE.md`, and the `graft` skill (routing rules, denied graft commands).
3. `standards/ARCHITECTURE.md`, `standards/effect-first-development.md`.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. `research/2026-09-25-01-current-state.md`, `research/2026-09-25-02-fleet-census.md`,
   `research/SOURCES.md`.
7. Reused implementation idioms: `packages/tooling/tool/cli/src/commands/Graft/GraftDeep.service.ts`,
   `packages/tooling/tool/cli/src/internal/systemd/SystemdUnit.ts`,
   `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts`,
   `scripts/setup-effect-ref.sh`.

Higher sources outrank lower sources when they conflict.

## Domain Model

Schema first (R11 non-negotiables). Names are binding; field shapes are the implementer's call
within these constraints.

- **`ReferenceMember`** — `name` (directory name under the theme root, also the `.repos/<name>`
  link name), `url` (clone URL), `tier` (`LiteralKit(["deep", "structural"])`), optional
  `onlyDir` (repo-relative paths passed as repeated `--only-dir`). No branch field: R9 refreshes
  `main` only, so the schema cannot describe a member the refresh would always skip.
- **`ReferenceWorkspaceManifest`** — `schemaVersion: "beep-references/v1"`, `theme` (`"effect"`),
  `rootDefault` (`"$HOME/YeeBois/references/effect"`, written with `$HOME`, resolved against the
  `home` parameter), `members: ReadonlyArray<ReferenceMember>`, `workspaceLink`
  (`".repos/effect-workspace"`). Lives at `scripts/references.json`; the bash provisioner and the
  CLI both read it.
- **`MemberRefreshOutcome`** — `LiteralKit(["pulled", "unchanged", "skipped-dirty",
  "skipped-off-branch", "pull-failed", "build-failed"])`. A status string only.
- **`MemberRefreshReport`** — `name`, `outcome: MemberRefreshOutcome`, optional `coverage` (the
  graft deep-build coverage parsed with the existing `Graft.schemas.ts` helpers; absent for
  structural members and for any outcome that never reached the build step).
- **`RefsRefreshStatus`** — `schemaVersion: "beep-refs-refresh/v1"`, timestamp, root, one
  `MemberRefreshReport` per member, workspace `graft check` result. Written to
  `$HOME/.local/state/beep/refs/last-refresh.json`.
- **`ReferenceWorkspace`** (`Context.Service`) — `plan(home, root)` (what would be cloned, linked,
  built; no writes), `refresh(home, root, jobs)` (pull → build per member → `graft build` at the
  parent → status file → critical Plasma notification on any failure, GraftDeep idiom),
  `linkInto(checkoutRoot, root)` (create or repair the three links; the step `beep worktree new`
  calls), `renderTimerUnits(home, root, calendar, bunPath)`.

Operational shell path parameters (`refs_root`, `refs_old_effect`, `refs_old_tsgo`,
`refs_linked_worktree`, and `refs_projects`) are defined in `PLAN.md` before the slices.
They name the same locations recorded by R1, R6, and the frozen fleet census.

## Target Surfaces

- `scripts/references.json` (new) and `scripts/setup-effect-ref.sh` (rewritten as the manifest-
  driven provisioner; keep the filename so existing docs and the test path stay valid) (R6).
- `packages/tooling/tool/cli/src/commands/Refs/**` (new group: schemas, errors, service,
  command) registered in the CLI root; `bun run beep refs plan|refresh|install-timer` (R8, R9).
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts`: a `linkReferences` step
  in `runWorktreeNew` after `copyLocalFiles`, reported in the creation summary (R7).
- Tests: `test/setup-effect-ref.test.ts` (manifest-driven, still no GNU `realpath`),
  `test/worktree-fleet.test.ts` if fleet surfaces change, new `test/refs-*.test.ts` for schemas,
  refresh planning, unit rendering, and the worktree step.
- Docs (R13): `AGENTS.md` Tool Routing bullet and the graft block's new routing line
  (`graft ask "<q>" .repos/effect-workspace` for Effect API questions; `.repos/effect` narrows),
  `README.md` §"First-party history vs `.repos/effect`", `standards/effect-first-development.md`
  prose, `standards/schema-first-development-prompt.md` L64-66, the four skill/agent files,
  `docs/runbooks/graft-local-recovery.md` (cross-link to the refs timer),
  `docs/runbooks/systemd-timers.md` (new unit), `greptile.json` (add
  `.repos/effect-tsgo/**`, `.repos/effect-workspace/**`), `scripts/knowledge-refs-rewrite.rules.json`.
- `.claude/settings.json` permissions: `Bash(bun run beep refs plan:*)`,
  `Bash(bun run beep refs install-timer --refresh:*)` allowed; `refresh` and a fresh
  `install-timer` denied for agents, mirroring the graft deep policy.
- Operator move (P1 S4, executed by the session, not a Codex lane): `"$refs_old_effect"` and
  `"$refs_old_tsgo"` → `$refs_root/`; `git worktree repair`;
  `.git/info/exclude` entries; prune the stale 2026-09-12 extract/fingerprint pair; `graft build`
  at the parent; fleet relink; timer install and single start (R1, R3, R7, R10).

## Constraints

- Design order schema → `Context.Service` → implementation; `LiteralKit`; `HashMap`/`HashSet`
  only; `Effect.fn`/`Effect.fnUntraced`; `home` is a parameter.
- The refresh is non-destructive toward members: `--ff-only` on `main` only; dirty or off-branch
  members are skipped and reported, never reset.
- `graft/` is excluded per child via `.git/info/exclude`; builds run with `GRAFT_NO_GITIGNORE=1`.
- The timer unit inherits the GraftDeep hardening: `env -i` allowlist (`HOME`, `PATH`, `CI`),
  `EnvironmentFile=` without a leading `-`, mise-shim bun resolution, unit-string validation for
  paths, `--ignore-scripts` on any install step.
- Deep builds use `--allow-partial` and report coverage; a degraded tier is a notification, not a
  crash loop.
- Lanes that call the beep CLI non-interactively prepend the mise bun to PATH (current-state
  §"Toolchain gotcha").
- Never run `graft init`, `graft build --deep`, or `beep refs refresh` from an agent session; the
  P1 S4 seed is the one sanctioned `systemctl --user start`.
- The 25+ primary clones and all fleet worktrees keep working through `.repos/effect` with no
  path edits to `standards/**` or `.claude/skills/**` link targets (R5).

## Acceptance Criteria

- [ ] `scripts/references.json` decodes as `ReferenceWorkspaceManifest` and lists exactly
      `effect` (deep) and `effect-tsgo` (deep).
- [ ] `bash scripts/setup-effect-ref.sh <checkout>` is idempotent and produces `.repos/effect`,
      `.repos/effect-tsgo`, `.repos/effect-workspace` pointing under `$BEEP_REFERENCES_ROOT`
      (default: the `rootDefault` value specified above).
- [ ] `bun run beep worktree new <name>` creates the three links in the new worktree and lists
      them in its summary.
- [ ] `bun run beep refs plan` prints the clone/link/build plan without writing;
      `bun run beep refs install-timer` renders `beep-refs-refresh.{service,timer}` for
      `*-*-* 03:30:00`; `--refresh` re-renders an installed unit; `--uninstall` removes both.
- [ ] `"$refs_root/graft/workspace.json"` exists with children `effect`,
      `effect-tsgo`; `graft check "$refs_root"` passes; a federated
      `graft ask "Effect.fn vs fnUntraced" .repos/effect-workspace` returns `[effect/]`-labeled hits
      from a beep checkout.
- [ ] Fleet census after relink shows zero `missing` for live checkouts.
- [ ] The timer's first run (started once by the session) writes
      `$HOME/.local/state/beep/refs/last-refresh.json`; the next-morning check shows a deep tier
      (`effect/graft/manifest.json` present with concept nodes) or a recorded partial-coverage
      notification.
- [ ] No `.gitignore` in any reference clone is modified; `git -C <member> status --porcelain`
      is empty after a build.
- [ ] R13 docs sweep landed; `rg -n "YeeBois/dev/effect(-tsgo)?([^-A-Za-z0-9_]|$)|BEEP_EFFECT_CHECKOUT" --glob
      '!explorations/**' --glob '!goals/**' --glob '!graft/**' .` returns no matches (this
      packet's `research/` is inside `goals/**`, so it is excluded by construction).
- [ ] `SPEC.md` acceptance criteria are satisfied; no unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-reference-workspace/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-reference-workspace/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-reference-workspace` | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli --quick` | Green |
| Provisioner + worktree tests | `bun run --cwd packages/tooling/tool/cli test -- test/setup-effect-ref.test.ts test/worktree-fleet.test.ts test/refs-*.test.ts` | Green |
| Workspace index | `test -f "$refs_root/graft/workspace.json" && graft check "$refs_root"` | Passes |
| Federated query | `graft ask "Effect.fn vs fnUntraced" .repos/effect-workspace` from a beep checkout | Hits labeled `[effect/]` |
| Narrowed query | `graft ask "Schema.Class extend" .repos/effect` | Hits from `packages/effect/src/Schema.ts` |
| Fleet links | census loop in `PLAN.md` P2 | 0 `missing` |
| New worktree links | `bun run beep worktree new refs-link-probe` then `readlink .repos/effect-workspace` in it; remove the probe with `beep worktree remove` | Link present |
| Timer | `systemctl --user list-timers \| grep beep-refs-refresh` | Enabled, next run 03:30 |
| Seed run | `journalctl --user -u beep-refs-refresh -n 80`; status file present | Exit 0 or a reported partial tier |
| Upstream hygiene | `for m in effect effect-tsgo; do git -C "$refs_root/$m" status --porcelain; done` | Empty |
| Stale-path sweep | `rg -n "YeeBois/dev/effect(-tsgo)?([^-A-Za-z0-9_]\|$)\|BEEP_EFFECT_CHECKOUT" --glob '!explorations/**' --glob '!goals/**' --glob '!graft/**' .` | No matches (exit 1) |

## Stop Conditions

- A reference member is dirty, on a non-`main` branch, or has uncommitted work in a linked
  worktree at move time: stop and report; the operator decides.
- `git worktree repair` cannot re-attach `"$refs_linked_worktree"`.
- CLIProxyAPI returns `503 auth_unavailable` or `/v1/models` omits `claude-opus-5`: install the
  timer but do not start the seed; report.
- `$HOME/.config/beep-graft/env` is missing or `mise trust --show` is not clean (the unit would
  fail every night).
- The implementation would need to rewrite frozen `explorations/**` or `goals/**` prose, or any
  `$HOME` file outside the named surfaces.
- The same blocker repeats after reasonable investigation.

## Operator follow-ups (R14, not agent writes)

| File | Change |
| --- | --- |
| `~/.claude/rules/effect-coding-standards.md` | Replace the `effect-smol` / `.repos/effect-v4` sentence with `.repos/effect` (effect `main` is v4) and mention `.repos/effect-workspace` for graft. |
| Claude memory pointers naming `"$refs_old_effect"` | Update to `"$refs_root/effect"` after the move. |
| `~/.config/beep-graft/env` | None; reused as-is. If a separate env is ever wanted, copy it to `~/.config/beep-refs/env` and re-run `install-timer --env-file`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| The bash provisioner and the CLI both read `scripts/references.json` | R6/R8 | packet | A fresh clone must be able to link before `bun install` has run; the bash path stays for bootstrap, the CLI owns refresh and the timer | Retire the bash path when `beep worktree new` and a `beep refs link` command cover every bootstrap route |
