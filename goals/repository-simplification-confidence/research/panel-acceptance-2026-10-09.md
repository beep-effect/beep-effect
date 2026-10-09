# Workstream F panel acceptance probes (2026-10-09)

Account and model acceptance for the three-model panel (SPEC.md "Model
assignments": validate account/model acceptance before substantive reviewer
runs; generic CLI help is insufficient). The orchestrator ran each probe from
its session scratchpad between 2026-10-09T13:48Z and 13:53Z; no repository
state was touched. Raw logs are kept as a private operational receipt in the orchestrator
briefs directory (`panel/2026-10-09/`, not tracked):
`codex-gpt-6-astra-xhigh.log`, `claude-fable-5-1-xhigh.log`,
`claude-fable-5-1-xhigh.rerun.log`, `grok-4.7-xhigh.log`.

| Member | Command (effort flag) | Result | Launch evidence | Status |
| --- | --- | --- | --- | --- |
| `gpt-6-astra` xhigh (Codex) | `codex exec -m gpt-6-astra -c 'model_reasoning_effort="xhigh"' -s read-only` | replied `PANEL-OK`, exit 0, 25,460 tokens | the Codex rollout file for the 2026-10-09T08:49:05 run (Codex sessions store; kept with the private panel logs) records `"model":"gpt-6-astra"` (x5) and `"reasoning_effort":"xhigh"` | ACCEPTED |
| `claude-fable-5-1` xhigh (direct Claude CLI, separate session) | `claude --model claude-fable-5-1 --settings '{"effortLevel":"xhigh"}' -p ... --max-turns 1 --output-format json` | first run 13:49Z: 429 `usage_limit_reached` (the CLI was signed in to a session-capped account); the operator re-authenticated the CLI; rerun 13:53Z: `result: PANEL-OK`, `is_error: false`, `api_error_status: null` | result JSON `modelUsage` entry `canonicalModel: claude-fable-5-1`, `provider: firstParty`; the effort flag is accepted but not echoed by the harness (known, same as Opus) | ACCEPTED (rerun) |
| `grok-4.7` xhigh (grok CLI) | `grok -m grok-4.7 --effort xhigh -p ... --output-format streaming-json --max-turns 1` | replied `PANEL-OK`, exit 0 | `"modelUsage":{"grok-4.7-build":{...,"modelCalls":1,"costUSD":0.0236912}}`; effort accepted, not echoed (known) | ACCEPTED |

Rule carried from the brief: a reviewer verdict counts only against the final
configuration fingerprint. These probes establish acceptance, not verdicts;
the verdicts land in `history/receipts/stage-5-panel.md`.
