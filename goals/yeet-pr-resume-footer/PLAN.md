# Yeet PR resume footer Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete (2026-09-03) | Recover the removed feature's history, the CSF-007 constraint, and the harness identity available at publish time; grill the design. | `research/2026-09-03-exploration.md`, `research/2026-09-03-design-panel.md`, and `DECISIONS.md` exist. |
| P1 Implement | in-progress | Ship PR 1 per `SPEC.md`: exact-identity detection, registry, footer v2 + ledger, post-create stamp, `yeet resume`, monitor re-assert, boundary test, CSF-007 note, changeset. | Acceptance criteria in `SPEC.md` are met on the feature branch. |
| P2 Verify | pending | `package-verify @beep/repo-cli`, `docgen:local`, focused vitest lanes; dogfood the footer on this packet's own PR. | Verification matrix green; live footer evidence recorded under `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish with `yeet publish --start-pr-early --monitor --pr` and drive to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Closeout reflection, packet-state flip, PR 2 handoff recorded. | Reflection exists; manifest and README updated; PR 2 surfaces listed in `history/`. |

## PR 2 (next phase of this packet after P4)

`yeet link [--pr n]`, verify/repair branch-keyed ledger rows, re-assert on
reply/closeout/merge, Codex-lane recipe `--add-dir <state root>`, Codex live
guard via `~/.codex/cross-instance-locks`, `yeet sweep --prune-pr-sessions`.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Fable orchestrates and publishes; Codex (Sol, medium effort) implements from
  the spec in this checkout on `feat/yeet-pr-resume-footer`; a Codex review
  pass precedes publish.
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/yeet-pr-resume-footer/GOAL.md)" -le 4000
jq . goals/yeet-pr-resume-footer/ops/manifest.json
rg -n "yeet-pr-resume-footer|GOAL.md|agentLaunchers|packetAnchorDocument" goals/yeet-pr-resume-footer
git diff --check -- goals/yeet-pr-resume-footer
bun run beep quality package-verify @beep/repo-cli
bun run docgen:local
```
