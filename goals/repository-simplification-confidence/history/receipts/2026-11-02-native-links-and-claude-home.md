# F-NATIVE-LINKS applied, F-CLAUDE held by the config freeze — 2026-11-02

Refs #1862. Operator ruling 2026-11-02: home-scope writes granted for F-NATIVE-LINKS and
F-CLAUDE (backed up; reverse by restoring the backup); F-JUNIE, F-GROK-COMPAT and
F-CLAUDEM closed as retained as-is; F-DOCKER and F-CURSOR wait on the operator's
launcher sign-ins.

## F-NATIVE-LINKS: applied

The retained "broken links" were enumerated live (`find … -xtype l` across `~/.agents`,
`~/.codex`, `~/.claude/skills`, `~/.claude/agents`, `~/.junie`, `~/.grok`, `~/.cursor`,
depth 3). Nineteen dangling links existed; the "extra Codex profiles" half of the
disposition has no live object any more (`~/.codex/config.toml` carries no
`[profiles.*]` table), so no frozen file was needed or touched.

Script: [`ops/2026-11-02-native-links-repair.py`](../../ops/2026-11-02-native-links-repair.py)
(`--dry-run` default, `--apply`, `--rollback <backup dir>`). Every link was copied with
`cp -P` semantics into the backup before it was replaced or removed; the backup's
`manifest.tsv` lists path, prior target and action.

| Link | Was | Action |
| --- | --- | --- |
| `~/.agents/skills/turborepo` | `../../.agents/skills/turborepo` (a self-loop; `~/.claude/skills/turborepo` and `~/.codex/skills/turborepo` resolve through it) | Repointed at the primary clone's vendored mirror `~/YeeBois/projects/beep-effect/.agents/skills/turborepo`. All three now resolve. |
| `~/.claude/skills/plasma-sensitive-entry` | a retired lane worktree path under `beep-effect-worktrees/` | Repointed at `~/YeeBois/projects/beep-effect/.claude/skills/plasma-sensitive-entry`. |
| `~/.codex/skills/effect-v4` | `~/.agents/skills/effect-v4` (no such skill anywhere on the workstation since 2026-02) | Removed. |
| `~/.grok/skills/memory-*` (15 links) | `../../.agents/skills/memory-*` (the memory skill pack left with the 2026-08-29 memory-service removal) | Removed. |

Result: zero dangling links remain under the scanned roots; a second `--dry-run`
prints `nothing to repair`.

- Backup: `~/.config-backups/rsc-f-native-links.20261102T034514Z/` (18 link copies plus
  `manifest.tsv`).
- Restore: `python3 goals/repository-simplification-confidence/ops/2026-11-02-native-links-repair.py --rollback ~/.config-backups/rsc-f-native-links.20261102T034514Z`
  (refuses when a live path is no longer the link the script wrote).

Consumer inspection, the disposition's other reconsideration gate, is a usage witness
per client and was not run here; the links now resolve, which is what the retained
disposition waited on.

## F-CLAUDE: stopped by the config freeze

`bun run beep models apply` (preview, no write) lists exactly one Claude home change:
`home.claude.settings [json-key] change=true expected=claude-fable-5-1` (the live
`~/.claude/settings.json` `model` is `opus`; its `effortLevel` is already `medium`).
Every other `home.claude.*` and `home.agents.impeccable.*` target previews
`change=false` or `manual verification required; recognized drift=false`.

That one write targets `~/.claude/settings.json`, which the operator froze until
2026-11-04T03:10Z so the shrunk qualification windows can fill. Per the brief, the step
stopped: no `--write` ran, no backup was taken, no Claude home file changed. Apply after
the freeze with `bun run beep models apply --write` (the writer backs up and journals
the replacement under `~/.config-backups/`, and `beep models restore` reverses it). The
retained plugins, literal-header configuration, memory and clone-local policy named by
F-CLAUDE are unchanged.

`home.grok.config [toml-table-key] change=true expected=medium` also previews, but
F-GROK-COMPAT is closed as retained as-is by this ruling, so it was not written either.

## Closed as retained as-is (per the ruling)

- F-JUNIE: launch model and Auto mode preserved; no guidelines witness sought.
- F-GROK-COMPAT: native compat fields preserved; the `home.grok.config` preview drift is
  recorded above and left in place.
- F-CLAUDEM: opt-in, unowned wrapper, no manifest binding.

## Still open (#1862)

- F-DOCKER and F-CURSOR: operator launcher sign-ins.
- F-CLAUDE: the single `home.claude.settings` write, after the freeze lifts.
