# 2026-09-27 — Opus 5.5 becomes the default sub-agent pool

## Directive

Operator directive of 2026-09-24 ("use opus 5 for all sub-agents, not codex or grok"), amended
2026-09-26 to the explicit id after transcript evidence showed the `opus` alias resolving to
`claude-opus-5` before 2026-09-25 and to `claude-opus-5-5` after the account swap. Every
sub-agent, delegation, and Workflow child now pins `model: "claude-opus-5-5"`.

## What changed in this packet's projections

- `AGENTS.md` Volume pools: pool 1 is the Opus pool; Cursor is operator-authorized rather than
  fail-open; Codex (`codex exec`, `/codex:*`, companion, `gpt-6-astra(medium)` proxy children)
  is explicit opt-in only, with its pins kept for that case.
- `docs/runbooks/agent-pools.md`: an Opus meter (the `rate_limit_error` signal), an Opus lane
  recipe (Agent tool and Workflow forms), and the Codex recipe demoted to opt-in.
- `beep models` seed manifest: new role `child.heavy` bound to `claude-opus-5-5` on the
  `claude-code` and `proxy-workflow` surfaces; `qa.judge` moves from `codex-plugin` to
  `claude-code` on the same id; the `codex.heavy` bindings carry an opt-in note.
- `browser-qa-loop` and `oracle` skills route their delegations to the Opus 5.5 Agent; the
  `qa judge-pack` hint names that launch instead of the Codex companion.

## Proxy gap recorded

CLIProxyAPI on the workstation routes the Claude ids its vendored registry knows. On
2026-09-27 `GET /v1/models` listed `claude-opus-5` and not `claude-opus-5-5`; a
`claude-opus-5-5` request answered `unknown provider for model`. Proxy sessions therefore cannot
route the default child until the registry carries the id; `beep models check` reports the
`child.heavy` × `proxy-workflow` binding as `unknown-model` while the gap stands. Direct
`claude` sessions are unaffected (the `claude-code` surface is ungated).

## Not changed

Codex-only client seats (`.claude/skills/impeccable/agents/*.toml`, the codex-security scan
model, `tools/skillopt` Codex adapter fixtures) keep `gpt-6-astra`: those clients cannot run a
Claude model, and they only run when Codex is chosen. Historical packets, research reports, and
fixtures retain the models they recorded (D-rulings unchanged; routing axis amended only).
