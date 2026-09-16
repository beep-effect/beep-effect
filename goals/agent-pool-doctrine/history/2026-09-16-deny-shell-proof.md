# deny-shell.sh proof — 2026-09-16

Review finding (PR #1162, P1): `Shell(git)` in `.cursor/cli.json` matches only the first token.
Fix: `.cursor/hooks/deny-shell.sh` on `beforeShellExecution`, `failClosed: true`, basename match on
every token after splitting on whitespace, quotes, and shell operators.

| Command | Decision |
| --- | --- |
| `git status` | deny |
| `/usr/bin/git status` | deny |
| `env git status` | deny |
| `bash -lc "git commit -m x"` | deny |
| `sudo systemctl restart x` | deny |
| `FOO=1 pkexec ls` | deny |
| `echo hello` | allow |
| `bun run beep --help` | allow |

Run: `jq -cn --arg c "<command>" '{hook_event_name:"beforeShellExecution",command:$c}' |
.cursor/hooks/deny-shell.sh`. The adapter change from the same review (decision printed before the
3 s-capped writer) was re-smoked: stdout `{"permission":"allow"}`, one `cursor-cli` `PreToolUse`
row in an isolated ledger.
