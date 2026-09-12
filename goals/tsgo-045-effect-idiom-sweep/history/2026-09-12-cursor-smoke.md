# Cursor lane smoke test — 2026-09-12

Recipe: `ops/prompts/50-cursor-lane.md`. Run from the worktree root with
`cursor-agent -p --trust --force --sandbox enabled --model gpt-5.6-sol-xhigh
--output-format stream-json`, stdin from `/dev/null`, transcript captured in
the session scratchpad as `cursor-smoke.ndjson`.

| Criterion | Result |
| --- | --- |
| `history/cursor-smoke.txt` exists with `OK` | pass (file written by the lane) |
| Transcript shows `bun run beep --help` output | pass (3 transcript lines reference the command; the lane reported the first output line `$ bun run packages/tooling/tool/cli/src/bin.ts -- --help`) |
| No git invocation in the transcript | 0: every `"command"` value was extracted (`grep -oE '"command":"[^"]*"'`, one distinct value: `bun run beep --help`) and none contains `git` anywhere, so shell-wrapped forms such as `bash -lc "git ..."` are covered too |
| `git status --porcelain` after the run | only the smoke file (plus this session's own edits) |
| `--sandbox enabled` blocked a needed write | no; the lane wrote the file and ran Bun under the sandbox |
| Exit code / wall time | 0 / 25.9 s |

Verdict: the Cursor lane is admitted as the second volume pool (D13). Real
lanes keep `--sandbox enabled`; the no-git rule is enforced by the prompt and
verified by the orchestrator from the transcript, as here.
