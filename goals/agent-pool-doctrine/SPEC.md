# Agent Pool Doctrine Spec

## Objective

Bind the pool order and admit the Cursor lane as a measurable second volume pool. Graduated from
`explorations/cursor-agent-pool` (BRIEF.md; decisions D1–D21 are the decision log and are cited, not
copied).

## Non-Goals

- Reading Cursor usage programmatically (private endpoints; D17). No scraper, cookie reuse, or client.
- A CLIProxyAPI Cursor executor or any path that makes Cursor a Workflow-child model (D6).
- Deduplicating the three `hook-pulse.sh` copies before adding the fourth (D14).
- Cloud Agents API or the self-hosted worker as the volume surface.
- A `.cursor/rules/*.mdc` restating `AGENTS.md`; copied skills; a full agents mirror (D20).
- Any change to how `codex exec` lanes run while Codex is above floor.
- The picker command (`goals/agent-pool-picker`).

## Source Hierarchy

1. `AGENTS.md` (repo laws) and `standards/ARCHITECTURE.md`.
2. `explorations/cursor-agent-pool/DECISIONS.md` D1–D21 and `BRIEF.md`.
3. `explorations/cursor-agent-pool/RESEARCH.md` and `research/2026-09-16-L{1,2,3,4}-brief.md` for
   facts (prices, flags, hook events, sandbox rules); every cited fact carries its brief URL.
4. `packages/tooling/library/ai-metrics/src/hook-pulse.ts` — the ledger schema is the oracle for rows.

## Target Surfaces

- `AGENTS.md` — replace "Token-heavy Codex work" with "Volume pools" (≤ 45 lines).
- `docs/runbooks/agent-pools.md` — new.
- `.cursor/cli.json` — deny `Shell(git)`, `Shell(sudo)`, `Shell(pkexec)` (D21).
- `.cursor/hooks.json`, `.cursor/hooks/hook-pulse.sh` — camelCase→PascalCase adapter over the shared
  writer, `agentKind cursor-cli` (D14, D19); `.claude/hooks/hook-pulse.sh` gains one env knob for the
  agent kind.
- `packages/tooling/library/ai-metrics/src/hook-pulse.ts` — `HookPulseAgentKind` += `"cursor-cli"`;
  `test/hook-pulse-writer.test.ts` — conformance case through the Cursor adapter.
- `.cursor/agents/<name>.md` — only where a model pin pays (D20); none required for acceptance.
- `goals/tsgo-045-effect-idiom-sweep/ops/prompts/50-cursor-lane.md` — cite the runbook (optional PR 2).

## Constraints

- Seat map (D16, D18): volume `composer-2.5` → `cursor-grok-4.6-xhigh`; review
  `claude-opus-5-thinking-high` → `gpt-5.6-sol-xhigh`; mechanical `composer-2.5` → `gpt-5.6-luna-high`.
  Never `-fast`, `auto`, `kimi-k3-*`, `claude-fable-5-1-*` on Cursor.
- Floors (D7, D8): Codex union-of-accounts > 5%; Cursor 5% per target bucket as a human dashboard
  check; both dry → hold and notify; Fable children never a fallback; grok-4.6 lanes research-only.
- Hooks (D9, D13): pulse rows must flow for preToolUse, postToolUse, postToolUseFailure, sessionEnd;
  `stop`/`beforeSubmitPrompt` are registered but recorded as headless GAPs; Notification is a GAP.
- Permission hooks must answer `{"permission":"allow"}` (empty stdout on a permission event blocks).
- Only events with a `HookPulseEvent` literal are wired to the pulse adapter (no `sessionStart`).
- Corpus rule (D11): nothing from the out-of-repo corpus, client documents, or secrets in a lane.
- Runbook and AGENTS.md wrap at 100 columns; AGENTS.md is the prompt-cache prefix — keep it lean.

## Acceptance Criteria

- `AGENTS.md` states the three-step order, floors, seat map, never-list, deny list, corpus rule, and
  points at the runbook; Codex pins are unchanged in wording.
- `docs/runbooks/agent-pools.md` contains the Codex meter probe (copy-paste), the Cursor recipe v2 with
  success rule and jq cookbook, the seat map with list prices and buckets, the deny list rationale, the
  hooks/GAPs section, sandbox notes, failure signatures, and cited sources.
- `.cursor/cli.json` denies git/sudo/pkexec and a headless lane's transcript shows zero `git` commands.
- `bun run beep quality package-verify @beep/repo-ai-metrics --quick` passes with the new literal and a
  test that runs `.cursor/hooks/hook-pulse.sh` on a Cursor-shaped `preToolUse` payload and decodes a
  row with `agentKind: cursor-cli`.
- A real headless `cursor-agent -p` run in the worktree leaves pulse rows with `agentKind: cursor-cli`
  in the agent-evidence ledger (admission proof, D9).

## Verification Matrix

| Claim | Command / evidence |
| --- | --- |
| Literal + adapter decode | `bun run beep quality package-verify @beep/repo-ai-metrics --quick` |
| Deny list structural | lane transcript: `grep -oE '"command":"[^"]*"' <lane>.ndjson \| grep -cE '\bgit\b'` = 0 |
| Hooks fire headless | rows in `$XDG_STATE_HOME/beep/agent-evidence/hook-pulse-*.ndjson` with `cursor-cli` |
| Docs shape | `git diff --check -- AGENTS.md docs/runbooks/agent-pools.md`; wrap ≤ 100 cols |
| Packet hygiene | `jq . goals/agent-pool-doctrine/ops/manifest.json`; `bun run beep lint reflection-artifacts` |

## Stop Conditions

- A Cursor CLI update changes the hook event names or stdin keys (re-run the smoke first).
- The shared writer cannot take an agent-kind override without behaviour change for Claude rows.
- The lane needs `--sandbox disabled` to complete (stop; report the blocked path; never disable).

## Exception Ledger

None yet.
