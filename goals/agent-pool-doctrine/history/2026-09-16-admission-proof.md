# Admission proof — Cursor lane under the pool rule, 2026-09-16

Worktree `cursor-agent-pool`, branch `explore/cursor-agent-pool`. Uncommitted at time of writing.

| Check (SPEC acceptance) | Evidence |
| --- | --- |
| Deny list structural | `.cursor/cli.json` denies `Shell(git)`, `Shell(sudo)`, `Shell(pkexec)`; the first-slice lane transcript (`composer-2.5`, exit 0, 118 s) has 0 `"command"` values containing `git`; `git status` showed only the intended files. |
| Lane wrote the doctrine | `docs/runbooks/agent-pools.md` (298 lines) and the `AGENTS.md` "Volume pools" section (43 lines) authored by the lane; Fable corrected two slips (research-reserved lanes are the xAI `grok-4.6` proxy lanes; bullet→paragraph formatting). |
| Literal + adapter decode | `bun run beep quality package-verify @beep/repo-ai-metrics --quick`: `ok lint 5.4s ok check 5.0s` after `turbo run build --filter=@beep/repo-ai-metrics^...` (fresh-worktree dist was missing; TS6305 class, environment-only). Writer tests: 17 passed, including "tags Cursor hook rows as cursor-cli and answers the permission protocol". |
| Hooks fire headless, rows decode | Live ledger `$XDG_STATE_HOME/beep/agent-evidence/hook-events/hook-pulse-2026-09-16-*.ndjson`: 8 `PreToolUse` + 8 `PostToolUse` rows with `agentKind: cursor-cli` written by the Opus 5 review lane (`--mode=ask`, `--sandbox enabled`) through `.cursor/hooks.json` → `.cursor/hooks/hook-pulse.sh` → shared writer with `BEEP_HOOK_PULSE_AGENT_KIND=cursor-cli`. |
| Review pass (D18) | `claude-opus-5-thinking-high`, read-only; verdict appended below when the lane exits. |
| Packet hygiene | `bun run beep goals doctor`: OK, no blocking findings (advisory `stale-active` until the packet is committed). `bun run beep explore atlas --check`: OK. |

Environment notes: the Cursor sandbox write-protects `.cursor/*.json`, so config files were
Fable-written; `sequence-break-notifier.sh` now admits `cursor-cli`.

## Review verdict (D18)

`claude-opus-5-thinking-high` read-only pass: **BLOCK** on four text-only doctrine contradictions
(wrong Grok family reserved, meter row said hold instead of Cursor, Fable re-admitted for review,
`sessionStart` mapped to a non-existent ledger literal), six should-fixes, eight nits; every price,
event name, jq recipe, and seat id checked out. All findings applied by Fable the same day; see
`2026-09-16-review-opus5.md`. Second pass launched to confirm.

**Second pass:** SHIP WITH FIXES — all four blockers and eight nits RESOLVED, should #7 PARTIAL
(`--cd` uncited → removed from the block), three new small items (AGENTS.md wrap, law-pulse event
name, paste-safe `$LANE` redirect) → fixed. See `2026-09-16-review-opus5-pass2.md`.
