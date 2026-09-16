# Brief — Cursor Agent Pool

Fat-marker pitch shaped from `CAPTURE.md`, `RESEARCH.md`, and `DECISIONS.md` (D1–D21).

## Problem

Three ChatGPT Pro subscriptions behind Codex drain to 1% every cycle while a $200/month Cursor Ultra
subscription sits at 1% used. The repo has no pool-order rule: `AGENTS.md` names one volume route
(`gpt-6-astra`) and orchestrators hand-write `codex exec` lanes that die at the usage wall. A Cursor
lane exists (tsgo-045 D13) but is packet-local, invisible to ai-metrics, and gated by a prompt-only
no-git rule.

## Appetite

Small. Goal A is one doctrine PR train (runbook, `AGENTS.md`, four small `.cursor/` files, one schema
literal, one test) dogfooded on a Cursor lane. Goal B is a bounded CLI command. Nothing here needs a new
package family, a proxy provider, or a scraper.

## Solution sketch

**Pool order (binding, `AGENTS.md`):**

1. Codex pool above 5% remaining on any admitted account → `codex exec --model gpt-6-astra` (medium).
2. Else Cursor pool (fail-open) → `cursor-agent -p` on the seat for the tier below.
3. Else hold: queue the lane and notify the operator. Fable children are never the fallback; grok-4.6
   lanes stay reserved for research-class work.

**Seat map inside Cursor (bucket-aware):**

| Tier | Primary | Fallback | Bucket |
| --- | --- | --- | --- |
| Volume implementation | `composer-2.5` | `cursor-grok-4.6-xhigh` (long-horizon, self-testing) | Cursor Models |
| Review / adversarial verification | `claude-opus-5-thinking-high` | `gpt-5.6-sol-xhigh` | Other Models |
| Lightweight mechanical | `composer-2.5` | `gpt-5.6-luna-high` | Cursor Models → Other |

Never: any `-fast` id, `auto`, `kimi-k3-*`, `claude-fable-5-1-*` on Cursor. Stop Cursor-bucket lanes
before that bar reaches 100% (spill zeroes Other Models).

**Meters:** Codex via `codex app-server` → `account/rateLimits/read` (proven); Cursor fail-open, a
lane exiting nonzero with `Total usage limit reached` (or kin) in stderr marks the pool dry for the
session; the dashboard is the human meter.

**Lane recipe v2 (runbook):** host `timeout 15m`, `cursor-agent -p --trust --force --sandbox enabled
--workspace <abs> --model <seat> --output-format stream-json "<prompt>" </dev/null`; success = exit 0
and a `result/success` line; no `--stream-partial-output`, `--worktree`, `--approve-mcps`, or plan mode.

**Parity files (`.cursor/`):** `hooks.json` + `hooks/hook-pulse.sh` adapter (camelCase→PascalCase,
`agentKind cursor-cli`; law-pulse on `afterFileEdit`; yeet-inbox P0 deny on `preToolUse`);
`cli.json` denying `Shell(git)`, `Shell(sudo)`, `Shell(pkexec)`; `agents/<name>.md` only for model
pins. `HookPulseAgentKind` gains `cursor-cli` with its conformance test. Skills and the other agents
ride on Cursor's discovery of `.claude/` and `.agents/`.

**Picker (Goal B):** `beep agent-pool pick [--tier volume|review|mechanical]` reads the Codex meter,
applies the floors, and prints the exact launch command (or `hold` with reasons); orchestrators run
what it prints.

## Rabbit holes

- Reading Cursor usage programmatically: only private endpoints exist and staff class them with
  banned proxies. Do not go there (D17).
- A CLIProxyAPI Cursor executor to make Cursor a Workflow-child model: no upstream provider, terms
  risk (D6).
- Deduplicating the three `hook-pulse.sh` copies before adding the fourth: right later, blocks now
  (D14).
- Cloud Agents API / self-hosted worker as the volume surface: same pools plus infra, and a run of
  stuck runs in Aug–Sep 2026.
- Proving the Codex "union of accounts" meter through CLIProxyAPI: its quota surface is NOT FOUND;
  Goal B starts with the CLI account and adds proxy accounts only if the management API exposes
  them.

## No-gos

- No usage scraper, cookie reuse, or private-endpoint client in this public repo.
- No Fable children as a fallback pool; no Grok editing lanes as tier 3.
- No `.cursor/rules/*.mdc` restating `AGENTS.md`; no copied skills; no full agents mirror.
- No change to how `codex exec` lanes run when Codex is above floor.
- Nothing from the out-of-repo corpus, client documents, or secrets in a Cursor lane prompt.
