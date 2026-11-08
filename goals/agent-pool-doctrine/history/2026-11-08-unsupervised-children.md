# 2026-11-08 — Delegated children run unsupervised

## Directive

Operator ruling of 2026-11-08, given in a session that delegated harness setup to
a linked T3 environment opened with approval-required access. Every command the
child ran came back to the operator as an approval card. It amends the
[2026-10-18 record](./2026-10-18-codex-claude-fallback.md) and the earlier
policies; every other rule there stands.

Operator, verbatim: "we need to make sure that going forward it is documented
that all sub-agents should be in full access / bypass permissions mode because
I'm being bombarded with approval requests"

| # | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| R12 | Every delegated child runs unsupervised: Claude `Agent` and Workflow children in `bypassPermissions`, T3 `delegate_task` with `runtimeMode: "full-access"`, Codex children with approvals and the Codex sandbox bypassed, grok-build with `--permission-mode bypassPermissions`, Kimi Code with `--auto`, Junie headless. T3 rejects a child mode above its parent's, so orchestrator sessions and linked T3 environments are opened in Full access too. Cursor keeps `--sandbox enabled --force` and its D21 denials, and D11 and the money escalation are unchanged. A child that still raises an approval is a route defect: stop it and fix the route; never approve command by command. | The operator charter (2026-10-06) already makes agents decide and keeps the operator for money only. A supervised child turns every command into an operator interrupt, which reverses that charter; the permission continuity runbook already forbids turning a policy mismatch into a stream of approvals. | Delete the unsupervised-children bullet from `AGENTS.md` and the "Child permission mode" section from `docs/runbooks/agent-pools.md`, and strike this row. |

## What changed

- `AGENTS.md`, Volume pools: one bullet states the rule and points at the runbook.
- `docs/runbooks/agent-pools.md`: a new "Child permission mode" section lists the
  per-surface flag or setting and the parent-mode constraint.
