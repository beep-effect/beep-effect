# Agent Session Bridges Plan

## Status

Lifecycle: `active`; P0 placement/contract and P1 implementation are complete;
P2 final verification is ongoing. Router evidence is 44 passing tests and one
pre-existing deferred P2 R1. Owned autonomous Codex↔Grok and Codex↔Claude request/
reply/ACK proofs passed; Claude also passed the distinct two-message queued-busy
exercise. Native transport has 19 passing cases and corrected provider full
audit/docgen. Final Claude patch review also reports zero introduced findings.
CLI full package/cheap gates and exact-head hosted proof remain separate. P3 publication is pending; no PR or completed
lifecycle is claimed.

## Phases

| Phase | Status | Work | Exit criterion |
| --- | --- | --- | --- |
| P0 Research | complete | Router endpoint/envelope/receipt/policy contract and injected vertical slice passed; approved driver topology and minimal authenticated launch/lifetime design recorded. | Architecture and bounded source contract recorded; dependency ready |
| P1 Implement | complete | Implement native managed adapters and scoped CLI/MCP send/reply tools, then prove autonomous two-provider conversation; qualify Claude and classify Cursor access explicitly. | Real implementation meets its scoped acceptance |
| P2 Verify | in-progress | Run bounded idle/busy/steer/cancel/reconnect/policy tests on owned sessions and injected driver failure tests; capture a per-provider/mode receipt matrix and public sanitization proof. | Required local/package checks pass, receipt limits recorded |
| P3 Yeet: PR to mergeable | pending | Publish final waves through Yeet, mark ready at content-final, answer/resolve review threads and wait detached readiness monitor | Exact final-head hosted checks, review closure and window satisfy the existing merge gate |
| P4 Close | pending | Same-PR final lifecycle/reflection update, merge at gate and retire owning lane | Merged/mergeable proof retained, reflection validates, lifecycle completed-retained only when achieved |

## First vertical slice

Replace the controller-mediated Codex/Grok fixture with autonomous scoped send/reply tools on two owned managed sessions through the actual router; prove correlation, policy identity, bounded loops and owned cleanup.

Use the exploration [probe contract](../../explorations/cross-provider-agent-communication/research/PROBE-PLAN.md) as an evidence
matrix, not a requirement to rerun all old passing fixtures. Tests must exercise
the actual new store/services/adapters and distinguish injected ports, live model
receipt, autonomous tools and app-mode UI proof. Record unsupported or blocked
cells; no silent provider replacement, plan purchase or app-session takeover.

## P4 Closeout Checklist

1. Record exact implementation PR/head, local proof, hosted gate and resolved review evidence.
2. Finalize the dated reflection draft under `history/reflections/` with actual PR/head, package/hosted outcomes, remaining follow-ups and closeout evidence; validate reflection-artifacts.
3. Land final phase/lifecycle changes with final work. Never mark this scaffold completed-retained from exploration fixture evidence.
4. Merge only through the current gate after rereading review threads, then run the owning lane's Yeet retirement/sweep route.

## Execution Notes

Preserve unrelated work. Exact topology is recorded in the router
[implementation placement](../agent-message-router/research/IMPLEMENTATION.md).
Touched packages are `@beep/repo-cli`, `@beep/ai-provider-cli` and `@beep/acp`;
run canonical package-verify at each owned package handoff. Package scripts are generated, not hand-authored. The peer
goal owns its surface; contract coordination is an on-disk handoff, not duplicate
implementation. New model tests use only owned disposable sessions.

## Verification Commands

```sh
test "$(wc -m < goals/agent-session-bridges/GOAL.md)" -le 4000
jq . goals/agent-session-bridges/ops/manifest.json
git diff --check -- goals/agent-session-bridges
bun run beep goals doctor
bun run beep explore --check
```
