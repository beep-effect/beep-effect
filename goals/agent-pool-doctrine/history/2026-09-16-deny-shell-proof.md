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

## Round 2 — escape and quote-splice evasions

Review finding (PR #1162, P2): the round-1 tokenizer turned quotes into whitespace and never
normalized backslashes, so `\git`, `g"i"t`, and `var=git; $var` passed. Fix: delete `\`, `"`, and
`'` before splitting; treat `;&|(){}<>`, backticks, `$`, `=`, newline, and tab as separators;
`set -f` so tokens never glob against the workspace. All 18 fixtures match (the eight above plus
these ten).

| Command | Decision |
| --- | --- |
| `\git status` | deny |
| `g"i"t status` | deny |
| `g'i't status` | deny |
| `bash -c git\ status` | deny |
| `var=git; $var status` | deny |
| ``echo `git rev-parse HEAD` `` | deny |
| `echo $(git status)` | deny |
| `echo git` | deny (intentional: argument mentions count) |
| `a=gi; ${a}t status` | allow (known limit: runtime expansion; post-lane git state diff is the backstop) |
| `rg -n legit docs/*.md` | allow |

Run: `jq -cn --arg c "<command>" '{hook_event_name:"beforeShellExecution",command:$c}' |
.cursor/hooks/deny-shell.sh`. The adapter change from the same review (decision printed before the
3 s-capped writer) was re-smoked: stdout `{"permission":"allow"}`, one `cursor-cli` `PreToolUse`
row in an isolated ledger.
