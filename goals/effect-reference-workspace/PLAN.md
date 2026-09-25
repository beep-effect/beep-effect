# Effect Reference Workspace Plan

## Status

Status: `P0 complete, P1 pending` (2026-09-25). Packet authored in worktree
`effect-reference-workspace` of `beep-effect2`, branch `feat/effect-reference-workspace`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Grill and census (2026-09-25). | `research/2026-09-25-0{0,1,2}-*.md` recorded; R1–R14 locked. |
| P1 Implement | pending | Slices S1–S4 below, in order. | `SPEC.md` acceptance criteria met. |
| P2 Verify | pending | Run the verification matrix and capture evidence under `history/`. | Green, or blockers documented with command output. |
| P3 Yeet: PR to mergeable | pending | `bun run beep yeet publish --start-pr-early --monitor --pr`; drive to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Closeout reflection, packet state flip. | Reflection exists and lints; README/manifest updated. |

### P1 slices

Orchestrator: Fable 5.1 (R11). Implementation lanes: Codex `gpt-6-astra`, effort `medium`
(`codex exec --model gpt-6-astra -c 'model_reasoning_effort="medium"' -s workspace-write --cd <worktree>`;
add `--add-dir "$(git rev-parse --path-format=absolute --git-common-dir)"` and
`-c 'sandbox_workspace_write.network_access=true'` if the lane must commit). `claude-opus-5` is
spent only by the graft deep pass. Prepend the mise bun to PATH in every lane that runs the beep CLI
(current-state §"Toolchain gotcha").

1. **S1 Manifest + provisioner** (Codex lane). Add `scripts/references.json`
   (`beep-references/v1`, theme `effect`, members `effect` and `effect-tsgo`, both `deep`,
   `rootDefault` `$HOME/YeeBois/references/effect`, `workspaceLink` `.repos/effect-workspace`).
   Rewrite `scripts/setup-effect-ref.sh` to read it with `jq`-free POSIX parsing or a tiny
   `node -e`, keep the filename, keep idempotence and the no-GNU-`realpath` property, clone
   missing members into the root, and link `.repos/<member>` and the workspace link. Update
   `test/setup-effect-ref.test.ts` and regenerate `standards/effect-vitest.inventory.jsonc`.
   Env override `BEEP_REFERENCES_ROOT` replaces `BEEP_EFFECT_CHECKOUT` outright: no alias, so
   the R13 stale-path gate stays a hard no-match (nothing in the repo or the workstation
   dotfiles sets the old name; census 2026-09-25).
2. **S2 `beep refs` + worktree hook** (Codex lane). Schemas
   (`Refs.schemas.ts`: `ReferenceMember`, `ReferenceWorkspaceManifest`, `MemberRefreshOutcome`, `MemberRefreshReport`,
   `RefsRefreshStatus`) → `Refs.errors.ts` → `ReferenceWorkspace` service (`Refs.service.ts`,
   `Context.Service`, `home` parameter, `HashMap` by member name) → `Refs.command.ts`
   (`plan`, `refresh --root --jobs`, `install-timer --owner --on-calendar --bun-path --refresh
   --uninstall`). Mirror `GraftDeep.service.ts` for step running, output bounds, status file,
   critical notification, and unit rendering through `internal/systemd/SystemdUnit.ts`. Register
   in the CLI root. Add the `linkReferences` step to `runWorktreeNew` in
   `Worktree.command.ts` after `copyLocalFiles`, surfaced in `renderCreationSummary`. Add
   `.claude/settings.json` permissions per `SPEC.md`. Tests for schema decoding, refresh planning
   (dirty/off-branch skips), unit rendering, and the worktree step.
3. **S3 Docs sweep** (Codex lane, R13). Files listed in `SPEC.md` Target Surfaces. Prose says the
   reference workspace lives at `$HOME/YeeBois/references/effect` (provisioned by
   `scripts/setup-effect-ref.sh` from `scripts/references.json`), `.repos/effect` is the Effect
   child, `.repos/effect-workspace` is the graft target. Add the routing line to the AGENTS.md
   graft block. Cross-link `docs/runbooks/graft-local-recovery.md` and
   `docs/runbooks/systemd-timers.md`. No edits under `explorations/**` or `goals/**`.
4. **S4 Operator move** (executed by the orchestrating session after S1–S3 pass locally, with the
   operator present; not a Codex lane). Order:
   1. Exclude the graft artifacts first, because `git status --porcelain` lists untracked files
      and `effect` already carries an untracked `graft/`: `printf 'graft/\n.graft/\n' >>
      <member>/.git/info/exclude` for both members. Then the preconditions:
      `git -C $HOME/YeeBois/dev/effect status --porcelain` empty and on `main`; same for
      `effect-tsgo`; `$HOME/YeeBois/dev/effect-worktrees/docgen-enforce-examples` clean or
      operator-approved; proxy lists `claude-opus-5`; `mise trust --show` clean.
   2. `mkdir -p $HOME/YeeBois/references/effect`; `mv $HOME/YeeBois/dev/effect $HOME/YeeBois/references/effect/effect`;
      `mv $HOME/YeeBois/dev/effect-tsgo $HOME/YeeBois/references/effect/effect-tsgo`.
   3. `git -C $HOME/YeeBois/references/effect/effect worktree repair $HOME/YeeBois/dev/effect-worktrees/docgen-enforce-examples`;
      `git worktree list` shows both.
   4. Delete the stale `graft/.cache/extract.496c9d83e6eb3668.json` and
      `fingerprint.496c9d83e6eb3668.json` in the moved `effect` clone.
   5. `GRAFT_NO_GITIGNORE=1 graft build $HOME/YeeBois/references/effect` (structural, free) →
      `graft/workspace.json` + per-child `graft/`; `graft check` passes.
   6. Fleet relink: `for c in $HOME/YeeBois/projects/beep-effect*/ $HOME/YeeBois/projects/beep-effect*-worktrees/*/; do [ -e "$c/.git" ] && bash <worktree>/scripts/setup-effect-ref.sh "$c"; done`.
   7. `bun run beep refs install-timer --owner <worktree-or-main-clone>`; then the single
      sanctioned seed: `systemctl --user start beep-refs-refresh.service`. Do not wait on it.
   8. Record the move in `history/2026-09-xx-move.md` (commands run, `git worktree list`,
      `graft check` output, census counts).

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling** (what worked, what
   didn't, what was frustrating, what you wished existed), the **implementation** (improvement
   opportunities), and the **goal/prompt** (would you revise it to be clearer/easier/more
   efficient?). Capture TODOs worth codifying. Its YAML frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has `reflectionRequired: true`, so a
   missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase statuses +
   `initiative.status`.
4. Confirm the next-morning deep tier: `test -s $HOME/YeeBois/references/effect/effect/graft/manifest.json`
   and the status file's coverage; record in `history/`.

## Execution Notes

- `beep-effect0` is the read-only graft owner; never host a lane there.
- The nix devshell bun in `beep-effect2` cannot load the DuckDB binding; lanes prepend
  `$HOME/.local/share/mise/installs/bun/<pinned>/bin` (or the mise shim) to PATH.
- Preserve unrelated worktree changes. Keep `SPEC.md` normative; update only when the contract
  changes. Archive run outputs under `history/`.
- `graft build --deep`, `beep refs refresh`, and a fresh `install-timer` are never run from an
  agent session; S4 step 7 is executed with the operator present.
- When a second theme appears, revisit R8 before generalizing.
- Packet-only PRs stay on the docs-only heavy path only while every changed file matches the
  `HeavyAdmission.ts` docs pattern (`*.md`, packet `ops/manifest.json`, `docs/**`, `research/**`).
  The template's `history/**/.gitkeep` files do not match and force a `hold`; `_TEMPLATE.md`
  already keeps those directories, so this packet ships without them.

## Verification Commands

```sh
# packet
test "$(wc -m < goals/effect-reference-workspace/GOAL.md)" -le 4000
jq . goals/effect-reference-workspace/ops/manifest.json
rg -n "effect-reference-workspace|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-reference-workspace
git diff --check -- goals/effect-reference-workspace
# tooling
bun run beep quality package-verify @beep/repo-cli --quick
bun run --cwd packages/tooling/tool/cli test -- test/setup-effect-ref.test.ts test/worktree-fleet.test.ts test/refs-*.test.ts
# workspace (after S4)
test -f $HOME/YeeBois/references/effect/graft/workspace.json
graft check $HOME/YeeBois/references/effect
graft ask "Effect.fn vs fnUntraced" .repos/effect-workspace
graft ask "Schema.Class extend" .repos/effect
# fleet census
for c in $HOME/YeeBois/projects/beep-effect*/ $HOME/YeeBois/projects/beep-effect*-worktrees/*/; do
  [ -e "$c/.git" ] && printf '%s %s\n' "$c" "$(readlink "$c/.repos/effect-workspace" || echo missing)"; done | awk '{print $2}' | sort | uniq -c
# timer + seed
systemctl --user list-timers | grep beep-refs-refresh
journalctl --user -u beep-refs-refresh -n 80
jq . $HOME/.local/state/beep/refs/last-refresh.json
# upstream hygiene
for m in effect effect-tsgo; do git -C $HOME/YeeBois/references/effect/$m status --porcelain; done
# stale paths
rg -n "YeeBois/dev/effect|BEEP_EFFECT_CHECKOUT" --glob '!explorations/**' --glob '!goals/**' --glob '!graft/**' .
```
