# Agent Session Bridges Plan

## Status

**Proposed state for merged `main`, [PR #1571](https://github.com/beep-effect/beep-effect/pull/1571).**
The lifecycle, phases and merge-conditional checklist items in this branch take
effect when this PR merges after its exact final head passes required hosted
checks, answered/resolved review threads and the 20-minute review window.
Execution remains open until then; the PR's live merge gate supplies the
completion evidence.

Local full verification and the initial Yeet publication are complete: all three
touched package audits/docgen passed, CLI audit 745.2 seconds/docgen 23.9 seconds,
and 16 cheap gates plus clean-head install passed. PR #1571 was created from
implementation source commit `1565951a24da16aed9e238fde55ca7250fe9c7d2`. Exact final-head hosted checks,
review closure/window and merge remain unverified here.


Local full proof binds the qualified implementation snapshot published at
`1565951a24da16aed9e238fde55ca7250fe9c7d2`. Advancing-base integration and the final
packet commit retain their own exact-head hosted/review gate; earlier local proof
is not automatically promoted to the integrated final head.

## Phases

| Phase | Status | Work | Exit criterion |
| --- | --- | --- | --- |
| P0 Research | complete | Router endpoint/envelope/receipt/policy contract and injected vertical slice passed; approved driver topology and minimal authenticated launch/lifetime design recorded. | Architecture and bounded source contract recorded; dependency ready |
| P1 Implement | complete | Implement native managed adapters and scoped CLI/MCP send/reply tools, then prove autonomous two-provider conversation; qualify Claude and classify Cursor access explicitly. | Real implementation meets its scoped acceptance |
| P2 Verify | complete | Run bounded idle/busy/steer/cancel/reconnect/policy tests on owned sessions and injected driver failure tests; capture a per-provider/mode receipt matrix and public sanitization proof. | Required local/package checks pass, receipt limits recorded |
| P3 Yeet: PR to mergeable | complete (merge-conditional) | Publish final waves through Yeet, mark ready at content-final, answer/resolve review threads and wait detached readiness monitor | Exact final-head hosted checks, review closure and window satisfy the existing merge gate |
| P4 Close | complete (merge-conditional) | Same-PR final lifecycle/reflection update, merge at gate and retire owning lane | Merged/mergeable proof retained, reflection validates, lifecycle completed-retained only when achieved |

## First vertical slice

Replace the controller-mediated Codex/Grok fixture with autonomous scoped send/reply tools on two owned managed sessions through the actual router; prove correlation, policy identity, bounded loops and owned cleanup.

Use the exploration [probe contract](../../explorations/cross-provider-agent-communication/research/PROBE-PLAN.md) as an evidence
matrix, not a requirement to rerun all old passing fixtures. Tests must exercise
the actual new store/services/adapters and distinguish injected ports, live model
receipt, autonomous tools and app-mode UI proof. Record unsupported or blocked
cells; no silent provider replacement, plan purchase or app-session takeover.

## P4 Closeout Checklist

1. Record exact implementation PR/head, local proof, hosted gate and resolved review evidence.
2. Retain the final dated reflection under `history/reflections/` with actual source commit, local package outcomes, remaining follow-ups and prospective closeout limits; validate reflection-artifacts.
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
