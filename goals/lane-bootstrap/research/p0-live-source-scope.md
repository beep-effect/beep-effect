# P0: live source scope and blocker

Date: 2026-11-06. Base: `origin/main` at `0966807d1c`.

## Verdict

P0 is complete. P1 is blocked on `goals/fleet-root-registry` P1, which has not
started: no lane, branch or PR implements it, and its manifest shows P1
`pending` on `origin/main`. The operator ruling
`goals/fleet-root-registry/decisions/2026-11-06-order-registry-first.md`
rejects running lane-bootstrap first, because it "would invent fleet-root and
registry stubs this packet then replaces". lane-bootstrap starts when that
packet's PR merges.

## What the dependency must provide

`rg -n -i "roots\.json|registry\.json|BEEP_FLEET_ROOTS|seatRole|owningSeat|drainStatus" packages/tooling`
returns no source hits, so none of these exist yet:

- the per-repository discovery-roots list (`BEEP_FLEET_ROOTS`, then
  `~/.local/state/beep/fleet/<repo-key>/roots.json`), which supplies the
  `<projects>/beep/lanes` root this goal targets;
- the registry overlay schema and writer (`seatRole`, `owningSeat`,
  `drainStatus`), which the lane-creation row needs;
- the scan auto-adoption that assigns role `adopted` to
  `.claude/worktrees` and Codex lanes (SPEC acceptance 3 depends on it).

## Live surfaces this goal will change

| Surface | Current behavior | Evidence |
| --- | --- | --- |
| Lane creator | The subcommand is `beep worktree new`, not `worktree add` as SPEC and GOAL say. P1 either renames it or adds `add` as the sanctioned name. | `bun run beep worktree --help` |
| Creation root | Sibling root `<clone>-worktrees/<name>` | `Worktree.command.ts:462`, `:513`, `:1097`; `Worktree.constants.ts:15` |
| Removal root | Same sibling derivation plus the nested `.claude/worktrees` root | `Worktree.service.ts:1540-1544` |
| Install | `bun install` with `linker = "hoisted"` in `bunfig.toml`; there is no backend assertion | `Worktree.command.ts:916` |
| Hardlinks | A fresh lane is already hardlinked: link count 92 on `node_modules/effect/package.json` and 322 on `node_modules/typescript/package.json`. P1 only adds the sampled assertion. | `stat -c %h` in lane `lane-bootstrap-p0` |
| Turbo cache | `TURBO_CACHE_DIR=~/.cache/beep/turbo` is already in the agent shell environment; config is read in `repo-cli-kit` `EnvConfig.ts:813`, `:949` and in `ResidueReap.ts:2450` | env, `rg TURBO_CACHE_DIR` |
| Graft seed | `Worktree.command.ts` has no graft step | `rg -n graft Worktree.command.ts` (no hits) |
| Conflict prediction | `worktree fleet` already describes conflict prediction, so the `would_conflict` decision may reuse it rather than add a new merge-tree probe | `bun run beep worktree --help` |

## Open P0 gate for the harness-hook decision

`decisions/2026-11-06-route-harness-worktrees-through-beep.md` requires a dry
hook that logs the `WorktreeCreate` and `WorktreeRemove` payloads before the
wiring lands. Installed Claude Code is 2.1.319; neither the repo nor the user
`.claude/settings.json` registers either event yet. The probe edits harness
settings, which `ai-sync` pins, so it runs as the first P1 step once the
registry lands, not in this P0 lane.
