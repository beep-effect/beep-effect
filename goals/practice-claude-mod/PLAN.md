# Practice Claude Code Mod Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Scaffold `apps/practice-claude-mod/**` with `create-package`; register practice-kg on the operator machine against the current bundle; read the engine's `ToolUse`, `AbovePrompt` and assistant-row props in the bundled `claude-code.d.ts`; prove an empty Effect-bundled plugin loads on both machines. | Package scaffolded; load proven on Linux and the attorney's Windows PC; props contract recorded in `history/`. |
| P1 Implement | pending | First slice: tool-phrase rows and verdict capture; then matter band + visible timer; then the five ported skills. Each step is built, validated and loaded on the operator machine before the next. | SPEC acceptance items for rows, verdicts, band, timer and skills pass on the operator machine. |
| P2 Verify | pending | Release check (`claude plugin validate` envelope, `claude plugin test` on terminal + desktop, bundle size), `package-verify`, then deliver the build to the attorney PC's directory marketplace and repeat the row + verdict checks there. | Verification matrix green; redacted evidence from both machines in `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- The mods authoring reference ships with Claude Code (the `plugin-authoring`
  skill and its `types/claude-code.d.ts`); validate API shapes there, never
  from memory. The API is early access and moves between releases.
- Reaching the attorney's PC: use the operator's private notes for host
  access; never commit machine names, addresses or private paths.

## Verification Commands

```sh
test "$(wc -m < goals/practice-claude-mod/GOAL.md)" -le 4000
jq . goals/practice-claude-mod/ops/manifest.json
rg -n "practice-claude-mod|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-claude-mod
git diff --check -- goals/practice-claude-mod
bun run beep quality package-verify @beep/practice-claude-mod
claude plugin validate apps/practice-claude-mod/dist/plugin
claude plugin test apps/practice-claude-mod/dist/plugin
```
