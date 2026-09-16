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
| `a=gi; ${a}t status` | allow at round 2 (runtime expansion); deny from round 3 |
| `rg -n legit docs/*.md` | allow |

## Round 3 — expansion and unreadable payloads

Review finding (PR #1162, CodeRabbit, CWE-284): `a=su; ${a}do ...` built `sudo` from parameter
expansion and passed. Fix: deny any shell expansion (`$` followed by a name, digit, `{`, `(`,
special parameter, or quote) and any backtick, and deny a payload without a string `command`.
All 27 command fixtures and five payload fixtures match.

| Command | Decision |
| --- | --- |
| `a=gi; ${a}t status` | deny |
| `a=su; ${a}do ls` | deny |
| `p=pk; ${p}exec ls` | deny |
| `set -- sudo; $1 ls` | deny |
| `$'\x73udo' ls` | deny |
| `x=$(printf 'c3VkbwLL' \| base64 -d); $x ls` | deny |
| `echo $HOME` | deny (intentional: every expansion is refused) |
| `grep -nE 'end$' docs/runbooks/agent-pools.md` | deny (intentional: indistinguishable from `$'...'`) |
| `jq -r .command lane.ndjson` | allow |
| `python3 -c "import os; os.system('su' + 'do ls')"` | allow (known limit: interpreter-level construction) |

| Payload | Decision |
| --- | --- |
| truncated JSON | deny |
| empty stdin | deny |
| `{"cmd":"git status"}` | deny |
| `{"command":null}` | deny |
| `{"command":""}` | allow |

The known limit is covered by two backstops: the post-lane git state diff (HEAD, branch and stash
refs, index digest) in the runbook, and the YubiKey touch on per-terminal sudo tickets.

Run: `jq -cn --arg c "<command>" '{hook_event_name:"beforeShellExecution",command:$c}' |
.cursor/hooks/deny-shell.sh`. The adapter change from the same review (decision printed before the
3 s-capped writer) was re-smoked: stdout `{"permission":"allow"}`, one `cursor-cli` `PreToolUse`
row in an isolated ledger.
