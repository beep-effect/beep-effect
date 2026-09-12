# Cursor lane recipe (D13)

`cursor-agent` (alias `agent`) is installed at `$HOME/.local/bin` and logged
in. It is a headless Bash lane like `codex exec`, not a proxy provider
(CLIProxyAPI has no Cursor executor). Use it for fixer shards so the Cursor
subscription drains alongside Codex.

## Smoke test (P1, before any real lane)

Run from the worktree root:

```sh
cursor-agent -p --trust --force --sandbox enabled \
  --model gpt-5.6-sol-xhigh --output-format stream-json \
  "Create goals/tsgo-045-effect-idiom-sweep/history/cursor-smoke.txt containing the single line OK, run 'bun run beep --help' and report its first line, and do not run any git command." \
  </dev/null > "$SCRATCH/cursor-smoke.ndjson" 2>&1
```

Pass criteria, recorded in `history/2026-09-12-cursor-smoke.md`:

- the file exists with `OK`;
- the transcript shows the `bun run beep --help` output;
- `rg -c '"command":"git' "$SCRATCH/cursor-smoke.ndjson"` is 0;
- `git status --porcelain` shows only the smoke file;
- note whether `--sandbox enabled` blocked any needed write; if it did,
  rerun with `--sandbox disabled` and record that the lane then relies on
  worktree isolation and the no-git rule alone.

## Real lane

```sh
cursor-agent -p --trust --force --sandbox <mode from smoke> \
  --model claude-fable-5-thinking-xhigh --output-format stream-json \
  "$(cat ops/prompts/20-fixer-shard.agent.md | sed -e "s/{{SHARD_ID}}/L03-capability/g" ...)" \
  </dev/null > "$SCRATCH/L03.ndjson" 2>&1
```

- Inject placeholders before launch; never pass secrets.
- Seat choice: `gpt-5.6-sol-xhigh` or `claude-fable-5-thinking-xhigh`
  (marked NO ZDR in the Cursor catalog; the repo is public, so nothing
  confidential enters a lane).
- The lane prompt already forbids git; the orchestrator stages by name.
- Alternate shards between this lane and `60-codex-lane.md`.
