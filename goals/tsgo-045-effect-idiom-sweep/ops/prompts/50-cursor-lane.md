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
- no extracted `"command"` value contains `git` anywhere:
  `grep -oE '"command":"[^"]*"' "$SCRATCH/cursor-smoke.ndjson" | grep -cE '\bgit\b'`
  is 0 (this also catches shell-wrapped forms such as `bash -lc "git ..."`);
- `git status --porcelain` shows only the smoke file;
- note whether `--sandbox enabled` blocked any needed write. If it did, stop
  and report the blocked path; never rerun with `--sandbox disabled`
  (`--trust` and `--force` do not replace the sandbox boundary that keeps
  protected files and the network out of reach). The 2026-09-12 smoke test
  needed no such write.

## Real lane

```sh
cursor-agent -p --trust --force --sandbox enabled \
  --model claude-fable-5-thinking-xhigh --output-format stream-json \
  "$(sed -e "s/{{SHARD_ID}}/L03-capability/g" -e 's#{{SHARD_PATHS}}#packages/foundation/capability#g' goals/tsgo-045-effect-idiom-sweep/ops/prompts/20-fixer-shard.agent.md)" \
  </dev/null > "$SCRATCH/L03.ndjson" 2>&1
```

- Inject placeholders before launch; never pass secrets.
- Seat choice: `gpt-5.6-sol-xhigh` or `claude-fable-5-thinking-xhigh`
  (marked NO ZDR in the Cursor catalog; the repo is public, so nothing
  confidential enters a lane).
- The lane prompt already forbids git; the orchestrator stages by name.
- Alternate shards between this lane and `60-codex-lane.md`.
