# 2026-10-01 — Approved model defaults and per-orchestrator fallback chains

## Directive

Operator policy of 2026-10-01 ("Approved model defaults and delegation policy"). It supersedes
the single four-route fallback chain, the 2026-09-24 Opus-only sub-agent order, the Grok
research-only reservation (D7), and the Codex opt-in restriction. Historical records keep the
models they recorded.

- Codex default: GPT-6.1-Sol, medium effort. Claude Code default: Claude Opus 5.5, medium effort.
- No silent same-provider substitution; lightweight routes keep their own models.
- Codex chain: GPT-6.1-Sol → cursor-agent on Opus 5.5 → grok-build on Grok 4.7.
- Claude chain: direct Opus 5.5 → cursor-agent on Opus 5.5 → grok-build on Grok 4.7.
- Cursor-agent and grok-build workers never delegate cross-provider; the originating orchestrator
  owns fallback. Automatic fallback only on confirmed quota, availability, or unsupported-model
  failures; existing subscriptions and authorized billing only; exhausted chain → report and hold.
- Every route may implement, explore, research, and review (goal admission included); reviewer
  separation, source-bound evidence, carried findings, and identical gates persist across routes.

## Verified identifiers

| Intended | Verified id | Route | Evidence |
| --- | --- | --- | --- |
| GPT-6.1-Sol medium | `gpt-6.1-sol` / `model_reasoning_effort="medium"` | Codex CLI (ChatGPT OAuth) | `codex exec --json` → `OK`; rollout `"model":"gpt-6.1-sol"`, `"reasoning_effort":"medium"`; `~/.codex/models_cache.json` ladder low…ultra |
| Claude Opus 5.5 medium | `claude-opus-5-5` / `--effort medium` (`effortLevel`) | Claude Code (Anthropic direct) | `claude -p` → `OK`; `modelUsage` `["claude-opus-5-5"]`; effort accepted, not echoed |
| Cursor-agent on Opus 5.5 | `cursor-agent --model claude-opus-5-5` | Cursor Ultra seat | stream-json init `Claude Opus 5.5 300K Medium`; the id is absent from `--list-models`; effort baked into the seat |
| grok-build on Grok 4.7 medium | `grok -m grok-4.7 --effort medium` (`--reasoning-effort` alias) | native Grok Build CLI (grok.com login) | JSON `modelUsage.grok-4.7-build`; `grok models` default `grok-4.7`; effort ladder low/medium/high/xhigh; effort accepted, not echoed |

Not verified / gaps: CLIProxyAPI `GET /v1/models` lists `gpt-6.1-sol` and `grok-4.7` but still
not `claude-opus-5-5`, so proxy sessions cannot route the Claude default child. Claude Code and
Grok Build accept `medium` but do not echo the effort in their results.

## What changed

Live harness configuration (home, backed up before editing):

- `~/.codex/config.toml` `model = "gpt-6.1-sol"` (effort keys already `medium`);
  `~/.config/JetBrains/Air/.codex/config.toml` the same; WebStorm 2026.2/2026.3 `CodexLauncher.xml`
  model `gpt-6.1-sol`, effort `Medium`; `~/.agents/skills/impeccable/agents/*.toml` model.
- `~/.claude/settings.json` `model: "claude-opus-5-5"`, `effortLevel: "medium"`.
- `~/.zshrc` `claudex` → `gpt-6.1-sol(medium)`.
- `~/.grok/config.toml` `[models] default_reasoning_effort = "medium"` (default already `grok-4.7`).
- `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, `~/.claude/rules/working-style.md` doctrine text;
  `~/.junie/AGENTS.md` is a copy of the new `CLAUDE.md`.
- Observed drift source: an interactive `codex resume --yolo` TUI rewrote `~/.codex/config.toml`
  `model_reasoning_effort` to `low` once during the edit window; it was reset to `medium`.
  Re-run `beep models check` after that TUI exits.

Repo projections: `AGENTS.md` Volume pools, `docs/runbooks/agent-pools.md` (defaults, chains,
verification record, Junie, recipes, failure signatures), `beep models` seed (new roles
`fallback.cursor`, `fallback.grok`; `codex.heavy`/`codex.plan` → `gpt-6.1-sol` medium
superseding `gpt-6-astra`; `orchestrator` × `claude-code` → `claude-opus-5-5` medium while `orchestrator` ×
`proxy-workflow` keeps `claude-fable-5-1` for `claudep` until the proxy registry carries Opus 5.5;
`$HOME/.grok/config.toml` rebound to `fallback.grok`; `gpt-6-astra` in the superseded list;
`~/.config/beep/models.yaml` re-seeded with 21 bindings and tool-owned `beep-models` blocks placed in
`AGENTS.md`, the agent-pools runbook, the oracle skill, `~/.claude/CLAUDE.md`,
`~/.claude/rules/working-style.md`, and `~/.codex/AGENTS.md`), Codex plugin seats under
`.claude/skills/impeccable/agents/`, and the oracle skill pin.

## Junie

Inspected, no chain invented. `~/.junie/settings.json`: `modelForLaunch: gemini-3-flash-preview`,
`effortPerModel: {}`, `subagentsMode: Auto`. BYOK `--provider`/`--model` flags exist. Whether
Junie gets its own chain is an open operator decision; it is outside this policy until decided.
