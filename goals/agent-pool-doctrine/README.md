# Agent Pool Doctrine

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the model defaults and per-orchestrator fallback chains binding — Codex on `gpt-6.1-sol`
medium and Claude Code on `claude-opus-5-5` medium, each falling back to the Cursor agent on Opus
5.5 and then to grok-build on `grok-4.7` (policy of 2026-10-01, which superseded the 2026-09-24
Opus-only order) — and make the Cursor lane a measurable, structurally guarded pool: pulse hooks,
a committed deny list, and a runbook every orchestrator can copy from.

## Launch

```text
/goal follow the instructions in goals/agent-pool-doctrine/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - carried source ledger; primary is the exploration.
6. [`history/2026-10-01-fallback-chains.md`](./history/2026-10-01-fallback-chains.md) - the
   2026-10-01 policy, verified identifiers, and the Junie open decision.
7. [`../../explorations/cursor-agent-pool/`](../../explorations/cursor-agent-pool/) - BRIEF, DECISIONS
   D1–D21, RESEARCH with the hooks smoke test and the Codex meter proof.

## Current Phase

P1 Implement. First slice landed (uncommitted): the runbook and the `AGENTS.md` pool section are being written
by a `composer-2.5` lane in worktree `cursor-agent-pool` (D15 dogfood); the deny list, hooks adapter,
and `cursor-cli` schema literal are Fable-written in the same worktree.

## Latest Evidence

[`history/2026-09-27-opus-default.md`](./history/2026-09-27-opus-default.md): the routing axis
moved from Codex Astra to Opus 5.5 — `AGENTS.md`, the runbook, the `beep models` seed
(`child.heavy`), and the QA/oracle skills now pin `claude-opus-5-5`; the CLIProxyAPI registry gap
for that id is recorded there.

[`history/2026-09-16-admission-proof.md`](./history/2026-09-16-admission-proof.md): first slice written by
a `composer-2.5` lane under the deny list (0 git commands), package verify green with the `cursor-cli`
literal and conformance test, live ledger rows tagged `cursor-cli` from a real headless run.

## Notes

- Cursor's sandbox write-protects `.cursor/*.json`; lanes cannot author the deny list or hooks.json.
- Never pin a `-fast` id; `composer-2.5-fast` is the product default at 6x input price.
- No usage scraper, ever (D17).
