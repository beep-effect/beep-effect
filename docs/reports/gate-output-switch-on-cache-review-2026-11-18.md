# Cache review for the agent keys in Turbo's global pass-through list

Reviewed on `fix/gate-output-switch-on` with `main` @ 2837e8944cc. Reviewer: Claude Opus 5.5
(gate-output-switch-on P1 lane). Goal: `goals/gate-output-switch-on`, fixes 1 and 2.

## Change

`turbo.json` `global.passThroughEnv` gains sixteen names: every presence key of the
`@beep/runtime-env` agent table (`AgentEnvKey`: `CLAUDECODE`, `CLAUDE_CODE`, `REPL_ID`,
`GEMINI_CLI`, `CODEX_SANDBOX`, `OPENCODE`, `AUGMENT_AGENT`, `GOOSE_PROVIDER`, `JUNIE_DATA`,
`JUNIE_SHIM_PATH`, `COPILOT_AGENT`, `COPILOT_CLI`, `CURSOR_AGENT`; `CODEX_THREAD_ID` was already
listed), plus `AI_AGENT`, `EDITOR` (the `devin` row's pattern variable) and `AGENT`, which the repo
CLI now exports to Turbo children under a detected agent so Bun's quiet mode switches on.

Nothing else in `turbo.json` changes: no task command, cache flag, input, output, `env` entry or
dependency edge.

## Audit before the record

`bun run beep cache audit` reports one blocking finding and one review:

```text
BLOCK global-configuration-drift: turbo-global-configuration
REVIEW configuration-source-drift: turbo.json
```

Restoring the committed `turbo.json` and keeping every other change clears both.

## Why reuse stays correct

`passThroughEnv` makes a variable visible to a task without making its value part of the task
hash. Measured with `bunx turbo run test --filter=@beep/glob --only --dry=json` on this head, once
with `CLAUDECODE` and `AI_AGENT` set and once with both unset: the task hash is identical. The only
difference is the informational list of present pass-through variables in
`globalCacheInputs.environmentVariables`.

So an agent run and a human run share one cache entry, as before. A cache hit replays the log of
whichever audience recorded it; that is why the repo CLI also passes `--output-logs=errors-only`
under a detected agent, so a green hit prints nothing (fix 2). The variables only change what a
tool prints (Vitest's agent reporter through std-env, Bun's quiet mode), never what a task
computes or writes, so a shared entry is still a correct result for either audience.

Editing the declaration itself changes Turbo's global hash, so every task misses once after this
change lands, as for any edit to the global block.

## Judgement

The change widens the variables tasks may read for output shape only. It grants no
qualification, changes no reviewed task configuration, and keeps the baseline scope, profile
`local-linux-x64-bun1.4.4` and epoch `qualification-v3`. Re-record the root subject `//` only.
